package consumer

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Batch struct {
	Cursor      int64        `json:"cursor"`
	Events      []Event      `json:"events"`
	Quarantined []Quarantine `json:"quarantined,omitempty"`
}

type Sink interface {
	LoadCursor(context.Context) (int64, error)
	Persist(context.Context, Batch) (int64, error)
}

type HTTPError struct {
	StatusCode int
	RetryAfter time.Duration
	Body       string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("Skyblur ingest API returned %d: %s", e.StatusCode, e.Body)
}

func (e *HTTPError) Temporary() bool {
	return e.StatusCode == http.StatusTooManyRequests || e.StatusCode >= 500
}

type HTTPSink struct {
	StateURL  string
	IngestURL string
	Secret    []byte
	Client    *http.Client
	Now       func() time.Time
}

func (s *HTTPSink) LoadCursor(ctx context.Context) (int64, error) {
	request, err := s.newRequest(ctx, http.MethodGet, s.StateURL, nil)
	if err != nil {
		return 0, err
	}
	response, err := s.client().Do(request)
	if err != nil {
		return 0, err
	}
	defer drainAndClose(response.Body)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return 0, responseError(response)
	}
	var state struct {
		CommittedCursor int64 `json:"committedCursor"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&state); err != nil {
		return 0, fmt.Errorf("decode cursor response: %w", err)
	}
	return state.CommittedCursor, nil
}

func (s *HTTPSink) Persist(ctx context.Context, batch Batch) (int64, error) {
	body, err := json.Marshal(batch)
	if err != nil {
		return 0, fmt.Errorf("encode ingest batch: %w", err)
	}
	request, err := s.newRequest(ctx, http.MethodPost, s.IngestURL, body)
	if err != nil {
		return 0, err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := s.client().Do(request)
	if err != nil {
		return 0, err
	}
	defer drainAndClose(response.Body)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return 0, responseError(response)
	}
	var result struct {
		CommittedCursor int64 `json:"committedCursor"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&result); err != nil {
		return 0, fmt.Errorf("decode ingest response: %w", err)
	}
	if result.CommittedCursor < 0 {
		return 0, errors.New("ingest API returned an invalid cursor")
	}
	return result.CommittedCursor, nil
}

func (s *HTTPSink) newRequest(ctx context.Context, method, rawURL string, body []byte) (*http.Request, error) {
	if len(s.Secret) == 0 {
		return nil, errors.New("ingest secret is empty")
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("parse API URL: %w", err)
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && (parsed.Hostname() == "127.0.0.1" || parsed.Hostname() == "localhost")) {
		return nil, errors.New("Skyblur API URL must use HTTPS")
	}
	timestamp := s.now().UTC().Format(time.RFC3339)
	digest := sha256.Sum256(body)
	canonical := strings.Join([]string{timestamp, method, parsed.EscapedPath(), hex.EncodeToString(digest[:])}, "\n")
	mac := hmac.New(sha256.New, s.Secret)
	_, _ = mac.Write([]byte(canonical))

	request, err := http.NewRequestWithContext(ctx, method, rawURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("X-Skyblur-Timestamp", timestamp)
	request.Header.Set("X-Skyblur-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	request.Header.Set("User-Agent", "Skyblur-Jetstream-Consumer/1.0")
	return request, nil
}

func (s *HTTPSink) client() *http.Client {
	if s.Client != nil {
		return s.Client
	}
	return &http.Client{Timeout: 15 * time.Second}
}

func (s *HTTPSink) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

func responseError(response *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 4<<10))
	retryAfter := time.Duration(0)
	if seconds, err := strconv.Atoi(response.Header.Get("Retry-After")); err == nil && seconds > 0 {
		retryAfter = time.Duration(seconds) * time.Second
	}
	return &HTTPError{
		StatusCode: response.StatusCode,
		RetryAfter: retryAfter,
		Body:       strings.TrimSpace(string(body)),
	}
}

func drainAndClose(body io.ReadCloser) {
	_, _ = io.Copy(io.Discard, io.LimitReader(body, 64<<10))
	_ = body.Close()
}
