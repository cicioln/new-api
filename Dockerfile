# syntax=docker/dockerfile:1

# Frontend assets are platform independent, so build them once on the build host.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.0@sha256:5ff609364c049b54eb0ff560ec96319729a972078ef2c755d758f0c6ef89c2d6 AS web
ARG APP_VERSION=dev
WORKDIR /build/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION="${APP_VERSION}" bun run build

# Cross-compile the Go binary on the build host for the target platform.
FROM --platform=$BUILDPLATFORM golang:1.26.10-alpine@sha256:9ce231b28998b32e116927c61aa5c406183061d4f3f2d61b292c88e7f6bdf7ca AS server
ARG APP_VERSION=dev
ARG TARGETOS=linux
ARG TARGETARCH=amd64
ENV CGO_ENABLED=0 GOWORK=off GOOS=${TARGETOS} GOARCH=${TARGETARCH} GOEXPERIMENT=greenteagc
WORKDIR /build
COPY go.mod go.sum ./
# relaykit and tokenkit are local modules referenced via replace.
COPY relaykit/go.mod ./relaykit/go.mod
COPY tokenkit/go.mod ./tokenkit/go.mod
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
COPY --from=web /build/web/dist ./web/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build \
      -pgo="$(go list -m -f '{{.Dir}}' github.com/Calcium-Ion/moejs)/default.pgo" \
      -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=${APP_VERSION}'" \
      -o /out/new-api

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata libasan8 wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates
COPY --from=server /out/new-api /new-api
COPY LICENSE NOTICE THIRD-PARTY-LICENSES.md /licenses/
ENV TZ=Asia/Shanghai
EXPOSE 3000
WORKDIR /data
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -q -O - http://localhost:3000/api/status | grep -q '"success":true' || exit 1
ENTRYPOINT ["/new-api"]
