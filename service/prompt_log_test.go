package service

import (
	"bytes"
	"encoding/base64"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPromptServiceTestEnv(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("PROMPT_LOG_DATA_DIR", filepath.Join(t.TempDir(), "prompt-logs"))

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "service_prompt_log.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	prevDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = prevDB
		_ = sqlDB.Close()
	})
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.ChannelPromptLog{}))

	cfg := config.GlobalConfig.Get("prompt_log_setting")
	require.NotNil(t, cfg)
	previousSetting := operation_setting.GetPromptLogSetting()
	t.Cleanup(func() {
		require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
			"enabled":          strconv.FormatBool(previousSetting.Enabled),
			"retention_days":   strconv.Itoa(previousSetting.RetentionDays),
			"max_text_bytes":   strconv.Itoa(previousSetting.MaxTextBytes),
			"max_file_size_mb": strconv.Itoa(previousSetting.MaxFileSizeMB),
		}))
	})
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"enabled":          "true",
		"retention_days":   "7",
		"max_text_bytes":   "65536",
		"max_file_size_mb": "20",
	}))
}

func makePromptTestContext(req *http.Request) *gin.Context {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set(common.RequestIdKey, "req-test-001")
	c.Set("id", 42)
	c.Set("username", "tester")
	c.Set("token_id", 9)
	c.Set("token_name", "api-token")
	return c
}

func TestShouldCaptureChannelPromptRespectsSwitches(t *testing.T) {
	setupPromptServiceTestEnv(t)

	assert.False(t, ShouldCaptureChannelPrompt(dto.ChannelOtherSettings{PromptLogEnabled: false}))
	assert.True(t, ShouldCaptureChannelPrompt(dto.ChannelOtherSettings{PromptLogEnabled: true}))

	cfg := config.GlobalConfig.Get("prompt_log_setting")
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{"enabled": "false"}))
	assert.False(t, ShouldCaptureChannelPrompt(dto.ChannelOtherSettings{PromptLogEnabled: true}))
}

func TestCapturePromptOpenAIMultimodalAndCleanup(t *testing.T) {
	setupPromptServiceTestEnv(t)

	// Minimal valid 1x1 transparent PNG bytes.
	pngBytes, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
	require.NoError(t, err)
	dataURI := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)
	pdfBytes := []byte("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")
	pdfDataURI := "data:application/pdf;base64," + base64.StdEncoding.EncodeToString(pdfBytes)
	audioB64 := base64.StdEncoding.EncodeToString([]byte("RIFF\x00\x00\x00\x00WAVEfmt "))

	body := `{
		"model": "gpt-4o",
		"messages": [
			{"role": "system", "content": "Be concise."},
			{"role": "user", "content": [
				{"type": "text", "text": "Analyze the attached image, PDF, and audio."},
				{"type": "image_url", "image_url": {"url": "` + dataURI + `"}},
				{"type": "file", "file": {"filename": "report.pdf", "file_data": "` + pdfDataURI + `"}},
				{"type": "input_audio", "input_audio": {"format": "wav", "data": "` + audioB64 + `"}},
				{"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}}
			]}
		]
	}`

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c := makePromptTestContext(req)
	other := dto.ChannelOtherSettings{PromptLogEnabled: true}
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, other)

	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	CaptureChannelPromptFromStorage(c, 5, "Primary-OpenAI", 1, other, "gpt-4o", "openai", storage)

	// Verify request body stays intact and replayable from start.
	replayed, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	_, _ = replayed.Seek(0, 0)
	var buf bytes.Buffer
	_, err = buf.ReadFrom(replayed)
	require.NoError(t, err)
	assert.Contains(t, buf.String(), "Analyze the attached image, PDF, and audio.")

	items, total, err := model.ListChannelPromptLogs(model.ChannelPromptLogFilter{ChannelId: 5}, 0, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)

	detail, err := model.GetChannelPromptLogById(items[0].Id)
	require.NoError(t, err)
	assert.Contains(t, detail.PromptText, "Be concise.")
	assert.Contains(t, detail.PromptText, "Analyze the attached image, PDF, and audio.")
	assert.NotContains(t, detail.PromptText, "iVBORw0KGgo", "raw base64 should not bloat prompt_text")
	assert.Equal(t, "Analyze the attached image, PDF, and audio.", detail.PromptPreview)

	atts := detail.GetAttachments()
	require.Len(t, atts, 4)
	assert.Equal(t, "image", atts[0].Kind)
	assert.Equal(t, "image/png", atts[0].MimeType)
	assert.Equal(t, "document", atts[1].Kind)
	assert.Equal(t, "report.pdf", atts[1].FileName)
	assert.Equal(t, "audio", atts[2].Kind)
	assert.Equal(t, "audio/wav", atts[2].MimeType)
	assert.Equal(t, "url", atts[3].Source)
	assert.Equal(t, "https://example.com/photo.jpg", atts[3].ExternalURL)

	// Verify stored files exist on disk and resolve safely.
	for i := 0; i < 3; i++ {
		absPath, err := ResolvePromptAttachmentPath(atts[i].RelativePath)
		require.NoError(t, err)
		diskBytes, err := os.ReadFile(absPath)
		require.NoError(t, err)
		assert.NotEmpty(t, diskBytes)
	}

	// Verify path traversal rejection.
	_, err = ResolvePromptAttachmentPath("../../etc/passwd")
	require.Error(t, err)

	// Cleanup deletes both DB row and media files on disk.
	deletedCount, err := CleanupPromptLogs(0, 5)
	require.NoError(t, err)
	assert.Equal(t, int64(1), deletedCount)
	_, err = ResolvePromptAttachmentPath(atts[0].RelativePath)
	require.Error(t, err)
}

func TestCapturePromptMultipartImageEdit(t *testing.T) {
	setupPromptServiceTestEnv(t)

	pngBytes, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
	require.NoError(t, err)

	var bodyBuf bytes.Buffer
	writer := multipart.NewWriter(&bodyBuf)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("prompt", "Turn the background into a sunset beach"))
	part, err := writer.CreateFormFile("image", "avatar.png")
	require.NoError(t, err)
	_, err = part.Write(pngBytes)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/v1/images/edits", &bodyBuf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	c := makePromptTestContext(req)
	other := dto.ChannelOtherSettings{PromptLogEnabled: true}

	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	CaptureChannelPromptFromStorage(c, 8, "Image-Edit", 1, other, "gpt-image-1", "openai_image", storage)

	items, total, err := model.ListChannelPromptLogs(model.ChannelPromptLogFilter{ChannelId: 8}, 0, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	atts := items[0].GetAttachments()
	require.Len(t, atts, 1)
	assert.Equal(t, "multipart_file", atts[0].Source)
	assert.Equal(t, "avatar.png", atts[0].FileName)
	assert.Equal(t, "image", atts[0].Kind)

	absPath, err := ResolvePromptAttachmentPath(atts[0].RelativePath)
	require.NoError(t, err)
	saved, err := os.ReadFile(absPath)
	require.NoError(t, err)
	assert.Equal(t, pngBytes, saved)
}

func TestSafePromptAttachmentContentTypeBlocksSVGInline(t *testing.T) {
	ct, inline := SafePromptAttachmentContentType("image/svg+xml")
	assert.Equal(t, "application/octet-stream", ct)
	assert.False(t, inline)

	ct2, inline2 := SafePromptAttachmentContentType("image/png")
	assert.Equal(t, "image/png", ct2)
	assert.True(t, inline2)
	assert.Equal(t, operation_setting.DefaultPromptLogRetentionDays, operation_setting.GetPromptLogSetting().RetentionDays)
}
