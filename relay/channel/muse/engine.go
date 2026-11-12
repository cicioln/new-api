package muse

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
)

const ChannelName = "muse"

// Models named muse-video-<N>s make videos of up to N seconds from
// consecutive 10-second segments; see videoTierSeconds.
var ModelList = []string{
	"muse", "muse-image", "muse-video",
	"muse-video-20s", "muse-video-30s", "muse-video-40s", "muse-video-50s", "muse-video-60s",
}

// TaskPlatform is the platform recorded on Muse video tasks.
var TaskPlatform = constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeMuse))

var (
	engineOnce   sync.Once
	engine       *musesdk.ProtoEngine
	engineConfig musesdk.Config
)

// sharedEngine returns the process-wide Muse client. One engine keeps one
// multiplexed connection per account, so every request must share it.
func sharedEngine() *musesdk.ProtoEngine {
	engineOnce.Do(func() {
		engineConfig = musesdk.Config{
			DataDir:    common.GetEnvOrDefaultString("MUSE_DATA_DIR", "muse-data"),
			FFmpegPath: common.GetEnvOrDefaultString("MUSE_FFMPEG_PATH", ""),
		}
		engine = musesdk.NewClient(engineConfig)
		engine.SetHooks(onCookiesRotated, nil)
		go engine.Janitor(context.Background())
		go cleanupVideoJobs(context.Background())
	})
	return engine
}

// accountState tracks the cookies of one channel key. Muse rotates cookies
// during bootstrap; the rotated set must be used for later calls, and the
// channel key keeps working whether it still holds the original text or a
// rotation that was written back.
type accountState struct {
	channelID int
	persist   bool
	knownKeys []string
	cookies   map[string]string
	expires   map[string]int64
}

var (
	accountsMu sync.Mutex
	accounts   = map[string]*accountState{}
)

const maxKnownKeys = 4

func accountFor(channelID, keyIndex int, multiKey bool, key, proxy string) (*musesdk.Account, error) {
	id := fmt.Sprintf("channel-%d-%d", channelID, keyIndex)
	accountsMu.Lock()
	defer accountsMu.Unlock()
	state := accounts[id]
	if state == nil || !slices.Contains(state.knownKeys, key) {
		cookies := musesdk.ParseCookies(key)
		if missing := musesdk.MissingCookies(cookies); len(missing) > 0 {
			return nil, &musesdk.Error{Kind: musesdk.KindAuth, Msg: "muse key is missing cookies: " + strings.Join(missing, ", ")}
		}
		state = &accountState{channelID: channelID, persist: !multiKey, knownKeys: []string{key}, cookies: cookies}
		accounts[id] = state
	}
	return &musesdk.Account{
		ID:            id,
		Cookies:       maps.Clone(state.cookies),
		CookieExpires: maps.Clone(state.expires),
		Proxy:         proxy,
	}, nil
}

func onCookiesRotated(id string, cookies map[string]string, expires map[string]int64) {
	accountsMu.Lock()
	state := accounts[id]
	if state == nil {
		accountsMu.Unlock()
		return
	}
	unchanged := musesdk.CookieHeader(cookies) == musesdk.CookieHeader(state.cookies)
	state.cookies = maps.Clone(cookies)
	state.expires = maps.Clone(expires)
	if unchanged {
		accountsMu.Unlock()
		return
	}
	header := musesdk.CookieHeader(cookies)
	expected := append([]string(nil), state.knownKeys...)
	state.knownKeys = append(state.knownKeys, header)
	if len(state.knownKeys) > maxKnownKeys {
		// Keep the administrator's original text so an unrefreshed cache
		// still maps to this state.
		state.knownKeys = append([]string{state.knownKeys[0]}, state.knownKeys[len(state.knownKeys)-maxKnownKeys+1:]...)
	}
	persist, channelID := state.persist, state.channelID
	accountsMu.Unlock()
	if persist {
		go persistRotatedKey(channelID, expected, header)
	}
}

// persistRotatedKey writes rotated cookies back to a single-key channel. The
// update only applies while the stored key is one this process issued, so a
// key edited by an administrator in the meantime is never overwritten.
func persistRotatedKey(channelID int, expected []string, header string) {
	result := model.DB.Model(&model.Channel{}).
		Where("id = ?", channelID).
		Where(map[string]any{"key": expected}).
		Update("key", header)
	if result.Error != nil {
		common.SysError(common.LogText("muse channel #%d cookie write-back failed: %s", channelID, result.Error.Error()))
		return
	}
	if result.RowsAffected > 0 {
		model.InitChannelCache()
	}
}

// mediaRefusal replaces the SDK's refusal error, raised when the model
// answered with text instead of media, with a fixed message for the user.
func mediaRefusal(err error, kind string) error {
	if musesdk.KindOf(err) != musesdk.KindRefusal {
		return err
	}
	msg := "无法生成该图片"
	if kind == "video" {
		msg = "无法生成该视频"
	}
	return &musesdk.Error{Kind: musesdk.KindRefusal, Msg: msg, Err: err}
}

// relayError maps SDK errors onto relay errors. Once output reached the
// client, or the SDK reports that the turn may already have run, the request
// must not be retried on another channel.
func relayError(err error, streamed bool) *types.NewAPIError {
	var opts []types.NewAPIErrorOptions
	if streamed || !musesdk.Retryable(err) {
		opts = append(opts, types.ErrOptionWithSkipRetry())
	}
	if errors.Is(err, context.Canceled) {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeDoRequestFailed, http.StatusRequestTimeout, types.ErrOptionWithSkipRetry())
	}
	switch musesdk.KindOf(err) {
	case musesdk.KindAuth:
		return types.NewErrorWithStatusCode(err, types.ErrorCodeChannelInvalidKey, http.StatusUnauthorized, opts...)
	case musesdk.KindQuota, musesdk.KindRateLimit:
		return types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests, opts...)
	case musesdk.KindBadRequest:
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	case musesdk.KindRefusal:
		return types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponse, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	default:
		return types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponse, http.StatusBadGateway, opts...)
	}
}
