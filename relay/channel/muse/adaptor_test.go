package muse

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatPromptFlattensConversation(t *testing.T) {
	cases := []struct {
		name     string
		messages []dto.Message
		want     string
	}{
		{
			name:     "single user message is sent unchanged",
			messages: []dto.Message{{Role: "user", Content: "hello"}},
			want:     "hello",
		},
		{
			name: "conversation becomes a transcript",
			messages: []dto.Message{
				{Role: "system", Content: "be brief"},
				{Role: "user", Content: "hi"},
				{Role: "assistant", Content: "hello"},
				{Role: "user", Content: "bye"},
			},
			want: "System: be brief\n\nUser: hi\n\nAssistant: hello\n\nUser: bye",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			prompt, refs, apiErr := chatPrompt(nil, tc.messages)
			require.Nil(t, apiErr)
			assert.Empty(t, refs)
			assert.Equal(t, tc.want, prompt)
		})
	}
}

func TestRelayErrorClassification(t *testing.T) {
	cases := []struct {
		name      string
		err       error
		streamed  bool
		status    int
		skipRetry bool
	}{
		{"auth error disables the key", &musesdk.Error{Kind: musesdk.KindAuth}, false, 401, false},
		{"rate limit tries another channel", &musesdk.Error{Kind: musesdk.KindRateLimit}, false, 429, false},
		{"bad request is not retried", &musesdk.Error{Kind: musesdk.KindBadRequest}, false, 400, true},
		{"turn that may have run is not retried", &musesdk.NoRetry{Err: &musesdk.Error{Kind: musesdk.KindTransient}}, false, 502, true},
		{"failure after streaming is not retried", &musesdk.Error{Kind: musesdk.KindTransient}, true, 502, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			apiErr := relayError(tc.err, tc.streamed)
			assert.Equal(t, tc.status, apiErr.StatusCode)
			assert.Equal(t, tc.skipRetry, types.IsSkipRetryError(apiErr))
		})
	}
}

func TestImageInOutputFormat(t *testing.T) {
	// A 1×1 lossless WebP, the format Muse returns.
	webpImage, err := base64.StdEncoding.DecodeString("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==")
	require.NoError(t, err)
	require.Equal(t, "image/webp", http.DetectContentType(webpImage))

	tests := []struct {
		name   string
		format json.RawMessage
		raw    []byte
		want   string
	}{
		{name: "default is png", raw: webpImage, want: "image/png"},
		{name: "explicit png", format: json.RawMessage(`"png"`), raw: webpImage, want: "image/png"},
		{name: "jpeg", format: json.RawMessage(`"jpeg"`), raw: webpImage, want: "image/jpeg"},
		{name: "jpg alias", format: json.RawMessage(`"JPG"`), raw: webpImage, want: "image/jpeg"},
		{name: "webp kept", format: json.RawMessage(`"webp"`), raw: webpImage, want: "image/webp"},
		{name: "undecodable kept", raw: []byte("not an image"), want: "text/plain; charset=utf-8"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, http.DetectContentType(imageInOutputFormat(tt.raw, tt.format)))
		})
	}
	assert.Equal(t, webpImage, imageInOutputFormat(webpImage, json.RawMessage(`"webp"`)))
}
