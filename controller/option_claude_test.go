package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateOptionRejectsNegativeClaudeDefaultMaxTokens(t *testing.T) {
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/",
		strings.NewReader(`{"key":"claude.default_max_tokens","value":"{\"default\":-1}"}`),
	)

	UpdateOption(context)

	assert.Equal(t, http.StatusOK, response.Code)
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	assert.False(t, payload.Success)
	assert.Contains(t, payload.Message, "-1")
}

func TestUpdateOptionRejectsInvalidUsageReportingSettings(t *testing.T) {
	for _, tc := range []struct{ key, value string }{
		{"global.usage_display_ratio", "0"},
		{"global.usage_display_ratio", "-0.5"},
		{"global.usage_display_ratio", "NaN"},
		{"global.usage_display_ratio", "+Inf"},
		{"global.usage_display_ratio", "1e999"},
		{"global.usage_display_ratio", "invalid"},
		{"global.usage_passthrough_enabled", "yes"},
	} {
		t.Run(tc.key+"/"+tc.value, func(t *testing.T) {
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			payload, err := common.Marshal(map[string]string{"key": tc.key, "value": tc.value})
			require.NoError(t, err)
			context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(string(payload)))
			UpdateOption(context)
			var result struct {
				Success bool `json:"success"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.False(t, result.Success)
		})
	}
}
