FROM golang:1.26.4-alpine AS build

RUN apk add --no-cache ca-certificates
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/skyblur-jetstream ./cmd/skyblur-jetstream

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/skyblur-jetstream /skyblur-jetstream
USER 65532:65532
ENV GOMEMLIMIT=192MiB
ENV GOGC=50
ENTRYPOINT ["/skyblur-jetstream"]
