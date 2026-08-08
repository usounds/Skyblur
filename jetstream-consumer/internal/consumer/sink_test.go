package consumer

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHTTPSinkSignsAndPersistsBatch(t *testing.T) {
	secret := []byte("test-secret")
	now := time.Date(2026, 7, 17, 0, 0, 0, 0, time.UTC)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatal(err)
		}
		digest := sha256.Sum256(body)
		canonical := strings.Join([]string{now.Format(time.RFC3339), request.Method, request.URL.EscapedPath(), hex.EncodeToString(digest[:])}, "\n")
		mac := hmac.New(sha256.New, secret)
		_, _ = mac.Write([]byte(canonical))
		expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
		if request.Header.Get("X-Skyblur-Signature") != expected {
			t.Fatalf("unexpected signature: %s", request.Header.Get("X-Skyblur-Signature"))
		}
		if request.URL.Path == "/state" {
			_ = json.NewEncoder(response).Encode(map[string]int64{"committedCursor": 100})
			return
		}
		_ = json.NewEncoder(response).Encode(map[string]int64{"committedCursor": 200})
	}))
	defer server.Close()

	sink := &HTTPSink{
		StateURL:  server.URL + "/state",
		IngestURL: server.URL + "/ingest",
		Secret:    secret,
		Client:    server.Client(),
		Now:       func() time.Time { return now },
	}
	cursor, err := sink.LoadCursor(context.Background())
	if err != nil || cursor != 100 {
		t.Fatalf("LoadCursor() = %d, %v", cursor, err)
	}
	committed, err := sink.Persist(context.Background(), Batch{Cursor: 200})
	if err != nil || committed != 200 {
		t.Fatalf("Persist() = %d, %v", committed, err)
	}
}
