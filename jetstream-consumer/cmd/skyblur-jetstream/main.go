package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"skyblur.uk/jetstream-consumer/internal/consumer"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	options := consumer.DefaultOptions()
	if endpoints := splitEnv("JETSTREAM_ENDPOINTS"); len(endpoints) > 0 {
		options.Endpoints = endpoints
	}
	if value := positiveIntEnv("JETSTREAM_MAX_MESSAGE_BYTES"); value > 0 {
		options.MaxMessageBytes = int64(value)
	}
	if value := positiveIntEnv("JETSTREAM_QUEUE_CAPACITY"); value > 0 {
		options.QueueCapacity = value
	}
	if value := positiveIntEnv("JETSTREAM_MAX_BATCH_BYTES"); value > 0 {
		options.MaxBatchBytes = value
	}

	ingestURL := os.Getenv("SKYBLUR_INGEST_URL")
	stateURL := os.Getenv("SKYBLUR_STATE_URL")
	secret := os.Getenv("SKYBLUR_INGEST_SECRET")
	if ingestURL == "" || stateURL == "" || secret == "" {
		logger.Error("SKYBLUR_INGEST_URL, SKYBLUR_STATE_URL, and SKYBLUR_INGEST_SECRET are required")
		os.Exit(2)
	}

	httpClient := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        4,
			MaxIdleConnsPerHost: 2,
			IdleConnTimeout:     90 * time.Second,
		},
	}
	sink := &consumer.HTTPSink{
		StateURL:  stateURL,
		IngestURL: ingestURL,
		Secret:    []byte(secret),
		Client:    httpClient,
	}
	runner := &consumer.Runner{
		Options:    options,
		Sink:       sink,
		HTTPClient: httpClient,
		Logger:     logger,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := runner.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		logger.Error("consumer stopped", "error", err)
		os.Exit(1)
	}
}

func splitEnv(name string) []string {
	var values []string
	for _, value := range strings.Split(os.Getenv(name), ",") {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}

func positiveIntEnv(name string) int {
	value, err := strconv.Atoi(os.Getenv(name))
	if err != nil || value <= 0 {
		return 0
	}
	return value
}
