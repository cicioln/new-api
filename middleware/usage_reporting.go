package middleware

import (
	"bytes"
	"math"
	"net/http"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
)

// UsageReporting changes only the serialized client response. Upstream DTOs,
// billing snapshots, logs and token-counting requests retain their original values.
func UsageReporting() gin.HandlerFunc {
	return func(c *gin.Context) {
		ratio := model_setting.GetGlobalSettings().GetUsageReportingRatio()
		path := c.Request.URL.Path
		textEndpoint := path == "/v1/messages" || path == "/v1/chat/completions" ||
			path == "/v1/completions" || path == "/pg/chat/completions" ||
			path == "/v1/responses" || strings.HasPrefix(path, "/v1/responses/") ||
			((strings.HasPrefix(path, "/v1/models/") || strings.HasPrefix(path, "/v1beta/models/")) &&
				(strings.HasSuffix(path, ":generateContent") || strings.HasSuffix(path, ":streamGenerateContent")))
		if !textEndpoint || ratio == 1 ||
			c.GetHeader("Upgrade") != "" ||
			(c.Request.Method != http.MethodPost && c.Request.Method != http.MethodGet) {
			c.Next()
			return
		}
		writer := &usageReportingWriter{ResponseWriter: c.Writer, ratio: ratio}
		c.Writer = writer
		defer func() {
			writer.finish()
			c.Writer = writer.ResponseWriter
		}()
		c.Next()
	}
}

type usageReportingWriter struct {
	gin.ResponseWriter
	mu      sync.Mutex
	ratio   float64
	pending []byte
}

func (w *usageReportingWriter) WriteHeaderNow() {
	// A serialized usage object can have a different byte length.
	w.Header().Del("Content-Length")
	w.ResponseWriter.WriteHeaderNow()
}

func (w *usageReportingWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.Status() < 200 || w.Status() >= 300 || w.Header().Get("Content-Encoding") != "" {
		return w.ResponseWriter.Write(data)
	}
	contentType := w.Header().Get("Content-Type")
	if !strings.HasPrefix(contentType, "application/json") && !strings.HasPrefix(contentType, "text/event-stream") {
		return w.ResponseWriter.Write(data)
	}
	w.WriteHeaderNow()
	w.pending = append(w.pending, data...)
	if strings.HasPrefix(contentType, "text/event-stream") {
		for {
			// An SSE event ends at an empty line (LF or CRLF).
			end := bytes.Index(w.pending, []byte("\n\n"))
			length := 2
			if crlf := bytes.Index(w.pending, []byte("\r\n\r\n")); crlf >= 0 && (end < 0 || crlf < end) {
				end, length = crlf, 4
			}
			if end < 0 {
				break
			}
			frame := w.pending[:end+length]
			if _, err := w.ResponseWriter.Write(scaleUsageEvent(frame, w.ratio)); err != nil {
				return 0, err
			}
			w.pending = w.pending[end+length:]
		}
	}
	return len(data), nil
}

func (w *usageReportingWriter) WriteString(data string) (int, error) {
	return w.Write([]byte(data))
}

func (w *usageReportingWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	// Partial events stay buffered; complete events are already forwarded.
	w.WriteHeaderNow()
	w.ResponseWriter.Flush()
}

func (w *usageReportingWriter) finish() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if len(w.pending) == 0 {
		return
	}
	data := w.pending
	if strings.HasPrefix(w.Header().Get("Content-Type"), "application/json") {
		data = ScaleResponseUsage(data, w.ratio)
	} else {
		data = scaleUsageEvent(data, w.ratio)
	}
	if _, err := w.ResponseWriter.Write(data); err != nil {
		common.SysError("failed to write usage reporting response: " + err.Error())
	}
	w.pending = nil
}

func scaleUsageEvent(frame []byte, ratio float64) []byte {
	lines := bytes.Split(frame, []byte("\n"))
	var payload []byte
	first := -1
	for i, line := range lines {
		line = bytes.TrimSuffix(line, []byte("\r"))
		if value, ok := bytes.CutPrefix(line, []byte("data:")); ok {
			if first < 0 {
				first = i
			} else {
				payload = append(payload, '\n')
			}
			payload = append(payload, bytes.TrimPrefix(value, []byte(" "))...)
		}
	}
	if first < 0 {
		return frame
	}
	scaled := ScaleResponseUsage(payload, ratio)
	if bytes.Equal(payload, scaled) {
		return frame
	}
	var result bytes.Buffer
	for i, line := range lines {
		if bytes.HasPrefix(line, []byte("data:")) {
			if i != first {
				continue
			}
			result.WriteString("data: ")
			result.Write(scaled)
			if bytes.HasSuffix(line, []byte("\r")) {
				result.WriteByte('\r')
			}
		} else {
			result.Write(line)
		}
		if i < len(lines)-1 {
			result.WriteByte('\n')
		}
	}
	return result.Bytes()
}

// ScaleResponseUsage is shared by HTTP/SSE and Responses WebSocket output.
// It creates new serialized data and never changes the upstream accounting body.
func ScaleResponseUsage(data []byte, ratio float64) []byte {
	if ratio == 1 || !model_setting.ValidUsageDisplayRatio(ratio) {
		return data
	}
	var response map[string]common.RawMessage
	if common.Unmarshal(data, &response) != nil || response == nil {
		return data
	}
	if responseError := bytes.TrimSpace(response["error"]); len(responseError) > 0 && !bytes.Equal(responseError, []byte("null")) {
		return data
	}
	changed := false
	for _, key := range []string{"usage", "usageMetadata"} {
		var usage map[string]any
		if raw := response[key]; raw != nil && common.Unmarshal(raw, &usage) == nil && usage != nil {
			scaleUsageTokens(usage, ratio)
			if encoded, err := common.Marshal(usage); err == nil {
				response[key] = encoded
				changed = true
			}
		}
	}
	// Only protocol envelope fields are traversed, never tool results/content.
	for _, key := range []string{"message", "response"} {
		if raw := response[key]; raw != nil {
			if scaled := ScaleResponseUsage(raw, ratio); !bytes.Equal(raw, scaled) {
				response[key] = scaled
				changed = true
			}
		}
	}
	if changed {
		if encoded, err := common.Marshal(response); err == nil {
			return encoded
		}
	}
	return data
}

func scaleUsageTokens(usage map[string]any, ratio float64) {
	for key, value := range usage {
		switch value := value.(type) {
		case float64:
			if value >= 0 && (strings.HasSuffix(key, "_tokens") || strings.HasSuffix(key, "TokenCount")) {
				usage[key] = common.QuotaRound(value * ratio)
			}
		case map[string]any:
			scaleUsageTokens(value, ratio)
		case []any:
			for _, item := range value {
				if detail, ok := item.(map[string]any); ok {
					// Gemini modality details use tokenCount (lowercase t).
					if tokens, ok := detail["tokenCount"].(float64); ok && tokens >= 0 {
						detail["tokenCount"] = common.QuotaRound(tokens * ratio)
					}
					scaleUsageTokens(detail, ratio)
				}
			}
		}
	}
	// OpenAI totals must equal their components after integer rounding.
	for _, pair := range [][2]string{{"prompt_tokens", "completion_tokens"}, {"input_tokens", "output_tokens"}} {
		input, hasInput := usage[pair[0]].(int)
		output, hasOutput := usage[pair[1]].(int)
		if _, hasTotal := usage["total_tokens"]; hasTotal && hasInput && hasOutput {
			usage["total_tokens"] = common.QuotaRound(math.Min(float64(input)+float64(output), common.MaxQuota))
		}
	}
}
