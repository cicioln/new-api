package muse

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// Adaptor drives the Muse SDK directly. Muse has no HTTP API, so DoRequest
// sends nothing and DoResponse performs the blocking SDK call and writes the
// OpenAI-format response itself.
type Adaptor struct {
	chatRequest  *dto.GeneralOpenAIRequest
	imageRequest *dto.ImageRequest
}

var errUnsupported = errors.New("muse channel: endpoint not supported")

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return "", nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	a.chatRequest = request
	return request, nil
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if strings.TrimSpace(request.Prompt) == "" {
		return nil, types.NewErrorWithStatusCode(errors.New("prompt is required"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	a.imageRequest = &request
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errUnsupported
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errUnsupported
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errUnsupported
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errUnsupported
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errUnsupported
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errUnsupported
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return nil, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions:
		return a.chat(c, info)
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		return a.generateImages(c, info)
	default:
		return nil, types.NewErrorWithStatusCode(errUnsupported, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) chat(c *gin.Context, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if a.chatRequest == nil {
		// Pass-through mode skips ConvertOpenAIRequest.
		a.chatRequest, _ = info.Request.(*dto.GeneralOpenAIRequest)
	}
	if a.chatRequest == nil {
		return nil, types.NewErrorWithStatusCode(errors.New("muse channel: missing chat request"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	prompt, refs, apiErr := chatPrompt(c, a.chatRequest.Messages)
	if apiErr != nil {
		return nil, apiErr
	}
	acc, err := accountFor(info.ChannelId, info.ChannelMultiKeyIndex, info.ChannelIsMultiKey, info.ApiKey, info.ChannelSetting.Proxy)
	if err != nil {
		return nil, relayError(err, false)
	}
	client := sharedEngine()

	responseID := helper.GetResponseID(c)
	created := time.Now().Unix()
	modelName := info.UpstreamModelName
	if !info.IsStream {
		result, err := client.Chat(c.Request.Context(), acc, prompt, refs, nil)
		if err != nil {
			return nil, relayError(err, false)
		}
		result.Text = appendFileSVG(result.Text, result.Media)
		removeMedia(result.Media)
		usage := service.ResponseText2Usage(c, result.Text, modelName, info.GetEstimatePromptTokens())
		body, err := common.Marshal(dto.OpenAITextResponse{
			Id:      responseID,
			Model:   modelName,
			Object:  "chat.completion",
			Created: created,
			Usage:   *usage,
			Choices: []dto.OpenAITextResponseChoice{{
				Index:        0,
				Message:      dto.Message{Role: "assistant", Content: result.Text},
				FinishReason: "stop",
			}},
		})
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
		}
		c.Data(http.StatusOK, "application/json", body)
		return usage, nil
	}

	generalSettings := operation_setting.GetGeneralSetting()
	if generalSettings.PingIntervalEnabled && !info.DisablePing {
		stopKeepAlive := helper.StartStreamKeepAlive(c, time.Duration(generalSettings.PingIntervalSeconds)*time.Second)
		defer stopKeepAlive()
	}
	var sent strings.Builder
	started := false
	startStream := func() {
		if started {
			return
		}
		started = true
		helper.SetEventStreamHeaders(c)
		_ = helper.ObjectData(c, helper.GenerateStartEmptyResponse(responseID, created, modelName, nil))
	}
	sendDelta := func(text string) {
		if text == "" {
			return
		}
		startStream()
		sent.WriteString(text)
		_ = helper.ObjectData(c, &dto.ChatCompletionsStreamResponse{
			Id:      responseID,
			Object:  "chat.completion.chunk",
			Created: created,
			Model:   modelName,
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: common.GetPointer(text)},
			}},
		})
	}
	// Chat invokes onDelta synchronously on this goroutine.
	result, err := client.Chat(c.Request.Context(), acc, prompt, refs, sendDelta)
	if err != nil {
		return nil, relayError(err, started)
	}
	result.Text = appendFileSVG(result.Text, result.Media)
	removeMedia(result.Media)
	// The SDK stops emitting deltas when upstream rewrites earlier text. Send
	// what the final text adds; when it no longer extends what the client
	// received (e.g. a "generating…" placeholder was replaced), send the whole
	// final text so the answer is not lost.
	if rest, ok := strings.CutPrefix(result.Text, sent.String()); ok {
		sendDelta(rest)
	} else {
		sendDelta("\n\n" + result.Text)
	}
	startStream()
	usage := service.ResponseText2Usage(c, result.Text, modelName, info.GetEstimatePromptTokens())
	_ = helper.ObjectData(c, helper.GenerateStopResponse(responseID, created, modelName, "stop"))
	if info.ShouldIncludeUsage {
		_ = helper.ObjectData(c, helper.GenerateFinalUsageResponse(responseID, created, modelName, *usage))
	}
	helper.Done(c)
	return usage, nil
}

// chatPrompt flattens the conversation into one prompt, because every Muse
// turn opens a new session. Images attached to the last user message are sent
// as reference images.
func chatPrompt(c *gin.Context, messages []dto.Message) (string, []musesdk.RefImage, *types.NewAPIError) {
	badRequest := func(err error) *types.NewAPIError {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	lastUser := -1
	for i := range messages {
		if messages[i].Role == "user" {
			lastUser = i
		}
	}
	var transcript strings.Builder
	var single string
	parts := 0
	var refs []musesdk.RefImage
	for i := range messages {
		message := &messages[i]
		var text strings.Builder
		for _, content := range message.ParseContent() {
			switch content.Type {
			case dto.ContentTypeText:
				if text.Len() > 0 {
					text.WriteString("\n")
				}
				text.WriteString(content.Text)
			case dto.ContentTypeImageURL:
				if i != lastUser {
					continue
				}
				if len(refs) >= musesdk.MaxRefImages {
					return "", nil, badRequest(fmt.Errorf("at most %d images are supported", musesdk.MaxRefImages))
				}
				source := content.ToFileSource()
				if source == nil {
					continue
				}
				data, mime, err := service.GetBase64Data(c, source, "muse_chat_image")
				if err != nil {
					return "", nil, badRequest(fmt.Errorf("load image failed: %w", err))
				}
				raw, err := base64.StdEncoding.DecodeString(data)
				if err != nil {
					return "", nil, badRequest(fmt.Errorf("decode image failed: %w", err))
				}
				refs = append(refs, musesdk.RefImage{Data: raw, Mime: mime})
			}
		}
		body := strings.TrimSpace(text.String())
		if body == "" {
			continue
		}
		parts++
		single = body
		if transcript.Len() > 0 {
			transcript.WriteString("\n\n")
		}
		role := message.Role
		if role != "" {
			role = strings.ToUpper(role[:1]) + role[1:]
		}
		transcript.WriteString(role + ": " + body)
	}
	if parts == 0 {
		return "", nil, badRequest(errors.New("messages must contain text"))
	}
	if parts == 1 && lastUser >= 0 {
		return single, refs, nil
	}
	return transcript.String(), refs, nil
}

func (a *Adaptor) generateImages(c *gin.Context, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	request := a.imageRequest
	if request == nil {
		// Pass-through mode skips ConvertImageRequest.
		request, _ = info.Request.(*dto.ImageRequest)
	}
	if request == nil {
		return nil, types.NewErrorWithStatusCode(errors.New("muse channel: missing image request"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	count, err := request.ImageCount(false)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	var refs []musesdk.RefImage
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		refs, err = multipartImages(c)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}
	prompt := request.Prompt
	if request.Size != "" {
		prompt += "\n\nImage size: " + request.Size + "."
	}
	if count > 1 {
		prompt += fmt.Sprintf("\n\nGenerate %d separate images.", count)
	}
	acc, err := accountFor(info.ChannelId, info.ChannelMultiKeyIndex, info.ChannelIsMultiKey, info.ApiKey, info.ChannelSetting.Proxy)
	if err != nil {
		return nil, relayError(err, false)
	}
	files, err := sharedEngine().Generate(c.Request.Context(), acc, musesdk.GenRequest{Prompt: prompt, Kind: "image", Refs: refs, N: count})
	if err != nil {
		return nil, relayError(err, false)
	}
	defer removeMedia(files)
	response := dto.ImageResponse{Created: common.GetTimestamp(), Data: make([]dto.ImageData, 0, len(files))}
	for _, file := range files {
		raw, err := os.ReadFile(mediaPath(file))
		if err != nil {
			return nil, types.NewErrorWithStatusCode(fmt.Errorf("read generated image failed: %w", err), types.ErrorCodeBadResponse, http.StatusBadGateway, types.ErrOptionWithSkipRetry())
		}
		response.Data = append(response.Data, dto.ImageData{B64Json: base64.StdEncoding.EncodeToString(raw)})
	}
	if len(response.Data) == 0 {
		return nil, types.NewErrorWithStatusCode(errors.New("muse returned no images"), types.ErrorCodeEmptyResponse, http.StatusBadGateway, types.ErrOptionWithSkipRetry())
	}
	info.UpdateImageCount(int64(len(response.Data)))
	body, err := common.Marshal(response)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
	}
	c.Data(http.StatusOK, "application/json", body)
	return &dto.Usage{}, nil
}

// multipartImages reads the reference images of an /images/edits request.
func multipartImages(c *gin.Context) ([]musesdk.RefImage, error) {
	form := c.Request.MultipartForm
	if form == nil {
		parsed, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, fmt.Errorf("failed to parse multipart form: %w", err)
		}
		form = parsed
	}
	var headers []*multipart.FileHeader
	for field, files := range form.File {
		if field == "image" || strings.HasPrefix(field, "image[") {
			headers = append(headers, files...)
		}
	}
	if len(headers) == 0 {
		return nil, errors.New("image is required")
	}
	if len(headers) > musesdk.MaxRefImages {
		return nil, fmt.Errorf("at most %d images are supported", musesdk.MaxRefImages)
	}
	refs := make([]musesdk.RefImage, 0, len(headers))
	for _, header := range headers {
		if header.Size > musesdk.MaxRefImageBytes {
			return nil, fmt.Errorf("image %s exceeds %d bytes", header.Filename, musesdk.MaxRefImageBytes)
		}
		file, err := header.Open()
		if err != nil {
			return nil, err
		}
		raw, err := io.ReadAll(io.LimitReader(file, musesdk.MaxRefImageBytes+1))
		file.Close()
		if err != nil {
			return nil, err
		}
		mime := header.Header.Get("Content-Type")
		if !strings.HasPrefix(mime, "image/") {
			mime = http.DetectContentType(raw)
		}
		refs = append(refs, musesdk.RefImage{Data: raw, Mime: mime})
	}
	return refs, nil
}

func mediaPath(file musesdk.Media) string {
	return filepath.Join(engineConfig.MediaDir(), filepath.Base(file.Filename))
}

const maxInlineSVGBytes = 1 << 20

// appendFileSVG copies an SVG the agent saved as a workspace file into the
// reply. Asked for SVG, Muse often writes the file and only describes it in
// text, so clients that read SVG from the message would get nothing.
func appendFileSVG(text string, files []musesdk.Media) string {
	if strings.Contains(strings.ToLower(text), "<svg") {
		return text
	}
	for _, file := range files {
		if file.Bytes > maxInlineSVGBytes {
			continue
		}
		data, err := os.ReadFile(mediaPath(file))
		if err != nil || len(data) > maxInlineSVGBytes {
			continue
		}
		lower := strings.ToLower(string(data))
		start := strings.Index(lower, "<svg")
		end := strings.LastIndex(lower, "</svg>")
		if start < 0 || end < start {
			continue
		}
		svg := string(data[start : end+len("</svg>")])
		return strings.TrimRight(text, "\n") + "\n\n```svg\n" + svg + "\n```"
	}
	return text
}

func removeMedia(files []musesdk.Media) {
	for _, file := range files {
		_ = os.Remove(mediaPath(file))
	}
}
