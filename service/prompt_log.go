package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	promptLogCleanupInterval = 6 * time.Hour
	promptPreviewMaxRunes    = 240
	maxExternalURLLength     = 2048
)

var (
	promptLogCleanupOnce sync.Once

	mimeToExtension = map[string]string{
		"image/png":                   ".png",
		"image/jpeg":                  ".jpg",
		"image/jpg":                   ".jpg",
		"image/webp":                  ".webp",
		"image/gif":                   ".gif",
		"image/bmp":                   ".bmp",
		"image/tiff":                  ".tiff",
		"image/avif":                  ".avif",
		"image/svg+xml":               ".svg",
		"application/pdf":             ".pdf",
		"audio/mpeg":                  ".mp3",
		"audio/mp3":                   ".mp3",
		"audio/wav":                   ".wav",
		"audio/x-wav":                 ".wav",
		"audio/webm":                  ".webm",
		"audio/ogg":                   ".ogg",
		"audio/flac":                  ".flac",
		"audio/aac":                   ".aac",
		"audio/mp4":                   ".m4a",
		"audio/x-m4a":                 ".m4a",
		"video/mp4":                   ".mp4",
		"video/webm":                  ".webm",
		"video/quicktime":             ".mov",
		"text/plain":                  ".txt",
		"text/markdown":               ".md",
		"text/csv":                    ".csv",
		"application/json":            ".json",
		"application/xml":             ".xml",
		"text/xml":                    ".xml",
		"application/vnd.ms-excel":    ".xls",
		"application/msword":          ".doc",
		"application/zip":             ".zip",
		"application/octet-stream":    ".bin",
		"application/x-ndjson":        ".ndjson",
		"application/x-yaml":          ".yaml",
		"text/yaml":                   ".yaml",
		"text/html":                   ".html",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document":   ".docx",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         ".xlsx",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
	}

	previewSafeInlineMIMEs = map[string]bool{
		"image/png":       true,
		"image/jpeg":      true,
		"image/jpg":       true,
		"image/webp":      true,
		"image/gif":       true,
		"image/bmp":       true,
		"image/avif":      true,
		"application/pdf": true,
		"audio/mpeg":      true,
		"audio/mp3":       true,
		"audio/wav":       true,
		"audio/x-wav":     true,
		"audio/ogg":       true,
		"audio/flac":      true,
		"audio/aac":       true,
		"audio/mp4":       true,
		"audio/x-m4a":     true,
		"audio/webm":      true,
		"video/mp4":       true,
		"video/webm":      true,
		"video/quicktime": true,
		"text/plain":      true,
		"text/csv":        true,
		"text/markdown":   true,
		"application/json": true,
	}
)

// PromptLogDataDir returns the root directory used to store prompt log media
// files on disk. Follows the same working-dir relative convention as studio-data.
func PromptLogDataDir() string {
	return common.GetEnvOrDefaultString("PROMPT_LOG_DATA_DIR", "prompt-logs")
}

// PromptLogMediaRoot returns the media subdirectory under PromptLogDataDir.
func PromptLogMediaRoot() string {
	return filepath.Join(PromptLogDataDir(), "media")
}

// ShouldCaptureChannelPrompt reports whether prompt extraction logging is
// active both globally and on the selected channel.
func ShouldCaptureChannelPrompt(other dto.ChannelOtherSettings) bool {
	if !other.PromptLogEnabled {
		return false
	}
	return operation_setting.GetPromptLogSetting().Enabled
}

// CaptureChannelPromptFromGin captures the user prompt and attachments from the
// request associated with the Gin context when enabled for the selected channel.
func CaptureChannelPromptFromGin(c *gin.Context, modelName string, relayFormat string) {
	if c == nil {
		return
	}
	other, _ := common.GetContextKeyType[dto.ChannelOtherSettings](c, constant.ContextKeyChannelOtherSetting)
	if !ShouldCaptureChannelPrompt(other) {
		return
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return
	}
	_, _ = storage.Seek(0, io.SeekStart)
	c.Request.Body = io.NopCloser(storage)
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	channelName := common.GetContextKeyString(c, constant.ContextKeyChannelName)
	channelType := common.GetContextKeyInt(c, constant.ContextKeyChannelType)
	CaptureChannelPromptFromStorage(c, channelID, channelName, channelType, other, modelName, relayFormat, storage)
}

// CaptureChannelPromptFromStorage extracts prompts and attachments using an
// independent BodyStorage reader without mutating the request body cursor.
func CaptureChannelPromptFromStorage(
	c *gin.Context,
	channelID int,
	channelName string,
	channelType int,
	other dto.ChannelOtherSettings,
	modelName string,
	relayFormat string,
	storage common.BodyStorage,
) {
	if c == nil || storage == nil || !ShouldCaptureChannelPrompt(other) {
		return
	}
	requestID := c.GetString(common.RequestIdKey)
	if requestID != "" && channelID > 0 {
		if exists, err := model.HasChannelPromptLog(requestID, channelID); err == nil && exists {
			return
		}
	}
	cfg := operation_setting.GetPromptLogSetting()
	contentType := c.Request.Header.Get("Content-Type")
	if savedCT, ok := c.Get("_original_multipart_ct"); ok {
		if ctStr, ok := savedCT.(string); ok && ctStr != "" {
			contentType = ctStr
		}
	}
	reader, err := storage.NewReader()
	if err != nil {
		common.SysError(common.LogText("prompt log failed to open body reader: %s", err.Error()))
		return
	}
	defer func() { _ = reader.Close() }()

	meta := buildCaptureContextMeta(c, channelID, channelName, channelType, modelName, relayFormat)
	maxFileBytes := int64(cfg.MaxFileSizeMB) * 1024 * 1024
	if maxFileBytes <= 0 {
		maxFileBytes = int64(operation_setting.DefaultPromptLogMaxFileSizeMB) * 1024 * 1024
	}

	mediaType, params, parseErr := mime.ParseMediaType(contentType)
	if parseErr == nil && strings.HasPrefix(strings.ToLower(mediaType), "multipart/") {
		boundary := params["boundary"]
		if boundary != "" {
			entry := extractMultipartPromptLog(meta, cfg, maxFileBytes, reader, boundary)
			persistPromptLogSafely(entry)
			return
		}
	}

	maxBodyRead := min(max(maxFileBytes*2+4*1024*1024, 32*1024*1024), 128*1024*1024)
	limited := io.LimitReader(reader, maxBodyRead+1)
	raw, readErr := io.ReadAll(limited)
	if readErr != nil {
		common.SysError(common.LogText("prompt log failed to read request body: %s", readErr.Error()))
		return
	}
	bodyOverLimit := int64(len(raw)) > maxBodyRead
	if bodyOverLimit {
		raw = raw[:maxBodyRead]
	}
	entry := extractBufferedPromptLog(meta, cfg, maxFileBytes, raw, contentType, bodyOverLimit)
	persistPromptLogSafely(entry)
}

// CaptureChannelPromptFromBytes captures prompts from an in-memory payload (such
// as Responses WebSocket events) when enabled globally and on the channel.
func CaptureChannelPromptFromBytes(
	c *gin.Context,
	channelID int,
	channelName string,
	channelType int,
	other dto.ChannelOtherSettings,
	modelName string,
	relayFormat string,
	body []byte,
	contentType string,
) {
	if c == nil || !ShouldCaptureChannelPrompt(other) {
		return
	}
	requestID := c.GetString(common.RequestIdKey)
	if requestID != "" && channelID > 0 {
		if exists, err := model.HasChannelPromptLog(requestID, channelID); err == nil && exists {
			return
		}
	}
	cfg := operation_setting.GetPromptLogSetting()
	maxFileBytes := int64(cfg.MaxFileSizeMB) * 1024 * 1024
	if maxFileBytes <= 0 {
		maxFileBytes = int64(operation_setting.DefaultPromptLogMaxFileSizeMB) * 1024 * 1024
	}
	meta := buildCaptureContextMeta(c, channelID, channelName, channelType, modelName, relayFormat)
	entry := extractBufferedPromptLog(meta, cfg, maxFileBytes, body, contentType, false)
	persistPromptLogSafely(entry)
}

type captureContextMeta struct {
	CreatedAt   int64
	RequestID   string
	ChannelID   int
	ChannelName string
	ChannelType int
	UserID      int
	Username    string
	TokenID     int
	TokenName   string
	ModelName   string
	Endpoint    string
	RelayFormat string
}

func buildCaptureContextMeta(
	c *gin.Context,
	channelID int,
	channelName string,
	channelType int,
	modelName string,
	relayFormat string,
) captureContextMeta {
	if channelID <= 0 {
		channelID = common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	}
	if channelName == "" {
		channelName = common.GetContextKeyString(c, constant.ContextKeyChannelName)
	}
	if channelType == 0 {
		channelType = common.GetContextKeyInt(c, constant.ContextKeyChannelType)
	}
	if modelName == "" {
		modelName = c.GetString("original_model")
	}
	endpoint := ""
	if c.Request != nil && c.Request.URL != nil {
		endpoint = c.Request.URL.Path
	}
	return captureContextMeta{
		CreatedAt:   common.GetTimestamp(),
		RequestID:   c.GetString(common.RequestIdKey),
		ChannelID:   channelID,
		ChannelName: channelName,
		ChannelType: channelType,
		UserID:      c.GetInt("id"),
		Username:    c.GetString("username"),
		TokenID:     c.GetInt("token_id"),
		TokenName:   c.GetString("token_name"),
		ModelName:   modelName,
		Endpoint:    endpoint,
		RelayFormat: relayFormat,
	}
}

func persistPromptLogSafely(entry *model.ChannelPromptLog) {
	if entry == nil {
		return
	}
	if err := model.InsertChannelPromptLog(entry); err != nil {
		DeletePromptAttachmentFiles([]*model.ChannelPromptLog{entry})
		common.SysError(common.LogText("failed to insert channel prompt log: %s", err.Error()))
	}
}

type promptExtractionAccumulator struct {
	meta            captureContextMeta
	maxTextBytes    int
	maxFileBytes    int64
	sections        []string
	previewTexts    []string
	messageCount    int
	attachments     []model.ChannelPromptAttachment
	metadata        map[string]any
	truncated       bool
	attachmentSeq   int
	requestDirSlug  string
	dateSubdir      string
}

func newPromptAccumulator(meta captureContextMeta, cfg operation_setting.PromptLogSetting, maxFileBytes int64) *promptExtractionAccumulator {
	maxTextBytes := cfg.MaxTextBytes
	if maxTextBytes <= 0 {
		maxTextBytes = operation_setting.DefaultPromptLogMaxTextBytes
	}
	slug := sanitizePathSegment(meta.RequestID)
	if slug == "" {
		slug = common.GetRandomString(12)
	}
	ts := meta.CreatedAt
	if ts <= 0 {
		ts = time.Now().Unix()
	}
	return &promptExtractionAccumulator{
		meta:           meta,
		maxTextBytes:   maxTextBytes,
		maxFileBytes:   maxFileBytes,
		metadata:       make(map[string]any),
		requestDirSlug: slug + "_" + common.GetRandomString(6),
		dateSubdir:     time.Unix(ts, 0).UTC().Format("2006-01-02"),
	}
}

func (a *promptExtractionAccumulator) addSection(label, content string, isUserTurn bool) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return
	}
	a.sections = append(a.sections, fmt.Sprintf("[%s]\n%s", label, trimmed))
	if isUserTurn {
		a.previewTexts = append(a.previewTexts, trimmed)
	}
}

func (a *promptExtractionAccumulator) addInlineMarker(label, marker string) {
	a.sections = append(a.sections, fmt.Sprintf("[%s]\n%s", label, marker))
}

func (a *promptExtractionAccumulator) saveBytesAttachment(kind, source, fieldName, fileName, explicitMime string, data []byte, oversized bool, reportedSize int64) model.ChannelPromptAttachment {
	a.attachmentSeq++
	id := fmt.Sprintf("att_%02d_%s", a.attachmentSeq, common.GetRandomString(6))
	cleanFile := sanitizeFileName(fileName)
	mimeType := normalizeMimeType(explicitMime)
	if mimeType == "" && len(data) > 0 {
		mimeType = normalizeMimeType(http.DetectContentType(data[:min(len(data), 512)]))
	}
	if mimeType == "" && cleanFile != "" {
		if byExt := mime.TypeByExtension(strings.ToLower(filepath.Ext(cleanFile))); byExt != "" {
			mimeType = normalizeMimeType(byExt)
		}
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	if kind == "" {
		kind = classifyAttachmentKind(mimeType, cleanFile, fieldName)
	}
	sizeBytes := int64(len(data))
	if reportedSize > sizeBytes {
		sizeBytes = reportedSize
	}

	att := model.ChannelPromptAttachment{
		ID:        id,
		Kind:      kind,
		Source:    source,
		MimeType:  mimeType,
		FileName:  cleanFile,
		FieldName: fieldName,
		SizeBytes: sizeBytes,
	}
	if oversized {
		att.Truncated = true
		att.Error = fmt.Sprintf("attachment exceeded max file size (%d MB)", a.maxFileBytes/(1024*1024))
		a.attachments = append(a.attachments, att)
		return att
	}
	if len(data) == 0 {
		att.Error = "empty attachment payload"
		a.attachments = append(a.attachments, att)
		return att
	}

	sum := sha256.Sum256(data)
	att.SHA256 = hex.EncodeToString(sum[:])

	ext := chooseSafeExtension(mimeType, cleanFile)
	if cleanFile == "" {
		cleanFile = fmt.Sprintf("%s_%02d%s", kind, a.attachmentSeq, ext)
		att.FileName = cleanFile
	}
	relPath := filepath.ToSlash(filepath.Join(a.dateSubdir, a.requestDirSlug, fmt.Sprintf("%02d_%s%s", a.attachmentSeq, common.GetRandomString(6), ext)))
	absPath := filepath.Join(PromptLogMediaRoot(), filepath.FromSlash(relPath))
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		att.Error = "failed to create media directory"
		common.SysError(common.LogText("prompt log mkdir failed: %s", err.Error()))
		a.attachments = append(a.attachments, att)
		return att
	}
	if err := os.WriteFile(absPath, data, 0o640); err != nil {
		att.Error = "failed to write attachment file"
		common.SysError(common.LogText("prompt log write failed: %s", err.Error()))
		a.attachments = append(a.attachments, att)
		return att
	}
	att.RelativePath = relPath
	a.attachments = append(a.attachments, att)
	return att
}

func (a *promptExtractionAccumulator) addURLAttachment(kind, fieldName, rawURL, fileName, explicitMime string) model.ChannelPromptAttachment {
	a.attachmentSeq++
	id := fmt.Sprintf("att_%02d_%s", a.attachmentSeq, common.GetRandomString(6))
	cleanFile := sanitizeFileName(fileName)
	if cleanFile == "" {
		cleanFile = fileNameFromURL(rawURL)
	}
	mimeType := normalizeMimeType(explicitMime)
	if mimeType == "" && cleanFile != "" {
		if byExt := mime.TypeByExtension(strings.ToLower(filepath.Ext(cleanFile))); byExt != "" {
			mimeType = normalizeMimeType(byExt)
		}
	}
	if kind == "" {
		kind = classifyAttachmentKind(mimeType, cleanFile, fieldName)
	}
	boundedURL := truncateUTF8(strings.TrimSpace(rawURL), maxExternalURLLength)
	att := model.ChannelPromptAttachment{
		ID:          id,
		Kind:        kind,
		Source:      "url",
		MimeType:    mimeType,
		FileName:    cleanFile,
		FieldName:   fieldName,
		ExternalURL: boundedURL,
	}
	a.attachments = append(a.attachments, att)
	return att
}

func (a *promptExtractionAccumulator) finalize() *model.ChannelPromptLog {
	fullText := strings.Join(a.sections, "\n\n")
	if len(fullText) > a.maxTextBytes {
		fullText = truncateUTF8(fullText, a.maxTextBytes)
		a.truncated = true
	}
	var previewSource string
	if len(a.previewTexts) > 0 {
		previewSource = a.previewTexts[len(a.previewTexts)-1]
	} else {
		previewSource = fullText
	}
	preview := collapseWhitespaceAndTruncate(previewSource, promptPreviewMaxRunes)
	if preview == "" && len(a.attachments) > 0 {
		preview = fmt.Sprintf("[%d attachment(s)]", len(a.attachments))
	}

	metaJSON := ""
	if len(a.metadata) > 0 {
		if encoded, err := common.Marshal(a.metadata); err == nil {
			metaJSON = string(encoded)
		}
	}
	if a.meta.ModelName == "" {
		if m, ok := a.metadata["model"].(string); ok && m != "" {
			a.meta.ModelName = m
		}
	}

	entry := &model.ChannelPromptLog{
		CreatedAt:       a.meta.CreatedAt,
		RequestId:       a.meta.RequestID,
		ChannelId:       a.meta.ChannelID,
		ChannelName:     truncateUTF8(a.meta.ChannelName, 128),
		ChannelType:     a.meta.ChannelType,
		UserId:          a.meta.UserID,
		Username:        truncateUTF8(a.meta.Username, 64),
		TokenId:         a.meta.TokenID,
		TokenName:       truncateUTF8(a.meta.TokenName, 64),
		ModelName:       truncateUTF8(a.meta.ModelName, 128),
		Endpoint:        truncateUTF8(a.meta.Endpoint, 128),
		RelayFormat:     truncateUTF8(a.meta.RelayFormat, 64),
		PromptPreview:   preview,
		PromptText:      fullText,
		PromptTruncated: a.truncated,
		MessageCount:    a.messageCount,
		MetadataJSON:    metaJSON,
	}
	_ = entry.SetAttachments(a.attachments)
	return entry
}

func extractMultipartPromptLog(
	meta captureContextMeta,
	cfg operation_setting.PromptLogSetting,
	maxFileBytes int64,
	reader io.Reader,
	boundary string,
) *model.ChannelPromptLog {
	acc := newPromptAccumulator(meta, cfg, maxFileBytes)
	mr := multipart.NewReader(reader, boundary)
	formFields := make(map[string][]string)

	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			acc.metadata["multipart_error"] = err.Error()
			break
		}
		fieldName := part.FormName()
		fileName := part.FileName()
		partCT := part.Header.Get("Content-Type")

		if fileName != "" {
			limited := io.LimitReader(part, maxFileBytes+1)
			data, readErr := io.ReadAll(limited)
			_ = part.Close()
			if readErr != nil {
				continue
			}
			readLen := int64(len(data))
			oversized := readLen > maxFileBytes
			if oversized {
				data = nil
			}
			att := acc.saveBytesAttachment("", "multipart_file", fieldName, fileName, partCT, data, oversized, readLen)
			acc.addInlineMarker("attachment", formatAttachmentMarker(att))
			continue
		}

		// Text form field.
		valBytes, readErr := io.ReadAll(io.LimitReader(part, int64(acc.maxTextBytes)+1))
		_ = part.Close()
		if readErr != nil {
			continue
		}
		valStr := string(valBytes)
		if len(valBytes) > acc.maxTextBytes {
			valStr = truncateUTF8(valStr, acc.maxTextBytes)
			acc.truncated = true
		}
		formFields[fieldName] = append(formFields[fieldName], valStr)
	}

	promptKeys := []string{"prompt", "negative_prompt", "instructions", "input", "text", "query"}
	promptHandled := make(map[string]bool)
	for _, key := range promptKeys {
		if vals, ok := formFields[key]; ok {
			promptHandled[key] = true
			for _, v := range vals {
				if isMediaValueCandidate(key, v) {
					marker := acc.ingestMediaString(key, "", v, "")
					acc.addInlineMarker(key, marker)
				} else {
					acc.messageCount++
					acc.addSection(key, v, true)
				}
			}
		}
	}
	for k, vals := range formFields {
		if promptHandled[k] {
			continue
		}
		if k == "model" && len(vals) > 0 && acc.meta.ModelName == "" {
			acc.meta.ModelName = vals[0]
		}
		if len(vals) == 1 {
			if isMediaValueCandidate(k, vals[0]) {
				marker := acc.ingestMediaString(k, "", vals[0], "")
				acc.addInlineMarker(k, marker)
			} else {
				acc.metadata[k] = truncateUTF8(vals[0], 512)
			}
		} else if len(vals) > 1 {
			acc.metadata[k] = vals
		}
	}
	return acc.finalize()
}

func extractBufferedPromptLog(
	meta captureContextMeta,
	cfg operation_setting.PromptLogSetting,
	maxFileBytes int64,
	raw []byte,
	contentType string,
	bodyOverLimit bool,
) *model.ChannelPromptLog {
	acc := newPromptAccumulator(meta, cfg, maxFileBytes)
	if bodyOverLimit {
		acc.truncated = true
		acc.metadata["body_truncated"] = true
	}
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return acc.finalize()
	}

	var payload map[string]any
	if trimmed[0] == '{' && common.Unmarshal(trimmed, &payload) == nil && payload != nil {
		acc.extractJSONPayload(payload)
		return acc.finalize()
	}

	mediaType := strings.ToLower(contentType)
	if strings.Contains(mediaType, "application/x-www-form-urlencoded") {
		if parsed, err := url.ParseQuery(string(trimmed)); err == nil {
			for k, vals := range parsed {
				if k == "prompt" || k == "input" || k == "instructions" || k == "query" {
					for _, v := range vals {
						acc.messageCount++
						acc.addSection(k, v, true)
					}
				} else if len(vals) > 0 {
					acc.metadata[k] = truncateUTF8(vals[0], 512)
				}
			}
			return acc.finalize()
		}
	}

	acc.addSection("body", string(trimmed), true)
	return acc.finalize()
}

func (a *promptExtractionAccumulator) extractJSONPayload(payload map[string]any) {
	if modelStr, ok := payload["model"].(string); ok && modelStr != "" {
		a.metadata["model"] = modelStr
		if a.meta.ModelName == "" {
			a.meta.ModelName = modelStr
		}
	}

	// Capture scalar/compact request metadata without duplicating prompt or base64 blobs.
	for _, key := range []string{
		"stream", "temperature", "top_p", "top_k", "max_tokens", "max_completion_tokens",
		"max_output_tokens", "n", "size", "quality", "style", "background", "voice",
		"response_format", "reasoning_effort", "seconds", "duration", "aspect_ratio",
		"resolution", "action", "task_id", "top_n",
	} {
		if v, ok := payload[key]; ok && v != nil {
			a.metadata[key] = v
		}
	}
	if tools, ok := payload["tools"].([]any); ok && len(tools) > 0 {
		names := make([]string, 0, len(tools))
		for _, item := range tools {
			if tm, ok := item.(map[string]any); ok {
				if name, ok := tm["name"].(string); ok && name != "" {
					names = append(names, name)
				} else if fn, ok := tm["function"].(map[string]any); ok {
					if name, ok := fn["name"].(string); ok && name != "" {
						names = append(names, name)
					}
				}
			}
		}
		a.metadata["tool_count"] = len(tools)
		if len(names) > 0 {
			a.metadata["tools"] = names
		}
	}

	// 1. Top-level instructions / system (Anthropic system or OpenAI Responses instructions)
	if inst, ok := payload["instructions"]; ok {
		if text := a.extractArbitraryContent("instructions", inst); text != "" {
			a.addSection("instructions", text, false)
		}
	}
	if sys, ok := payload["system"]; ok {
		if text := a.extractArbitraryContent("system", sys); text != "" {
			a.addSection("system", text, false)
		}
	}
	for _, sysKey := range []string{"systemInstruction", "system_instruction"} {
		if sysInst, ok := payload[sysKey].(map[string]any); ok {
			if text := a.extractGeminiParts(sysInst["parts"]); text != "" {
				a.addSection("system", text, false)
			}
		}
	}

	// 2. Chat / Anthropic / OpenAI messages
	if msgs, ok := payload["messages"].([]any); ok {
		for _, rawMsg := range msgs {
			msg, ok := rawMsg.(map[string]any)
			if !ok {
				continue
			}
			a.messageCount++
			role, _ := msg["role"].(string)
			if role == "" {
				role = "user"
			}
			isUser := strings.EqualFold(role, "user")
			parts := make([]string, 0, 2)
			if content, ok := msg["content"]; ok {
				if rendered := a.extractArbitraryContent("messages.content", content); rendered != "" {
					parts = append(parts, rendered)
				}
			}
			if rc, ok := msg["reasoning_content"].(string); ok && strings.TrimSpace(rc) != "" {
				parts = append(parts, "[reasoning] "+strings.TrimSpace(rc))
			}
			if tc, ok := msg["tool_calls"].([]any); ok && len(tc) > 0 {
				parts = append(parts, fmt.Sprintf("[tool_calls: %d]", len(tc)))
			}
			if len(parts) > 0 {
				a.addSection(role, strings.Join(parts, "\n"), isUser)
			}
		}
	}

	// 3. Gemini contents
	if contents, ok := payload["contents"].([]any); ok {
		for _, rawContent := range contents {
			contentMap, ok := rawContent.(map[string]any)
			if !ok {
				continue
			}
			a.messageCount++
			role, _ := contentMap["role"].(string)
			if role == "" {
				role = "user"
			}
			isUser := strings.EqualFold(role, "user")
			if rendered := a.extractGeminiParts(contentMap["parts"]); rendered != "" {
				a.addSection(role, rendered, isUser)
			}
		}
	}

	// 4. OpenAI Responses / Embeddings / Audio `input`
	if inputVal, ok := payload["input"]; ok {
		a.extractResponsesOrGenericInput(inputVal)
	}

	// 5. Prompts, completions, rerank, Midjourney, video/image fields
	for _, textKey := range []string{"prompt", "negative_prompt", "prefix", "suffix", "query", "instruction", "text"} {
		if val, ok := payload[textKey]; ok {
			if rendered := a.extractArbitraryContent(textKey, val); rendered != "" {
				a.messageCount++
				a.addSection(textKey, rendered, textKey == "prompt" || textKey == "query" || textKey == "text")
			}
		}
	}
	if docs, ok := payload["documents"].([]any); ok && len(docs) > 0 {
		a.metadata["document_count"] = len(docs)
		docParts := make([]string, 0, min(len(docs), 10))
		for idx, d := range docs {
			if idx >= 10 {
				docParts = append(docParts, fmt.Sprintf("... (%d total documents)", len(docs)))
				break
			}
			switch v := d.(type) {
			case string:
				docParts = append(docParts, fmt.Sprintf("[%d] %s", idx+1, truncateUTF8(v, 400)))
			case map[string]any:
				if t, ok := v["text"].(string); ok {
					docParts = append(docParts, fmt.Sprintf("[%d] %s", idx+1, truncateUTF8(t, 400)))
				}
			}
		}
		if len(docParts) > 0 {
			a.addSection("documents", strings.Join(docParts, "\n"), false)
		}
	}

	// 6. Top-level media fields across Image / Audio / Video / Midjourney / Task Plugins
	mediaKeys := []string{
		"image", "images", "mask", "image_url", "imageUrl", "first_frame_image", "last_frame_image",
		"input_reference", "reference_images", "base64", "base64Array", "sourceBase64", "targetBase64",
		"audio", "audio_url", "ref_audio", "video", "video_url", "file", "files",
	}
	for _, key := range mediaKeys {
		if val, ok := payload[key]; ok {
			a.extractTopLevelMediaField(key, val)
		}
	}
}

func (a *promptExtractionAccumulator) extractResponsesOrGenericInput(val any) {
	switch v := val.(type) {
	case string:
		if strings.TrimSpace(v) != "" {
			a.messageCount++
			a.addSection("input", v, true)
		}
	case []any:
		for _, item := range v {
			switch typed := item.(type) {
			case string:
				if strings.TrimSpace(typed) != "" {
					a.messageCount++
					a.addSection("input", typed, true)
				}
			case map[string]any:
				a.messageCount++
				role, _ := typed["role"].(string)
				itemType, _ := typed["type"].(string)
				if role == "" {
					if itemType == "function_call_output" {
						role = "tool"
					} else {
						role = "user"
					}
				}
				isUser := strings.EqualFold(role, "user")
				var rendered string
				if cVal, hasContent := typed["content"]; hasContent {
					rendered = a.extractArbitraryContent("input.content", cVal)
				} else if outVal, hasOut := typed["output"]; hasOut {
					rendered = a.extractArbitraryContent("input.output", outVal)
				} else {
					rendered = a.extractArbitraryContent("input", typed)
				}
				if rendered != "" {
					a.addSection(role, rendered, isUser)
				}
			}
		}
	case map[string]any:
		if rendered := a.extractArbitraryContent("input", v); rendered != "" {
			a.messageCount++
			a.addSection("input", rendered, true)
		}
	}
}

func (a *promptExtractionAccumulator) extractGeminiParts(rawParts any) string {
	parts, ok := rawParts.([]any)
	if !ok {
		return ""
	}
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		partMap, ok := p.(map[string]any)
		if !ok {
			continue
		}
		if txt, ok := partMap["text"].(string); ok && txt != "" {
			out = append(out, txt)
		}
		for _, inlineKey := range []string{"inlineData", "inline_data"} {
			if inline, ok := partMap[inlineKey].(map[string]any); ok {
				mimeType := firstString(inline, "mimeType", "mime_type")
				dataStr, _ := inline["data"].(string)
				if dataStr != "" {
					att := a.ingestBase64OrDataURI("", inlineKey, "", mimeType, dataStr)
					out = append(out, formatAttachmentMarker(att))
				}
			}
		}
		for _, fileDataKey := range []string{"fileData", "file_data"} {
			if fileData, ok := partMap[fileDataKey].(map[string]any); ok {
				mimeType := firstString(fileData, "mimeType", "mime_type")
				uri := firstString(fileData, "fileUri", "file_uri")
				if uri != "" {
					marker := a.ingestMediaString(fileDataKey, "", uri, mimeType)
					out = append(out, marker)
				}
			}
		}
	}
	return strings.Join(out, "\n")
}

func (a *promptExtractionAccumulator) extractArbitraryContent(fieldName string, val any) string {
	switch v := val.(type) {
	case string:
		if strings.HasPrefix(strings.TrimSpace(v), "data:") {
			att := a.ingestBase64OrDataURI("", fieldName, "", "", strings.TrimSpace(v))
			return formatAttachmentMarker(att)
		}
		return v
	case []any:
		lines := make([]string, 0, len(v))
		for _, item := range v {
			if s := a.extractArbitraryContent(fieldName, item); s != "" {
				lines = append(lines, s)
			}
		}
		return strings.Join(lines, "\n")
	case map[string]any:
		partType, _ := v["type"].(string)
		switch partType {
		case "text", "input_text", "output_text":
			if txt, ok := v["text"].(string); ok {
				return txt
			}
		case "image_url", "input_image":
			urlStr := ""
			if imgObj, ok := v["image_url"].(map[string]any); ok {
				urlStr, _ = imgObj["url"].(string)
			} else if direct, ok := v["image_url"].(string); ok {
				urlStr = direct
			} else if urlField, ok := v["url"].(string); ok {
				urlStr = urlField
			}
			if urlStr != "" {
				return a.ingestMediaString("image", "", urlStr, "")
			}
			if fid, ok := v["file_id"].(string); ok && fid != "" {
				return fmt.Sprintf("[image file_id: %s]", fid)
			}
		case "image", "document":
			title, _ := v["title"].(string)
			if src, ok := v["source"].(map[string]any); ok {
				srcType, _ := src["type"].(string)
				mediaType := firstString(src, "media_type", "mime_type")
				switch srcType {
				case "base64":
					dataStr, _ := src["data"].(string)
					if dataStr != "" {
						att := a.ingestBase64OrDataURI(partType, partType, title, mediaType, dataStr)
						return formatAttachmentMarker(att)
					}
				case "url":
					if urlStr, ok := src["url"].(string); ok && urlStr != "" {
						return a.ingestMediaString(partType, title, urlStr, mediaType)
					}
				case "text":
					if txt, ok := src["data"].(string); ok && txt != "" {
						att := a.saveBytesAttachment("document", "inline_text", partType, title, mediaType, []byte(txt), int64(len(txt)) > a.maxFileBytes, int64(len(txt)))
						return formatAttachmentMarker(att)
					}
				}
			}
		case "input_audio", "audio":
			if audioObj, ok := v["input_audio"].(map[string]any); ok {
				formatStr, _ := audioObj["format"].(string)
				dataStr, _ := audioObj["data"].(string)
				if dataStr != "" {
					att := a.ingestBase64OrDataURI("audio", "input_audio", "", mimeFromAudioFormat(formatStr), dataStr)
					return formatAttachmentMarker(att)
				}
			} else if dataStr, ok := v["data"].(string); ok && dataStr != "" {
				formatStr, _ := v["format"].(string)
				att := a.ingestBase64OrDataURI("audio", "input_audio", "", mimeFromAudioFormat(formatStr), dataStr)
				return formatAttachmentMarker(att)
			}
		case "file", "input_file":
			fileObj := v
			if nested, ok := v["file"].(map[string]any); ok {
				fileObj = nested
			}
			filename := firstString(fileObj, "filename", "name")
			if fileData, ok := fileObj["file_data"].(string); ok && fileData != "" {
				att := a.ingestBase64OrDataURI("file", partType, filename, "", fileData)
				return formatAttachmentMarker(att)
			}
			if fileURL, ok := fileObj["file_url"].(string); ok && fileURL != "" {
				return a.ingestMediaString(partType, filename, fileURL, "")
			}
			if fileID, ok := fileObj["file_id"].(string); ok && fileID != "" {
				return fmt.Sprintf("[file reference: %s (%s)]", fileID, filename)
			}
		case "video_url", "input_video":
			urlStr := firstString(v, "url", "video_url")
			if vObj, ok := v["video_url"].(map[string]any); ok {
				if u, ok := vObj["url"].(string); ok {
					urlStr = u
				}
			}
			if urlStr != "" {
				return a.ingestMediaString("video", "", urlStr, "")
			}
		case "tool_result":
			if nested, ok := v["content"]; ok {
				return a.extractArbitraryContent("tool_result", nested)
			}
		}

		// Fallback for unstructured content map parts (e.g. direct text or url fields).
		if txt, ok := v["text"].(string); ok && txt != "" {
			return txt
		}
		if cVal, ok := v["content"]; ok {
			return a.extractArbitraryContent(fieldName, cVal)
		}
	}
	return ""
}

func (a *promptExtractionAccumulator) extractTopLevelMediaField(fieldName string, val any) {
	switch v := val.(type) {
	case string:
		if strings.TrimSpace(v) == "" {
			return
		}
		marker := a.ingestMediaString(fieldName, "", v, "")
		a.addInlineMarker(fieldName, marker)
	case []any:
		for _, item := range v {
			a.extractTopLevelMediaField(fieldName, item)
		}
	case map[string]any:
		if rendered := a.extractArbitraryContent(fieldName, v); rendered != "" {
			a.addInlineMarker(fieldName, rendered)
		} else {
			if urlStr := firstString(v, "url", "image_url", "file_url", "uri"); urlStr != "" {
				marker := a.ingestMediaString(fieldName, firstString(v, "filename", "name"), urlStr, firstString(v, "mime_type", "mimeType"))
				a.addInlineMarker(fieldName, marker)
			}
			if b64Str := firstString(v, "data", "b64_json", "base64", "file_data"); b64Str != "" {
				att := a.ingestBase64OrDataURI("", fieldName, firstString(v, "filename", "name"), firstString(v, "mime_type", "mimeType"), b64Str)
				a.addInlineMarker(fieldName, formatAttachmentMarker(att))
			}
		}
	}
}

func (a *promptExtractionAccumulator) ingestMediaString(fieldName, fileName, rawVal, explicitMime string) string {
	trimmed := strings.TrimSpace(rawVal)
	if trimmed == "" {
		return ""
	}
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "data:") || looksLikeBase64Payload(fieldName, trimmed) {
		att := a.ingestBase64OrDataURI("", fieldName, fileName, explicitMime, trimmed)
		return formatAttachmentMarker(att)
	}
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "gs://") {
		att := a.addURLAttachment("", fieldName, trimmed, fileName, explicitMime)
		return formatAttachmentMarker(att)
	}
	return truncateUTF8(trimmed, 512)
}

func (a *promptExtractionAccumulator) ingestBase64OrDataURI(kind, fieldName, fileName, explicitMime, raw string) model.ChannelPromptAttachment {
	trimmed := strings.TrimSpace(raw)
	mimeType := explicitMime
	payload := trimmed
	isDataURI := false

	if strings.HasPrefix(strings.ToLower(trimmed), "data:") {
		isDataURI = true
		rest := trimmed[5:]
		if comma := strings.IndexByte(rest, ','); comma >= 0 {
			header := rest[:comma]
			payload = rest[comma+1:]
			isB64 := false
			parts := strings.Split(header, ";")
			for idx, p := range parts {
				pTrim := strings.TrimSpace(p)
				if idx == 0 && pTrim != "" && strings.Contains(pTrim, "/") {
					mimeType = pTrim
				} else if strings.EqualFold(pTrim, "base64") {
					isB64 = true
				}
			}
			if !isB64 {
				decodedText, err := url.QueryUnescape(payload)
				if err != nil {
					decodedText = payload
				}
				rawBytes := []byte(decodedText)
				return a.saveBytesAttachment(kind, "inline_text", fieldName, fileName, mimeType, rawBytes, int64(len(rawBytes)) > a.maxFileBytes, int64(len(rawBytes)))
			}
		}
	}

	cleaned := strings.NewReplacer("\r", "", "\n", "", " ", "").Replace(payload)
	estimatedSize := int64(len(cleaned) * 3 / 4)
	if estimatedSize > a.maxFileBytes {
		return a.saveBytesAttachment(kind, "inline_base64", fieldName, fileName, mimeType, nil, true, estimatedSize)
	}
	decoded, err := decodeBase64Flexible(cleaned)
	if err != nil {
		if !isDataURI && len(trimmed) < 2048 && !strings.Contains(fieldName, "base64") {
			return a.addURLAttachment(kind, fieldName, trimmed, fileName, mimeType)
		}
		att := a.saveBytesAttachment(kind, "inline_base64", fieldName, fileName, mimeType, nil, false, 0)
		att.Error = "invalid base64 payload"
		a.attachments[len(a.attachments)-1] = att
		return att
	}
	return a.saveBytesAttachment(kind, "inline_base64", fieldName, fileName, mimeType, decoded, false, int64(len(decoded)))
}

func decodeBase64Flexible(cleaned string) ([]byte, error) {
	if b, err := base64.StdEncoding.DecodeString(cleaned); err == nil {
		return b, nil
	}
	if b, err := base64.RawStdEncoding.DecodeString(strings.TrimRight(cleaned, "=")); err == nil {
		return b, nil
	}
	return base64.URLEncoding.DecodeString(cleaned)
}

func isMediaValueCandidate(fieldName, val string) bool {
	trimmed := strings.TrimSpace(val)
	if trimmed == "" {
		return false
	}
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "data:") {
		return true
	}
	return looksLikeBase64Payload(fieldName, trimmed) ||
		((strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://")) && strings.Contains(strings.ToLower(fieldName), "image"))
}

func looksLikeBase64Payload(fieldName, trimmed string) bool {
	lowerField := strings.ToLower(fieldName)
	isMediaField := strings.Contains(lowerField, "image") ||
		strings.Contains(lowerField, "mask") ||
		strings.Contains(lowerField, "audio") ||
		strings.Contains(lowerField, "video") ||
		strings.Contains(lowerField, "base64") ||
		strings.Contains(lowerField, "file")
	if !isMediaField || len(trimmed) < 64 {
		return false
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") || strings.ContainsAny(trimmed, " \t") {
		return false
	}
	return true
}

func formatAttachmentMarker(att model.ChannelPromptAttachment) string {
	label := att.Kind
	if label == "" {
		label = "file"
	}
	metaParts := make([]string, 0, 3)
	if att.MimeType != "" {
		metaParts = append(metaParts, att.MimeType)
	}
	if att.FileName != "" {
		metaParts = append(metaParts, att.FileName)
	}
	if att.SizeBytes > 0 {
		metaParts = append(metaParts, formatByteSize(att.SizeBytes))
	} else if att.ExternalURL != "" {
		metaParts = append(metaParts, truncateUTF8(att.ExternalURL, 120))
	}
	if att.Error != "" {
		metaParts = append(metaParts, att.Error)
	}
	if len(metaParts) == 0 {
		return fmt.Sprintf("[%s #%s]", label, att.ID)
	}
	return fmt.Sprintf("[%s #%s: %s]", label, att.ID, strings.Join(metaParts, ", "))
}

func formatByteSize(b int64) string {
	if b < 1024 {
		return fmt.Sprintf("%d B", b)
	}
	if b < 1024*1024 {
		return fmt.Sprintf("%.1f KB", float64(b)/1024.0)
	}
	return fmt.Sprintf("%.1f MB", float64(b)/(1024.0*1024.0))
}

func firstString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func normalizeMimeType(raw string) string {
	trimmed := strings.TrimSpace(strings.ToLower(raw))
	if trimmed == "" {
		return ""
	}
	if semi := strings.IndexByte(trimmed, ';'); semi >= 0 {
		trimmed = strings.TrimSpace(trimmed[:semi])
	}
	return trimmed
}

func mimeFromAudioFormat(format string) string {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "wav":
		return "audio/wav"
	case "mp3":
		return "audio/mpeg"
	case "ogg", "opus":
		return "audio/ogg"
	case "flac":
		return "audio/flac"
	case "m4a", "mp4":
		return "audio/mp4"
	case "aac":
		return "audio/aac"
	case "webm":
		return "audio/webm"
	default:
		return "audio/mpeg"
	}
}

func classifyAttachmentKind(mimeType, fileName, fieldName string) string {
	lowerMime := strings.ToLower(mimeType)
	switch {
	case strings.HasPrefix(lowerMime, "image/"):
		return "image"
	case strings.HasPrefix(lowerMime, "audio/"):
		return "audio"
	case strings.HasPrefix(lowerMime, "video/"):
		return "video"
	case lowerMime == "application/pdf",
		strings.HasPrefix(lowerMime, "text/"),
		strings.Contains(lowerMime, "json"),
		strings.Contains(lowerMime, "wordprocessingml"),
		strings.Contains(lowerMime, "spreadsheetml"),
		strings.Contains(lowerMime, "presentationml"),
		lowerMime == "application/msword",
		lowerMime == "application/vnd.ms-excel":
		return "document"
	}
	lowerExt := strings.ToLower(filepath.Ext(fileName))
	switch lowerExt {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".avif":
		return "image"
	case ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus":
		return "audio"
	case ".mp4", ".webm", ".mov", ".avi", ".mkv":
		return "video"
	case ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv", ".json":
		return "document"
	}
	lowerField := strings.ToLower(fieldName)
	switch {
	case strings.Contains(lowerField, "image"), strings.Contains(lowerField, "mask"):
		return "image"
	case strings.Contains(lowerField, "audio"):
		return "audio"
	case strings.Contains(lowerField, "video"):
		return "video"
	case strings.Contains(lowerField, "document"):
		return "document"
	default:
		return "file"
	}
}

func chooseSafeExtension(mimeType, fileName string) string {
	if ext, ok := mimeToExtension[normalizeMimeType(mimeType)]; ok {
		return ext
	}
	rawExt := strings.ToLower(filepath.Ext(fileName))
	if len(rawExt) >= 2 && len(rawExt) <= 8 && rawExt[0] == '.' {
		valid := true
		for _, ch := range rawExt[1:] {
			if !((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
				valid = false
				break
			}
		}
		if valid {
			return rawExt
		}
	}
	return ".bin"
}

func sanitizePathSegment(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
		if b.Len() >= 48 {
			break
		}
	}
	return b.String()
}

func sanitizeFileName(raw string) string {
	base := filepath.Base(strings.TrimSpace(raw))
	if base == "." || base == ".." || base == "/" || base == "\\" {
		return ""
	}
	var b strings.Builder
	for _, r := range base {
		if r == '/' || r == '\\' || r < 32 {
			continue
		}
		b.WriteRune(r)
		if b.Len() >= 96 {
			break
		}
	}
	return strings.TrimSpace(b.String())
}

func fileNameFromURL(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	base := path.Base(parsed.Path)
	if base == "." || base == "/" {
		return ""
	}
	return sanitizeFileName(base)
}

func collapseWhitespaceAndTruncate(s string, maxRunes int) string {
	collapsed := strings.Join(strings.Fields(s), " ")
	runes := []rune(collapsed)
	if len(runes) <= maxRunes {
		return collapsed
	}
	return string(runes[:maxRunes]) + "..."
}

func truncateUTF8(s string, maxBytes int) string {
	if maxBytes <= 0 || len(s) <= maxBytes {
		return s
	}
	cut := maxBytes
	for cut > 0 && !utf8.RuneStart(s[cut]) {
		cut--
	}
	return s[:cut]
}

// ResolvePromptAttachmentPath resolves a stored relative attachment path inside
// PromptLogMediaRoot and rejects any directory traversal attempt.
func ResolvePromptAttachmentPath(relPath string) (string, error) {
	trimmed := strings.TrimSpace(relPath)
	if trimmed == "" {
		return "", errors.New("attachment has no stored file")
	}
	cleaned := filepath.Clean(filepath.FromSlash(trimmed))
	if filepath.IsAbs(cleaned) || strings.HasPrefix(cleaned, "..") {
		return "", errors.New("invalid attachment path")
	}
	rootAbs, err := filepath.Abs(PromptLogMediaRoot())
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(filepath.Join(rootAbs, cleaned))
	if err != nil {
		return "", err
	}
	relCheck, err := filepath.Rel(rootAbs, targetAbs)
	if err != nil || relCheck == "." || strings.HasPrefix(relCheck, "..") {
		return "", errors.New("attachment path escapes media root")
	}
	info, err := os.Lstat(targetAbs)
	if err != nil {
		return "", err
	}
	if info.Mode()&os.ModeSymlink != 0 || info.IsDir() {
		return "", errors.New("invalid attachment file type")
	}
	return targetAbs, nil
}

// SafePromptAttachmentContentType prevents active web content (like SVG/HTML)
// from executing scripts when previewed inline in a browser.
func SafePromptAttachmentContentType(mimeType string) (contentType string, allowInline bool) {
	normalized := normalizeMimeType(mimeType)
	if previewSafeInlineMIMEs[normalized] {
		return normalized, true
	}
	if normalized == "" || normalized == "image/svg+xml" || normalized == "text/html" || strings.Contains(normalized, "javascript") {
		return "application/octet-stream", false
	}
	return normalized, false
}

// DeletePromptAttachmentFiles removes all on-disk files referenced by the given
// prompt log entries and prunes empty parent directories up to the media root.
func DeletePromptAttachmentFiles(logs []*model.ChannelPromptLog) {
	if len(logs) == 0 {
		return
	}
	parentDirs := make(map[string]struct{})
	for _, entry := range logs {
		if entry == nil {
			continue
		}
		for _, att := range entry.GetAttachments() {
			if att.RelativePath == "" {
				continue
			}
			absPath, err := ResolvePromptAttachmentPath(att.RelativePath)
			if err != nil {
				continue
			}
			_ = os.Remove(absPath)
			parentDirs[filepath.Dir(absPath)] = struct{}{}
		}
	}
	rootAbs, err := filepath.Abs(PromptLogMediaRoot())
	if err != nil {
		return
	}
	sortedDirs := make([]string, 0, len(parentDirs))
	for dir := range parentDirs {
		sortedDirs = append(sortedDirs, dir)
	}
	sort.Slice(sortedDirs, func(i, j int) bool {
		return len(sortedDirs[i]) > len(sortedDirs[j])
	})
	for _, dir := range sortedDirs {
		for curr := dir; curr != rootAbs && strings.HasPrefix(curr, rootAbs+string(os.PathSeparator)); curr = filepath.Dir(curr) {
			if rmErr := os.Remove(curr); rmErr != nil {
				break
			}
		}
	}
}

// CleanupPromptLogs deletes matching prompt log rows and their stored disk media.
func CleanupPromptLogs(beforeTimestamp int64, channelID int) (int64, error) {
	removed, err := model.CleanupChannelPromptLogs(beforeTimestamp, channelID)
	if len(removed) > 0 {
		DeletePromptAttachmentFiles(removed)
	}
	return int64(len(removed)), err
}

// StartPromptLogCleanupTask periodically purges expired prompt logs and their
// stored media files based on prompt_log_setting.retention_days.
func StartPromptLogCleanupTask() {
	promptLogCleanupOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			runRetentionCleanup := func() {
				days := operation_setting.GetPromptLogSetting().RetentionDays
				if days <= 0 {
					return
				}
				cutoff := common.GetTimestamp() - int64(days)*int64(24*time.Hour/time.Second)
				deleted, err := CleanupPromptLogs(cutoff, 0)
				if err != nil {
					common.SysError(common.LogText("prompt log retention cleanup failed: %s", err.Error()))
					return
				}
				if deleted > 0 {
					common.SysLog(common.LogText("cleaned up %s expired channel prompt log(s)", strconv.FormatInt(deleted, 10)))
				}
			}

			ticker := time.NewTicker(promptLogCleanupInterval)
			defer ticker.Stop()
			for range ticker.C {
				runRetentionCleanup()
			}
		})
	})
}
