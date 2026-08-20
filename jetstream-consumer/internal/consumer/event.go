package consumer

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidEvent = errors.New("invalid Jetstream event")

const maxFutureCursor = 5 * time.Minute

type Commit struct {
	Rev        string          `json:"rev,omitempty"`
	Operation  string          `json:"operation"`
	Collection string          `json:"collection"`
	RKey       string          `json:"rkey"`
	CID        string          `json:"cid,omitempty"`
	Record     json.RawMessage `json:"record,omitempty"`
}

type Event struct {
	EventID string `json:"eventId"`
	DID     string `json:"did"`
	TimeUS  int64  `json:"timeUs"`
	Kind    string `json:"kind"`
	Commit  Commit `json:"commit"`
}

type Frame struct {
	Cursor     int64
	Event      *Event
	Quarantine *Quarantine
	Size       int
}

type Quarantine struct {
	Cursor     int64  `json:"cursor"`
	Hash       string `json:"hash"`
	Reason     string `json:"reason"`
	DID        string `json:"did,omitempty"`
	Collection string `json:"collection,omitempty"`
	RKey       string `json:"rkey,omitempty"`
}

type envelope struct {
	DID    string  `json:"did"`
	TimeUS int64   `json:"time_us"`
	Kind   string  `json:"kind"`
	Commit *Commit `json:"commit,omitempty"`
}

func ParseFrame(message []byte, wantedCollection string) (Frame, error) {
	var raw envelope
	if err := json.Unmarshal(message, &raw); err != nil {
		return Frame{}, errors.Join(ErrInvalidEvent, err)
	}
	if raw.TimeUS <= 0 || raw.TimeUS > time.Now().Add(maxFutureCursor).UnixMicro() {
		return Frame{}, ErrInvalidEvent
	}

	frame := Frame{Cursor: raw.TimeUS, Size: len(message)}
	quarantine := func(reason string) (Frame, error) {
		sum := sha256.Sum256(message)
		frame.Quarantine = &Quarantine{
			Cursor:     raw.TimeUS,
			Hash:       hex.EncodeToString(sum[:]),
			Reason:     reason,
			DID:        raw.DID,
			Collection: commitCollection(raw.Commit),
			RKey:       commitRKey(raw.Commit),
		}
		return frame, nil
	}
	if raw.DID == "" || raw.Kind == "" {
		return quarantine("invalid_envelope")
	}
	if raw.Kind != "commit" {
		return frame, nil
	}
	if raw.Commit == nil || raw.Commit.Collection == "" || raw.Commit.RKey == "" ||
		!validOperation(raw.Commit.Operation) {
		return quarantine("invalid_commit")
	}
	if raw.Commit.Collection != wantedCollection {
		return frame, nil
	}
	if raw.Commit.Operation != "delete" && !validRecord(raw.Commit.Record, wantedCollection) {
		return quarantine("invalid_record")
	}

	event := Event{
		DID:    raw.DID,
		TimeUS: raw.TimeUS,
		Kind:   raw.Kind,
		Commit: *raw.Commit,
	}
	event.EventID = canonicalEventID(event)
	frame.Event = &event
	return frame, nil
}

func commitCollection(commit *Commit) string {
	if commit == nil {
		return ""
	}
	return commit.Collection
}

func commitRKey(commit *Commit) string {
	if commit == nil {
		return ""
	}
	return commit.RKey
}

func validRecord(record json.RawMessage, wantedCollection string) bool {
	if len(record) == 0 {
		return false
	}
	var value map[string]json.RawMessage
	if err := json.Unmarshal(record, &value); err != nil || value == nil {
		return false
	}
	if rawType, ok := value["$type"]; ok {
		var recordType string
		if err := json.Unmarshal(rawType, &recordType); err != nil || recordType != wantedCollection {
			return false
		}
	}
	return true
}

func canonicalEventID(event Event) string {
	parts := []string{
		event.DID,
		event.Commit.Collection,
		event.Commit.RKey,
		event.Commit.Operation,
		event.Commit.Rev,
		event.Commit.CID,
	}
	if event.Commit.Rev == "" {
		parts = append(parts, strconv.FormatInt(event.TimeUS, 10))
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\n")))
	return "jetstream:" + hex.EncodeToString(sum[:])
}

func validOperation(operation string) bool {
	return operation == "create" || operation == "update" || operation == "delete"
}
