package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
)

type memorySink struct {
	mu      sync.Mutex
	cursor  int64
	batches []Batch
	notify  chan struct{}
}

type fixedSink struct {
	loaded    int64
	committed int64
}

func (s fixedSink) LoadCursor(context.Context) (int64, error) { return s.loaded, nil }
func (s fixedSink) Persist(context.Context, Batch) (int64, error) {
	return s.committed, nil
}

type blockingSink struct {
	started chan struct{}
	release chan struct{}
	once    sync.Once
}

type failingBlockingSink struct {
	started chan struct{}
	release chan struct{}
}

func (s *blockingSink) LoadCursor(context.Context) (int64, error) { return 0, nil }
func (s *blockingSink) Persist(ctx context.Context, batch Batch) (int64, error) {
	s.once.Do(func() { close(s.started) })
	select {
	case <-s.release:
		return batch.Cursor, nil
	case <-ctx.Done():
		return 0, ctx.Err()
	}
}

func (s *failingBlockingSink) LoadCursor(context.Context) (int64, error) { return 0, nil }
func (s *failingBlockingSink) Persist(ctx context.Context, _ Batch) (int64, error) {
	close(s.started)
	select {
	case <-s.release:
		return 0, errors.New("persist failed")
	case <-ctx.Done():
		return 0, ctx.Err()
	}
}

func (s *memorySink) LoadCursor(context.Context) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cursor, nil
}

func (s *memorySink) Persist(_ context.Context, batch Batch) (int64, error) {
	s.mu.Lock()
	s.cursor = max(s.cursor, batch.Cursor)
	s.batches = append(s.batches, batch)
	s.mu.Unlock()
	select {
	case s.notify <- struct{}{}:
	default:
	}
	return s.cursor, nil
}

func TestSubscribeURLRewindsCursor(t *testing.T) {
	runner := Runner{Options: DefaultOptions()}
	if runner.Options.EventFlushInterval != time.Second || runner.Options.CursorFlushInterval != time.Minute {
		t.Fatalf(
			"unexpected flush intervals: event=%s cursor=%s",
			runner.Options.EventFlushInterval,
			runner.Options.CursorFlushInterval,
		)
	}
	rawURL, err := runner.subscribeURL("wss://example.com/subscribe", 10_000_000)
	if err != nil {
		t.Fatal(err)
	}
	parsed, _ := url.Parse(rawURL)
	if got := parsed.Query().Get("cursor"); got != "5000000" {
		t.Fatalf("cursor = %s", got)
	}
	if got := parsed.Query().Get("wantedCollections"); got != "uk.skyblur.post" {
		t.Fatalf("wantedCollections = %s", got)
	}
	if got := parsed.Query().Get("maxMessageSizeBytes"); got != "1048576" {
		t.Fatalf("maxMessageSizeBytes = %s", got)
	}
}

func TestRunnerReconnectsFromDurableCursorWithRewind(t *testing.T) {
	var (
		mu      sync.Mutex
		cursors []string
		calls   int
	)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		connection, err := websocket.Accept(response, request, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer connection.CloseNow()
		mu.Lock()
		calls++
		call := calls
		cursors = append(cursors, request.URL.Query().Get("cursor"))
		mu.Unlock()
		if call == 1 {
			event := map[string]any{
				"did": "did:plc:author", "time_us": int64(11_000_000), "kind": "commit",
				"commit": map[string]any{"rev": "rev", "operation": "create", "collection": "uk.skyblur.post", "rkey": "key", "record": map[string]any{"text": "hello"}},
			}
			payload, _ := json.Marshal(event)
			_ = connection.Write(request.Context(), websocket.MessageText, payload)
			_ = connection.Close(websocket.StatusInternalError, "test disconnect")
			return
		}
		<-request.Context().Done()
	}))
	defer server.Close()

	wsURL := "ws" + server.URL[len("http"):]
	sink := &memorySink{cursor: 10_000_000, notify: make(chan struct{}, 2)}
	options := DefaultOptions()
	options.Endpoints = []string{wsURL, wsURL}
	options.EventFlushInterval = time.Millisecond
	options.PingInterval = time.Second
	options.RetryMin = time.Millisecond
	options.RetryMax = 5 * time.Millisecond
	runner := &Runner{Options: options, Sink: sink, HTTPClient: server.Client()}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	done := make(chan error, 1)
	go func() { done <- runner.Run(ctx) }()

	select {
	case <-sink.notify:
	case <-ctx.Done():
		t.Fatal("event was not persisted")
	}
	deadline := time.Now().Add(500 * time.Millisecond)
	for {
		mu.Lock()
		count := len(cursors)
		mu.Unlock()
		if count >= 2 || time.Now().After(deadline) {
			break
		}
		time.Sleep(time.Millisecond)
	}
	cancel()
	if err := <-done; err != nil && !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}

	mu.Lock()
	defer mu.Unlock()
	if len(cursors) < 2 {
		t.Fatalf("connections = %d", len(cursors))
	}
	if cursors[0] != "5000000" {
		t.Fatalf("first cursor = %s", cursors[0])
	}
	if cursors[1] != "6000000" {
		t.Fatalf("second cursor = %s", cursors[1])
	}
}

func TestReadFramesAppliesBackpressureWhenQueueIsFull(t *testing.T) {
	written := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		connection, err := websocket.Accept(response, request, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer connection.CloseNow()
		for cursor := int64(100); cursor <= 101; cursor++ {
			payload, _ := json.Marshal(map[string]any{
				"did": "did:plc:author", "time_us": cursor, "kind": "identity",
			})
			if err := connection.Write(request.Context(), websocket.MessageText, payload); err != nil {
				return
			}
		}
		close(written)
		<-request.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	connection, _, err := websocket.Dial(ctx, "ws"+server.URL[len("http"):], &websocket.DialOptions{HTTPClient: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	defer connection.CloseNow()
	frames := make(chan Frame, 1)
	done := make(chan error, 1)
	runner := &Runner{Options: DefaultOptions()}
	go func() { done <- runner.readFrames(ctx, connection, frames) }()

	select {
	case <-written:
	case <-time.After(time.Second):
		t.Fatal("server did not write burst")
	}
	deadline := time.Now().Add(time.Second)
	for len(frames) != cap(frames) && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if len(frames) != cap(frames) {
		t.Fatal("frame queue did not fill")
	}
	select {
	case err := <-done:
		t.Fatalf("reader exited instead of applying backpressure: %v", err)
	case <-time.After(20 * time.Millisecond):
	}

	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestRunSessionCancelsBackpressuredReaderWhenPersistFails(t *testing.T) {
	written := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		connection, err := websocket.Accept(response, request, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer connection.CloseNow()
		for cursor := int64(100); cursor <= 103; cursor++ {
			payload, _ := json.Marshal(map[string]any{
				"did": "did:plc:author", "time_us": cursor, "kind": "commit",
				"commit": map[string]any{
					"rev": "rev", "operation": "create", "collection": "uk.skyblur.post",
					"rkey": "key", "record": map[string]any{"text": "hello"},
				},
			})
			if err := connection.Write(request.Context(), websocket.MessageText, payload); err != nil {
				return
			}
		}
		close(written)
		<-request.Context().Done()
	}))
	defer server.Close()

	sink := &failingBlockingSink{started: make(chan struct{}), release: make(chan struct{})}
	options := DefaultOptions()
	options.QueueCapacity = 1
	options.MaxBatchEvents = 1
	runner := &Runner{Options: options, Sink: sink, HTTPClient: server.Client()}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- runner.runSession(ctx, "ws"+server.URL[len("http"):], 0) }()

	select {
	case <-sink.started:
	case <-ctx.Done():
		t.Fatal("persist did not start")
	}
	select {
	case <-written:
	case <-ctx.Done():
		t.Fatal("server did not write burst")
	}
	close(sink.release)
	select {
	case err := <-done:
		if err == nil || err.Error() != "persist Jetstream batch: persist failed" {
			t.Fatalf("unexpected session result: %v", err)
		}
	case <-ctx.Done():
		t.Fatal("session deadlocked after persistence failure")
	}
}

func TestPersistFramesSplitsBatchByBytes(t *testing.T) {
	sink := &memorySink{notify: make(chan struct{}, 2)}
	options := DefaultOptions()
	options.MaxBatchBytes = 10
	options.EventFlushInterval = time.Hour
	options.CursorFlushInterval = time.Hour
	runner := &Runner{Options: options, Sink: sink}
	frames := make(chan Frame, 2)
	frames <- Frame{Cursor: 100, Event: &Event{EventID: "one"}, Size: 8}
	frames <- Frame{Cursor: 101, Event: &Event{EventID: "two"}, Size: 8}
	close(frames)

	if err := runner.persistFrames(context.Background(), frames); err != nil {
		t.Fatal(err)
	}
	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.batches) != 2 {
		t.Fatalf("batches = %d", len(sink.batches))
	}
	if sink.batches[0].Cursor != 100 || sink.batches[1].Cursor != 101 {
		t.Fatalf("unexpected cursors: %+v", sink.batches)
	}
}

func TestPersistFramesKeepsMaximumCursorWhenFramesArriveOutOfOrder(t *testing.T) {
	sink := &memorySink{notify: make(chan struct{}, 1)}
	options := DefaultOptions()
	options.EventFlushInterval = time.Hour
	options.CursorFlushInterval = time.Hour
	runner := &Runner{Options: options, Sink: sink}
	frames := make(chan Frame, 2)
	frames <- Frame{Cursor: 200, Event: &Event{EventID: "one"}, Size: 8}
	frames <- Frame{Cursor: 190, Event: &Event{EventID: "two"}, Size: 8}
	close(frames)

	if err := runner.persistFrames(context.Background(), frames); err != nil {
		t.Fatal(err)
	}
	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.batches) != 1 || sink.batches[0].Cursor != 200 {
		t.Fatalf("unexpected batches: %+v", sink.batches)
	}
}

func TestPersistFramesDelaysCursorOnlyCheckpointUntilCursorInterval(t *testing.T) {
	sink := &memorySink{notify: make(chan struct{}, 1)}
	options := DefaultOptions()
	options.EventFlushInterval = 10 * time.Millisecond
	options.CursorFlushInterval = 80 * time.Millisecond
	runner := &Runner{Options: options, Sink: sink}
	frames := make(chan Frame, 1)
	done := make(chan error, 1)
	go func() { done <- runner.persistFrames(context.Background(), frames) }()

	frames <- Frame{Cursor: 100}
	select {
	case <-sink.notify:
		t.Fatal("cursor-only frame was persisted at the event interval")
	case <-time.After(40 * time.Millisecond):
	}

	select {
	case <-sink.notify:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("cursor-only frame was not persisted at the cursor interval")
	}
	close(frames)
	if err := <-done; err != nil {
		t.Fatal(err)
	}

	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.batches) != 1 || sink.batches[0].Cursor != 100 || len(sink.batches[0].Events) != 0 {
		t.Fatalf("unexpected cursor-only batches: %+v", sink.batches)
	}
}

func TestPersistFramesFlushesWantedEventAtEventInterval(t *testing.T) {
	sink := &memorySink{notify: make(chan struct{}, 1)}
	options := DefaultOptions()
	options.EventFlushInterval = 20 * time.Millisecond
	options.CursorFlushInterval = time.Hour
	runner := &Runner{Options: options, Sink: sink}
	frames := make(chan Frame, 1)
	done := make(chan error, 1)
	go func() { done <- runner.persistFrames(context.Background(), frames) }()

	frames <- Frame{Cursor: 100, Event: &Event{EventID: "wanted"}, Size: 10}
	select {
	case <-sink.notify:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("wanted event was not persisted at the event interval")
	}
	close(frames)
	if err := <-done; err != nil {
		t.Fatal(err)
	}

	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.batches) != 1 || len(sink.batches[0].Events) != 1 {
		t.Fatalf("unexpected event batches: %+v", sink.batches)
	}
}

func TestPersistFramesFlushesQuarantineAtEventInterval(t *testing.T) {
	sink := &memorySink{notify: make(chan struct{}, 1)}
	options := DefaultOptions()
	options.EventFlushInterval = 20 * time.Millisecond
	options.CursorFlushInterval = time.Hour
	runner := &Runner{Options: options, Sink: sink}
	frames := make(chan Frame, 1)
	done := make(chan error, 1)
	go func() { done <- runner.persistFrames(context.Background(), frames) }()

	frames <- Frame{
		Cursor:     100,
		Quarantine: &Quarantine{Cursor: 100, Hash: "hash", Reason: "invalid_record"},
		Size:       10,
	}
	select {
	case <-sink.notify:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("quarantine was not persisted at the event interval")
	}
	close(frames)
	if err := <-done; err != nil {
		t.Fatal(err)
	}

	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.batches) != 1 || len(sink.batches[0].Quarantined) != 1 {
		t.Fatalf("unexpected quarantine batches: %+v", sink.batches)
	}
}

func TestPersistFramesFlushesCursorOnlyOnStreamClose(t *testing.T) {
	sink := &memorySink{notify: make(chan struct{}, 1)}
	options := DefaultOptions()
	options.EventFlushInterval = time.Hour
	options.CursorFlushInterval = time.Hour
	runner := &Runner{Options: options, Sink: sink}
	frames := make(chan Frame, 1)
	frames <- Frame{Cursor: 100}
	close(frames)

	if err := runner.persistFrames(context.Background(), frames); err != nil {
		t.Fatal(err)
	}

	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.batches) != 1 || sink.batches[0].Cursor != 100 {
		t.Fatalf("cursor-only close did not flush: %+v", sink.batches)
	}
}

func TestPersistFramesFlushesImmediatelyAtBatchLimit(t *testing.T) {
	sink := &memorySink{notify: make(chan struct{}, 1)}
	options := DefaultOptions()
	options.MaxBatchEvents = 2
	options.EventFlushInterval = time.Hour
	options.CursorFlushInterval = time.Hour
	runner := &Runner{Options: options, Sink: sink}
	frames := make(chan Frame, 2)
	done := make(chan error, 1)
	go func() { done <- runner.persistFrames(context.Background(), frames) }()

	frames <- Frame{Cursor: 100, Event: &Event{EventID: "one"}, Size: 10}
	frames <- Frame{Cursor: 101, Event: &Event{EventID: "two"}, Size: 10}
	select {
	case <-sink.notify:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("full batch was not persisted immediately")
	}
	close(frames)
	if err := <-done; err != nil {
		t.Fatal(err)
	}

	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.batches) != 1 || len(sink.batches[0].Events) != 2 || sink.batches[0].Cursor != 101 {
		t.Fatalf("unexpected full batch: %+v", sink.batches)
	}
}

func TestPersistFramesFlushesImmediatelyAtExactByteLimit(t *testing.T) {
	sink := &memorySink{notify: make(chan struct{}, 1)}
	options := DefaultOptions()
	options.MaxBatchBytes = 10
	options.EventFlushInterval = time.Hour
	options.CursorFlushInterval = time.Hour
	runner := &Runner{Options: options, Sink: sink}
	frames := make(chan Frame, 2)
	done := make(chan error, 1)
	go func() { done <- runner.persistFrames(context.Background(), frames) }()

	frames <- Frame{Cursor: 99}
	frames <- Frame{Cursor: 100, Event: &Event{EventID: "exact"}, Size: 10}
	select {
	case <-sink.notify:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("exact byte-limit batch was not persisted immediately")
	}
	close(frames)
	if err := <-done; err != nil {
		t.Fatal(err)
	}

	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.batches) != 1 || sink.batches[0].Cursor != 100 || len(sink.batches[0].Events) != 1 {
		t.Fatalf("unexpected exact-limit batch: %+v", sink.batches)
	}
}

func TestPersistFramesRejectsUnsafeCursorResponse(t *testing.T) {
	options := DefaultOptions()
	runner := &Runner{Options: options, Sink: fixedSink{committed: 201}}
	runner.committed.Store(100)
	frames := make(chan Frame, 1)
	frames <- Frame{Cursor: 200, Event: &Event{EventID: "event"}, Size: 10}
	close(frames)

	err := runner.persistFrames(context.Background(), frames)
	if err == nil || !isPermanent(err) {
		t.Fatalf("expected permanent cursor error, got %v", err)
	}
}

func TestRunnerRejectsFutureDurableCursor(t *testing.T) {
	options := DefaultOptions()
	options.Endpoints = []string{"ws://127.0.0.1/unused"}
	runner := &Runner{
		Options: options,
		Sink: fixedSink{
			loaded: time.Now().Add(options.MaxFutureCursor + time.Minute).UnixMicro(),
		},
	}
	err := runner.Run(context.Background())
	if err == nil {
		t.Fatal("future cursor was accepted")
	}
}

func TestRunnerDrainsInFlightBatchOnShutdown(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		connection, err := websocket.Accept(response, request, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer connection.CloseNow()
		event := map[string]any{
			"did": "did:plc:author", "time_us": int64(11_000_000), "kind": "commit",
			"commit": map[string]any{"rev": "rev", "operation": "create", "collection": "uk.skyblur.post", "rkey": "key", "record": map[string]any{"text": "hello"}},
		}
		payload, _ := json.Marshal(event)
		if err := connection.Write(request.Context(), websocket.MessageText, payload); err != nil {
			t.Error(err)
			return
		}
		<-request.Context().Done()
	}))
	defer server.Close()

	wsURL := "ws" + server.URL[len("http"):]
	sink := &blockingSink{started: make(chan struct{}), release: make(chan struct{})}
	options := DefaultOptions()
	options.Endpoints = []string{wsURL}
	options.EventFlushInterval = time.Millisecond
	options.ShutdownGrace = time.Second
	runner := &Runner{Options: options, Sink: sink, HTTPClient: server.Client()}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- runner.Run(ctx) }()

	select {
	case <-sink.started:
	case <-time.After(time.Second):
		t.Fatal("persist did not start")
	}
	cancel()
	select {
	case err := <-done:
		t.Fatalf("consumer exited before in-flight persist completed: %v", err)
	case <-time.After(20 * time.Millisecond):
	}
	close(sink.release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestRunnerReconnectsWhenStreamIsIdle(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		connection, err := websocket.Accept(response, request, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer connection.CloseNow()
		calls.Add(1)
		<-request.Context().Done()
	}))
	defer server.Close()

	options := DefaultOptions()
	options.Endpoints = []string{"ws" + server.URL[len("http"):]}
	options.IdleTimeout = 20 * time.Millisecond
	options.PingInterval = time.Second
	options.RetryMin = time.Millisecond
	options.RetryMax = 2 * time.Millisecond
	runner := &Runner{Options: options, Sink: &memorySink{notify: make(chan struct{}, 1)}, HTTPClient: server.Client()}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	done := make(chan error, 1)
	go func() { done <- runner.Run(ctx) }()
	deadline := time.Now().Add(500 * time.Millisecond)
	for calls.Load() < 2 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if calls.Load() < 2 {
		t.Fatalf("idle connection was not replaced; calls=%d", calls.Load())
	}
}
