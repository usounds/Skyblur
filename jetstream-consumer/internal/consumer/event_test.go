package consumer

import (
	"fmt"
	"testing"
	"time"
)

func TestParseFramePreservesMicroseconds(t *testing.T) {
	message := []byte(`{"did":"did:plc:author","time_us":1784214110241123,"kind":"commit","commit":{"rev":"3mqrhiyovtkyz","operation":"create","collection":"uk.skyblur.post","rkey":"3mqrhiyovtkyz","cid":"bafyrecord","record":{"$type":"uk.skyblur.post","text":"hello"}}}`)
	frame, err := ParseFrame(message, "uk.skyblur.post")
	if err != nil {
		t.Fatal(err)
	}
	if frame.Cursor != 1784214110241123 {
		t.Fatalf("cursor was rounded: %d", frame.Cursor)
	}
	if frame.Event == nil || frame.Event.EventID == "" {
		t.Fatal("wanted commit was not emitted")
	}
}

func TestParseFrameRejectsFutureCursor(t *testing.T) {
	message := []byte(fmt.Sprintf(
		`{"did":"did:plc:author","time_us":%d,"kind":"identity"}`,
		time.Now().Add(6*time.Minute).UnixMicro(),
	))
	if _, err := ParseFrame(message, "uk.skyblur.post"); err == nil {
		t.Fatal("future cursor was accepted")
	}
}

func TestParseFrameIgnoresNonCommitAndOtherCollection(t *testing.T) {
	tests := [][]byte{
		[]byte(`{"did":"did:plc:author","time_us":100,"kind":"identity","identity":{"did":"did:plc:author"}}`),
		[]byte(`{"did":"did:plc:author","time_us":101,"kind":"commit","commit":{"rev":"rev","operation":"create","collection":"app.bsky.feed.post","rkey":"key","record":{"text":"hello"}}}`),
	}
	for _, message := range tests {
		frame, err := ParseFrame(message, "uk.skyblur.post")
		if err != nil {
			t.Fatal(err)
		}
		if frame.Event != nil {
			t.Fatal("unexpected event")
		}
		if frame.Cursor == 0 {
			t.Fatal("ignored frame must still advance the observed cursor")
		}
	}
}

func TestCanonicalEventIDIsReplayStable(t *testing.T) {
	message := []byte(`{"did":"did:plc:author","time_us":100,"kind":"commit","commit":{"rev":"rev","operation":"delete","collection":"uk.skyblur.post","rkey":"key"}}`)
	first, err := ParseFrame(message, "uk.skyblur.post")
	if err != nil {
		t.Fatal(err)
	}
	second, err := ParseFrame(message, "uk.skyblur.post")
	if err != nil {
		t.Fatal(err)
	}
	if first.Event.EventID != second.Event.EventID {
		t.Fatalf("event IDs differ: %s != %s", first.Event.EventID, second.Event.EventID)
	}
}

func TestParseFrameRejectsInvalidWantedRecord(t *testing.T) {
	tests := [][]byte{
		[]byte(`{"did":"did:plc:author","time_us":100,"kind":"commit","commit":{"rev":"rev","operation":"create","collection":"uk.skyblur.post","rkey":"key","record":null}}`),
		[]byte(`{"did":"did:plc:author","time_us":100,"kind":"commit","commit":{"rev":"rev","operation":"create","collection":"uk.skyblur.post","rkey":"key","record":{"$type":"app.bsky.feed.post"}}}`),
	}
	for _, message := range tests {
		frame, err := ParseFrame(message, "uk.skyblur.post")
		if err != nil {
			t.Fatal(err)
		}
		if frame.Event != nil || frame.Quarantine == nil || frame.Quarantine.Hash == "" {
			t.Fatal("invalid wanted record was not quarantined")
		}
		if frame.Quarantine.DID != "did:plc:author" || frame.Quarantine.Collection != "uk.skyblur.post" || frame.Quarantine.RKey != "key" {
			t.Fatalf("quarantine lost repair identifiers: %+v", frame.Quarantine)
		}
	}
}
