package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

func Playground(c *gin.Context) {
	playgroundRelay(c, func(c *gin.Context) { Relay(c, types.RelayFormatOpenAI) })
}

// PlaygroundImage serves image generation and editing for the console studio.
// With ?background=1 the image is generated as a server-side studio job.
func PlaygroundImage(c *gin.Context) {
	if c.Query("background") == "1" {
		playgroundRelay(c, startStudioImageJob)
		return
	}
	playgroundRelay(c, func(c *gin.Context) { Relay(c, types.RelayFormatOpenAIImage) })
}

// PlaygroundVideo submits a video task for the console studio. The request
// is kept so the studio can show its prompt and retry a failed task.
func PlaygroundVideo(c *gin.Context) {
	playgroundRelay(c, relayStudioVideo)
}

// playgroundRelay runs a relay handler for a signed-in console user. The
// request is billed to the user's wallet through a temporary token, so no API
// key is needed.
func playgroundRelay(c *gin.Context, relay gin.HandlerFunc) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(common.UpstreamAddresses(c)...),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New(i18n.T(c, i18n.MsgRelayAccessTokenUnsupported)), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", usingGroup),
		Group:  usingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	relay(c)
}
