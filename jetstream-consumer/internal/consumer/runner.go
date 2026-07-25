package consumer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
)

type Options struct {
	Endpoints           []string
	Collection          string
	MaxMessageBytes     int64
	QueueCapacity       int
	MaxBatchEvents      int
	MaxBatchBytes       int
	EventFlushInterval  time.Duration
	CursorFlushInterval time.Duration
	Rewind              time.Duration
	PingInterval        time.Duration
	IdleTimeout         time.Duration
	RetryMin            time.Duration
	RetryMax            time.Duration
	StableAfter         time.Duration
	ShutdownGrace       time.Duration
	MaxFutureCursor     time.Duration
}

func DefaultOptions() Options {
	return Options{
		Endpoints: []string{
			"wss://jetstream1.us-east.bsky.network/subscribe",
			"wss://jetstream2.us-east.bsky.network/subscribe",
			"wss://jetstream1.us-west.bsky.network/subscribe",
			"wss://jetstream2.us-west.bsky.network/subscribe",
		},
		Collection:          "uk.skyblur.post",
		MaxMessageBytes:     1 << 20,
		QueueCapacity:       8,
		MaxBatchEvents:      20,
		MaxBatchBytes:       1 << 20,
		EventFlushInterval:  time.Second,
		CursorFlushInterval: time.Minute,
		Rewind:              5 * time.Second,
		PingInterval:        20 * time.Second,
		IdleTimeout:         90 * time.Second,
		RetryMin:            time.Second,
		RetryMax:            time.Minute,
		StableAfter:         time.Minute,
		ShutdownGrace:       10 * time.Second,
		MaxFutureCursor:     5 * time.Minute,
	}
}

type Runner struct {
	Options    Options
	Sink       Sink
	HTTPClient *http.Client
	Logger     *slog.Logger
	committed  atomic.Int64
}

func (r *Runner) Run(ctx context.Context) error {
	if err := r.validate(); err != nil {
		return err
	}
	logger := r.logger()
	endpointIndex := 0
	backoff := r.Options.RetryMin

	for {
		if err := ctx.Err(); err != nil {
			return nil
		}
		cursor, err := r.Sink.LoadCursor(ctx)
		if err != nil {
			if isPermanent(err) {
				return fmt.Errorf("load durable cursor: %w", err)
			}
			logger.Warn("cursor load failed", "error", err)
			if err := waitBeforeRetry(ctx, err, backoff, r.Options.RetryMax); err != nil {
				return nil
			}
			backoff = nextBackoff(backoff, r.Options.RetryMax)
			continue
		}
		if cursor < r.committed.Load() {
			return fmt.Errorf("durable cursor moved backwards from %d to %d", r.committed.Load(), cursor)
		}
		if cursor < 0 || cursor > time.Now().Add(r.Options.MaxFutureCursor).UnixMicro() {
			return fmt.Errorf("durable cursor is outside the accepted range: %d", cursor)
		}
		if cursor > r.committed.Load() {
			r.committed.Store(cursor)
		}

		endpoint := r.Options.Endpoints[endpointIndex%len(r.Options.Endpoints)]
		logger.Info("connecting to Jetstream", "endpoint", endpoint, "committedCursor", r.committed.Load())
		sessionStarted := time.Now()
		err = r.runSession(ctx, endpoint, r.committed.Load())
		if ctx.Err() != nil {
			return nil
		}
		if isPermanent(err) {
			return err
		}
		logger.Warn("Jetstream session ended", "endpoint", endpoint, "error", err, "committedCursor", r.committed.Load())
		if time.Since(sessionStarted) >= r.Options.StableAfter {
			backoff = r.Options.RetryMin
		}
		endpointIndex = (endpointIndex + 1) % len(r.Options.Endpoints)
		if err := waitBeforeRetry(ctx, err, backoff, r.Options.RetryMax); err != nil {
			return nil
		}
		backoff = nextBackoff(backoff, r.Options.RetryMax)
	}
}

func (r *Runner) runSession(ctx context.Context, endpoint string, committed int64) error {
	sessionCtx, cancelSession := context.WithCancel(ctx)
	defer cancelSession()
	persistCtx, cancelPersist := context.WithCancel(context.WithoutCancel(ctx))
	defer cancelPersist()
	subscribeURL, err := r.subscribeURL(endpoint, committed)
	if err != nil {
		return permanentError{err}
	}
	connection, _, err := websocket.Dial(sessionCtx, subscribeURL, &websocket.DialOptions{HTTPClient: r.HTTPClient})
	if err != nil {
		return fmt.Errorf("connect Jetstream: %w", err)
	}
	defer connection.CloseNow()
	connection.SetReadLimit(r.Options.MaxMessageBytes)

	frames := make(chan Frame, r.Options.QueueCapacity)
	readErrors := make(chan error, 1)
	persistErrors := make(chan error, 1)

	go func() {
		defer close(frames)
		readErrors <- r.readFrames(sessionCtx, connection, frames)
	}()
	go func() {
		persistErrors <- r.persistFrames(persistCtx, frames)
	}()
	go r.ping(sessionCtx, connection)

	select {
	case persistErr := <-persistErrors:
		_ = connection.Close(websocket.StatusGoingAway, "persistence stopped")
		<-readErrors
		return persistErr
	case readErr := <-readErrors:
		persistErr := <-persistErrors
		if persistErr != nil {
			return persistErr
		}
		return readErr
	case <-ctx.Done():
		_ = connection.Close(websocket.StatusNormalClosure, "shutdown")
		<-readErrors
		shutdownTimer := time.NewTimer(r.Options.ShutdownGrace)
		defer shutdownTimer.Stop()
		select {
		case persistErr := <-persistErrors:
			return persistErr
		case <-shutdownTimer.C:
			cancelPersist()
			return fmt.Errorf("shutdown drain exceeded %s", r.Options.ShutdownGrace)
		}
	}
}

func (r *Runner) readFrames(ctx context.Context, connection *websocket.Conn, frames chan<- Frame) error {
	for {
		readCtx, cancel := context.WithTimeout(ctx, r.Options.IdleTimeout)
		messageType, message, err := connection.Read(readCtx)
		cancel()
		if err != nil {
			return fmt.Errorf("read Jetstream: %w", err)
		}
		if messageType != websocket.MessageText {
			continue
		}
		frame, err := ParseFrame(message, r.Options.Collection)
		if err != nil {
			return permanentError{fmt.Errorf("parse Jetstream frame: %w", err)}
		}
		select {
		case frames <- frame:
		case <-ctx.Done():
			return nil
		default:
			return ErrQueueFull
		}
	}
}

func (r *Runner) persistFrames(ctx context.Context, frames <-chan Frame) error {
	eventTimer := time.NewTimer(time.Hour)
	if !eventTimer.Stop() {
		<-eventTimer.C
	}
	defer eventTimer.Stop()
	cursorTimer := time.NewTimer(time.Hour)
	if !cursorTimer.Stop() {
		<-cursorTimer.C
	}
	defer cursorTimer.Stop()
	var eventTimerC <-chan time.Time
	var cursorTimerC <-chan time.Time
	var eventDeadline time.Time
	var cursorDeadline time.Time
	batch := Batch{Events: make([]Event, 0, r.Options.MaxBatchEvents), Quarantined: make([]Quarantine, 0, 1)}
	batchBytes := 0

	hasDurablePayload := func() bool {
		return len(batch.Events)+len(batch.Quarantined) > 0
	}

	stopTimers := func() {
		if !eventTimer.Stop() {
			select {
			case <-eventTimer.C:
			default:
			}
		}
		if !cursorTimer.Stop() {
			select {
			case <-cursorTimer.C:
			default:
			}
		}
		eventTimerC = nil
		cursorTimerC = nil
		eventDeadline = time.Time{}
		cursorDeadline = time.Time{}
	}

	armCursorTimer := func(now time.Time) {
		if cursorTimerC != nil {
			return
		}
		cursorDeadline = now.Add(r.Options.CursorFlushInterval)
		cursorTimer.Reset(r.Options.CursorFlushInterval)
		cursorTimerC = cursorTimer.C
	}

	armEventTimer := func(now time.Time) {
		if eventTimerC != nil {
			return
		}
		eventDeadline = now.Add(r.Options.EventFlushInterval)
		eventTimer.Reset(r.Options.EventFlushInterval)
		eventTimerC = eventTimer.C
	}

	flush := func() error {
		if batch.Cursor == 0 {
			return nil
		}
		committed, err := r.Sink.Persist(ctx, batch)
		if err != nil {
			if isPermanent(err) {
				return permanentError{fmt.Errorf("persist Jetstream batch: %w", err)}
			}
			return fmt.Errorf("persist Jetstream batch: %w", err)
		}
		previous := r.committed.Load()
		maximumAllowed := max(previous, batch.Cursor)
		if committed < previous || committed > maximumAllowed {
			return permanentError{fmt.Errorf(
				"ingest API returned unsafe cursor %d (previous=%d batch=%d)",
				committed, previous, batch.Cursor,
			)}
		}
		if committed > r.committed.Load() {
			r.committed.Store(committed)
		}
		r.logger().Info(
			"Jetstream batch persisted",
			"events", len(batch.Events),
			"quarantined", len(batch.Quarantined),
			"batchCursor", batch.Cursor,
			"committedCursor", committed,
		)
		batch = Batch{Events: make([]Event, 0, r.Options.MaxBatchEvents), Quarantined: make([]Quarantine, 0, 1)}
		batchBytes = 0
		stopTimers()
		return nil
	}

	for {
		select {
		case frame, ok := <-frames:
			if !ok {
				return flush()
			}
			now := time.Now()
			if batch.Cursor == 0 {
				armCursorTimer(now)
			}
			if frame.Event != nil {
				if hasDurablePayload() && batchBytes+frame.Size > r.Options.MaxBatchBytes {
					if err := flush(); err != nil {
						return err
					}
					armCursorTimer(now)
				}
				if !hasDurablePayload() {
					armEventTimer(now)
				}
				batch.Cursor = max(batch.Cursor, frame.Cursor)
				batch.Events = append(batch.Events, *frame.Event)
				batchBytes += frame.Size
			} else if frame.Quarantine != nil {
				if hasDurablePayload() && batchBytes+frame.Size > r.Options.MaxBatchBytes {
					if err := flush(); err != nil {
						return err
					}
					armCursorTimer(now)
				}
				if !hasDurablePayload() {
					armEventTimer(now)
				}
				batch.Cursor = max(batch.Cursor, frame.Cursor)
				batch.Quarantined = append(batch.Quarantined, *frame.Quarantine)
				batchBytes += frame.Size
			} else {
				batch.Cursor = max(batch.Cursor, frame.Cursor)
			}
			if len(batch.Events)+len(batch.Quarantined) >= r.Options.MaxBatchEvents ||
				batchBytes >= r.Options.MaxBatchBytes {
				if err := flush(); err != nil {
					return err
				}
				continue
			}
			now = time.Now()
			if hasDurablePayload() && !eventDeadline.IsZero() && !now.Before(eventDeadline) {
				if err := flush(); err != nil {
					return err
				}
			} else if batch.Cursor != 0 && !cursorDeadline.IsZero() && !now.Before(cursorDeadline) {
				if err := flush(); err != nil {
					return err
				}
			}
		case <-eventTimerC:
			if err := flush(); err != nil {
				return err
			}
		case <-cursorTimerC:
			if err := flush(); err != nil {
				return err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (r *Runner) ping(ctx context.Context, connection *websocket.Conn) {
	ticker := time.NewTicker(r.Options.PingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			pingCtx, cancel := context.WithTimeout(ctx, r.Options.PingInterval/2)
			err := connection.Ping(pingCtx)
			cancel()
			if err != nil {
				connection.CloseNow()
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

func (r *Runner) subscribeURL(endpoint string, committed int64) (string, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", err
	}
	query := parsed.Query()
	query.Set("wantedCollections", r.Options.Collection)
	query.Set("maxMessageSizeBytes", strconv.FormatInt(r.Options.MaxMessageBytes, 10))
	rewindMicroseconds := r.Options.Rewind.Microseconds()
	cursor := committed - rewindMicroseconds
	if cursor > 0 {
		query.Set("cursor", strconv.FormatInt(cursor, 10))
	} else {
		query.Del("cursor")
	}
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func (r *Runner) validate() error {
	if r.Sink == nil || len(r.Options.Endpoints) == 0 || r.Options.Collection == "" {
		return errors.New("sink, endpoints, and collection are required")
	}
	if r.Options.MaxMessageBytes <= 0 || r.Options.QueueCapacity <= 0 || r.Options.MaxBatchEvents <= 0 || r.Options.MaxBatchBytes <= 0 || r.Options.MaxMessageBytes > int64(r.Options.MaxBatchBytes) {
		return errors.New("message, queue, and batch limits must be positive")
	}
	if r.Options.EventFlushInterval <= 0 || r.Options.CursorFlushInterval <= 0 || r.Options.PingInterval <= 0 || r.Options.IdleTimeout <= 0 || r.Options.RetryMin <= 0 || r.Options.RetryMax < r.Options.RetryMin || r.Options.StableAfter <= 0 || r.Options.ShutdownGrace <= 0 || r.Options.MaxFutureCursor < 0 || r.Options.Rewind < 0 {
		return errors.New("invalid timing options")
	}
	return nil
}

func (r *Runner) logger() *slog.Logger {
	if r.Logger != nil {
		return r.Logger
	}
	return slog.Default()
}

type permanentError struct{ error }

func isPermanent(err error) bool {
	var permanent permanentError
	if errors.As(err, &permanent) {
		return true
	}
	var responseErr *HTTPError
	return errors.As(err, &responseErr) && !responseErr.Temporary()
}

func waitBeforeRetry(ctx context.Context, err error, fallback, maximum time.Duration) error {
	var responseErr *HTTPError
	if errors.As(err, &responseErr) && responseErr.RetryAfter > 0 {
		timer := time.NewTimer(min(responseErr.RetryAfter, maximum))
		defer timer.Stop()
		select {
		case <-timer.C:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return waitWithJitter(ctx, fallback)
}

func nextBackoff(current, maximum time.Duration) time.Duration {
	return min(current*2, maximum)
}

func waitWithJitter(ctx context.Context, maximum time.Duration) error {
	if maximum <= 0 {
		return nil
	}
	delay := time.Duration(rand.Int64N(int64(maximum) + 1))
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
