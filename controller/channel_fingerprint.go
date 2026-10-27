package controller

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/tokenkit"

	"github.com/gin-gonic/gin"
)

// The fingerprint test sends a short and a long prompt and takes the
// difference of the reported prompt tokens. The difference cancels the chat
// template overhead, leaving only how the upstream tokenizer splits the corpus.
// Tokenizers differ by 20-60% on this mixed text, so a relay that serves a
// different model than the name claims usually lands on another family.
const (
	fingerprintShortPrompt = "Reply with OK."
	fingerprintCorpus      = `The quick brown fox jumps over the lazy dog while 1234567 bees hum near 3.14159 daisies.
敏捷的棕色狐狸跳过了懒狗，蜜蜂在雏菊旁边嗡嗡作响。今天的天气非常好，我们一起去公园散步吧。
func fibonacci(n int) int { if n < 2 { return n }; return fibonacci(n-1) + fibonacci(n-2) }
SELECT id, name, created_at FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 20;
https://example.com/api/v1/items?page=2&size=50#section-3 user@example.com
Internationalization, tokenization, and serialization are long words; antidisestablishmentarianism too.
東京の天気は晴れです。서울의 날씨는 맑습니다。Привет, как дела? ¿Dónde está la biblioteca?
{"id": 42, "tags": ["alpha", "beta", "gamma"], "price": 19.99, "active": true, "ratio": 0.875}
2026-10-27T08:15:30Z  ERROR  [worker-7]  timeout after 30000ms (retry 3/5)  code=E_UPSTREAM_504`
	// fingerprintTolerance is the relative deviation still counted as a match;
	// estimated families are calibrated to within about 10% on real traffic.
	fingerprintTolerance = 0.15
)

// fingerprintFamilies are the reference tokenizers. Unknown-family models
// (GLM, Qwen, DeepSeek, ...) have no calibrated reference, so they can only be
// compared against these.
var fingerprintFamilies = []tokenkit.Family{
	tokenkit.FamilyOpenAI,
	tokenkit.FamilyClaude,
	tokenkit.FamilyClaude47,
	tokenkit.FamilyGemini,
}

type fingerprintResult struct {
	Model         string                  `json:"model"`
	UpstreamModel string                  `json:"upstream_model"`
	ClaimedFamily tokenkit.Family         `json:"claimed_family"`
	Measured      int                     `json:"measured"`
	Expected      map[tokenkit.Family]int `json:"expected"`
	ClosestFamily tokenkit.Family         `json:"closest_family,omitempty"`
	// Deviation is the measured count's relative distance from the claimed
	// family's expectation, or from the closest family when none is claimed.
	Deviation     float64                 `json:"deviation"`
	// Verdict is match, mismatch, no_reference, or no_usage.
	Verdict       string                  `json:"verdict"`
}

func fingerprintTokens(family tokenkit.Family, text string) int {
	if family == tokenkit.FamilyOpenAI {
		// o200k_base covers every current OpenAI model.
		return tokenkit.Count("gpt-4o", text)
	}
	return tokenkit.EstimateFamily(family, text)
}

func TestChannelFingerprint(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channel, err := model.CacheGetChannel(channelId)
	if err != nil {
		channel, err = model.GetChannelById(channelId, true)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	testUserID, err := resolveChannelTestUserID(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ctx := context.Background()
	if c.Request != nil {
		ctx = c.Request.Context()
	}
	testModel := c.Query("model")
	longPrompt := fingerprintShortPrompt + "\n\n" + fingerprintCorpus

	results := make([]testResult, 0, 2)
	for _, prompt := range []string{fingerprintShortPrompt, longPrompt} {
		result := testChannel(ctx, channel, testUserID, testModel, "", false, prompt)
		if result.localErr != nil {
			resp := gin.H{"success": false, "message": result.localErr.Error()}
			if result.newAPIError != nil {
				resp["error_code"] = result.newAPIError.GetErrorCode()
			}
			c.JSON(http.StatusOK, resp)
			return
		}
		results = append(results, result)
	}

	short, long := results[0], results[1]
	fingerprint := fingerprintResult{
		Model:         strings.TrimSpace(testModel),
		UpstreamModel: long.upstreamModel,
		ClaimedFamily: tokenkit.ModelFamily(long.upstreamModel),
		Measured:      long.promptTokens - short.promptTokens,
		Expected:      make(map[tokenkit.Family]int, len(fingerprintFamilies)),
	}
	closestDeviation := math.Inf(1)
	for _, family := range fingerprintFamilies {
		expected := fingerprintTokens(family, longPrompt) - fingerprintTokens(family, fingerprintShortPrompt)
		fingerprint.Expected[family] = expected
		if expected <= 0 {
			continue
		}
		deviation := math.Abs(float64(fingerprint.Measured-expected)) / float64(expected)
		if deviation < closestDeviation {
			closestDeviation = deviation
			fingerprint.ClosestFamily = family
		}
	}

	// Without upstream usage the gateway fills in its own estimate, which
	// says nothing about the upstream tokenizer.
	usageReported := long.promptTokens != long.estimatedPromptTokens ||
		short.promptTokens != short.estimatedPromptTokens
	claimedExpected, hasReference := fingerprint.Expected[fingerprint.ClaimedFamily]
	switch {
	case fingerprint.Measured <= 0 || !usageReported:
		fingerprint.Verdict = "no_usage"
		fingerprint.ClosestFamily = ""
	case !hasReference || claimedExpected <= 0:
		fingerprint.Verdict = "no_reference"
		fingerprint.Deviation = closestDeviation
	default:
		fingerprint.Deviation = math.Abs(float64(fingerprint.Measured-claimedExpected)) / float64(claimedExpected)
		if fingerprint.Deviation <= fingerprintTolerance {
			fingerprint.Verdict = "match"
		} else {
			fingerprint.Verdict = "mismatch"
		}
	}
	if math.IsInf(fingerprint.Deviation, 0) || math.IsNaN(fingerprint.Deviation) {
		fingerprint.Deviation = 0
	}
	common.ApiSuccess(c, fingerprint)
}
