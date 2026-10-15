package middleware_test

import (
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUsageReportingResponseAndAccounting(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	original := *settings
	t.Cleanup(func() { *settings = original })
	for _, tc := range []struct {
		name, path, header, value string
		passthrough               bool
		ratio                     float64
		want                      int
	}{
		{name: "default scales JSON", path: "/v1/chat/completions", ratio: 0.6657, want: 6657},
		{name: "custom coefficient", path: "/v1/responses", ratio: 0.5, want: 5000},
		{name: "coefficient above one", path: "/v1/responses", ratio: 1.5, want: 15000},
		{name: "passthrough ignores coefficient", path: "/v1/messages", passthrough: true, ratio: 0.5, want: 10000},
		{name: "Claude Code uses the same switch", path: "/v1/messages", header: "User-Agent", value: "claude-cli/2.1.90 (external, cli)", ratio: 0.5, want: 5000},
		{name: "Codex CLI uses the same switch", path: "/v1/responses", header: "User-Agent", value: "codex_cli_rs/0.150.1", ratio: 0.5, want: 5000},
		{name: "Codex IDE uses the same switch", path: "/v1/responses", header: "originator", value: "codex_vscode", ratio: 0.5, want: 5000},
		{name: "counting endpoint unchanged", path: "/v1/messages/count_tokens", ratio: 0.5, want: 10000},
		{name: "management usage unchanged", path: "/api/usage", ratio: 0.5, want: 10000},
		{name: "invalid persisted ratio falls back", path: "/v1/messages", ratio: math.NaN(), want: 6657},
	} {
		t.Run(tc.name, func(t *testing.T) {
			settings.UsagePassthroughEnabled = tc.passthrough
			settings.UsageDisplayRatio = tc.ratio
			router := gin.New()
			router.Use(middleware.UsageReporting())
			upstream := gin.H{"prompt_tokens": 10000, "completion_tokens": 1000, "total_tokens": 11000}
			router.POST(tc.path, func(c *gin.Context) {
				c.Header("Content-Length", "9999")
				c.JSON(200, gin.H{"usage": upstream, "id": "9007199254740993", "choices": []any{gin.H{"usage": upstream}}})
				// The handler's accounting facts never see the displayed values.
				assert.Equal(t, 10000, upstream["prompt_tokens"])
			})
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, tc.path, nil)
			if tc.header != "" {
				request.Header.Set(tc.header, tc.value)
			}
			router.ServeHTTP(recorder, request)
			require.Equal(t, 200, recorder.Code)
			var body struct {
				Usage struct {
					PromptTokens int `json:"prompt_tokens"`
				} `json:"usage"`
				ID      string `json:"id"`
				Choices []struct {
					Usage struct {
						PromptTokens int `json:"prompt_tokens"`
					} `json:"usage"`
				} `json:"choices"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
			assert.Equal(t, tc.want, body.Usage.PromptTokens)
			assert.Equal(t, 10000, body.Choices[0].Usage.PromptTokens)
			assert.Equal(t, "9007199254740993", body.ID)
			if tc.want != 10000 {
				assert.Empty(t, recorder.Header().Get("Content-Length"))
			}
		})
	}
}

func TestUsageReportingProtocolDetails(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	original := *settings
	t.Cleanup(func() { *settings = original })
	settings.UsagePassthroughEnabled, settings.UsageDisplayRatio = false, 0.5
	for _, tc := range []struct{ name, input, want string }{
		{"OpenAI rounding and details", `{"usage":{"prompt_tokens":3,"completion_tokens":3,"total_tokens":6,"prompt_tokens_details":{"cached_tokens":2},"cost":0.12}}`, `{"usage":{"prompt_tokens":2,"completion_tokens":2,"total_tokens":4,"prompt_tokens_details":{"cached_tokens":1},"cost":0.12}}`},
		{"Anthropic cache TTLs", `{"usage":{"input_tokens":100,"output_tokens":20,"cache_read_input_tokens":80,"cache_creation_input_tokens":40,"cache_creation":{"ephemeral_5m_input_tokens":30,"ephemeral_1h_input_tokens":10}}}`, `{"usage":{"input_tokens":50,"output_tokens":10,"cache_read_input_tokens":40,"cache_creation_input_tokens":20,"cache_creation":{"ephemeral_5m_input_tokens":15,"ephemeral_1h_input_tokens":5}}}`},
		{"Responses envelope", `{"type":"response.completed","response":{"usage":{"input_tokens":100,"output_tokens":20,"total_tokens":120},"output":[{"usage":{"input_tokens":100}}]}}`, `{"type":"response.completed","response":{"usage":{"input_tokens":50,"output_tokens":10,"total_tokens":60},"output":[{"usage":{"input_tokens":100}}]}}`},
		{"Responses null error is successful", `{"type":"response.completed","response":{"error":null,"usage":{"input_tokens":100,"output_tokens":20,"total_tokens":120}}}`, `{"type":"response.completed","response":{"error":null,"usage":{"input_tokens":50,"output_tokens":10,"total_tokens":60}}}`},
		{"Gemini modality counts", `{"usageMetadata":{"promptTokenCount":100,"candidatesTokenCount":20,"totalTokenCount":120,"promptTokensDetails":[{"modality":"TEXT","tokenCount":100}]}}`, `{"usageMetadata":{"promptTokenCount":50,"candidatesTokenCount":10,"totalTokenCount":60,"promptTokensDetails":[{"modality":"TEXT","tokenCount":50}]}}`},
		{"missing usage stays absent", `{"choices":[{"delta":{"content":"hello"}}]}`, `{"choices":[{"delta":{"content":"hello"}}]}`},
		{"errors unchanged", `{"error":{"message":"failed"},"usage":{"input_tokens":100}}`, `{"error":{"message":"failed"},"usage":{"input_tokens":100}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.Use(middleware.UsageReporting())
			router.POST("/v1/responses", func(c *gin.Context) {
				c.Header("Content-Type", "application/json")
				// Non-streaming responses may also arrive in multiple writes.
				_, err := c.Writer.WriteString(tc.input[:len(tc.input)/2])
				require.NoError(t, err)
				_, err = c.Writer.WriteString(tc.input[len(tc.input)/2:])
				require.NoError(t, err)
			})
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/v1/responses", nil))
			assert.JSONEq(t, tc.want, recorder.Body.String())
		})
	}
}

func TestUsageReportingStreamsForAllClients(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	original := *settings
	t.Cleanup(func() { *settings = original })
	for _, passthrough := range []bool{false, true} {
		for _, codexClient := range []bool{false, true} {
			t.Run(fmt.Sprintf("passthrough=%t/codexClient=%t", passthrough, codexClient), func(t *testing.T) {
				settings.UsagePassthroughEnabled, settings.UsageDisplayRatio = passthrough, 0.5
				router := gin.New()
				router.Use(middleware.UsageReporting())
				recorder := httptest.NewRecorder()
				start := `{"type":"message_start","message":{"usage":{"input_tokens":100000,"cache_read_input_tokens":80000,"cache_creation_input_tokens":20000}}}`
				delta := `{"type":"message_delta","usage":{"output_tokens":1000}}`
				router.POST("/v1/messages", func(c *gin.Context) {
					helper.SetEventStreamHeaders(c)
					require.NoError(t, helper.StringData(c, start))
					// A complete event must be delivered before the handler ends.
					assert.Contains(t, recorder.Body.String(), "message_start")
					require.NoError(t, helper.PingData(c))
					require.NoError(t, helper.StringData(c, delta))
					helper.Done(c)
				})
				request := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
				if codexClient {
					request.Header.Set("User-Agent", "codex_cli_rs/0.150.1")
				}
				router.ServeHTTP(recorder, request)
				body := recorder.Body.String()
				assert.Contains(t, body, ": PING\n\n")
				assert.True(t, strings.HasSuffix(body, "data: [DONE]\n\n"))
				if passthrough {
					assert.Contains(t, body, "data: "+start+"\n\n")
					assert.Contains(t, body, "data: "+delta+"\n\n")
				} else {
					assert.Contains(t, body, `"input_tokens":50000`)
					assert.Contains(t, body, `"cache_read_input_tokens":40000`)
					assert.Contains(t, body, `"cache_creation_input_tokens":10000`)
					assert.Contains(t, body, `"output_tokens":500`)
				}
			})
		}
	}
}

func TestUsageReportingSplitAndMultilineEvents(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	original := *settings
	t.Cleanup(func() { *settings = original })
	settings.UsagePassthroughEnabled, settings.UsageDisplayRatio = false, 0.5
	router := gin.New()
	router.Use(middleware.UsageReporting())
	recorder := httptest.NewRecorder()
	router.POST("/v1/messages", func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		for _, part := range []string{"event: message_delta\r\nid: 42\r\ndata: {\"usage\":\r\n", "data: {\"output_tokens\":20}}\r\n\r\n"} {
			_, err := c.Writer.WriteString(part)
			require.NoError(t, err)
			c.Writer.Flush()
		}
		assert.Contains(t, recorder.Body.String(), `"output_tokens":10`)
	})
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/v1/messages", nil))
	assert.Equal(t, "event: message_delta\r\nid: 42\r\ndata: {\"usage\":{\"output_tokens\":10}}\r\n\r\n", recorder.Body.String())
}
