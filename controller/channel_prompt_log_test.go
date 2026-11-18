package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPromptControllerTestEnv(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("PROMPT_LOG_DATA_DIR", filepath.Join(t.TempDir(), "prompt-logs"))

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "ctrl_prompt_log.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	prevDB := model.DB
	prevLogDB := model.LOG_DB
	prevCache := common.MemoryCacheEnabled
	common.OptionMapRWMutex.Lock()
	prevOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	model.DB = db
	model.LOG_DB = db
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		model.DB = prevDB
		model.LOG_DB = prevLogDB
		common.MemoryCacheEnabled = prevCache
		common.OptionMapRWMutex.Lock()
		common.OptionMap = prevOptionMap
		common.OptionMapRWMutex.Unlock()
		_ = sqlDB.Close()
	})
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Option{}, &model.AuditLog{}, &model.ChannelPromptLog{}))

	if cfg := config.GlobalConfig.Get("prompt_log_setting"); cfg != nil {
		_ = config.UpdateConfigFromMap(cfg, map[string]string{
			"enabled":          "true",
			"retention_days":   "7",
			"max_text_bytes":   "65536",
			"max_file_size_mb": "20",
		})
	}
}

func TestPromptLogControllerListDetailDownloadSettingsAndDelete(t *testing.T) {
	setupPromptControllerTestEnv(t)

	mediaDir := filepath.Join(service.PromptLogMediaRoot(), "2026-11-18", "req-ctrl")
	require.NoError(t, os.MkdirAll(mediaDir, 0o755))
	mediaPath := filepath.Join(mediaDir, "01_test.png")
	require.NoError(t, os.WriteFile(mediaPath, []byte("PNGDATA"), 0o640))

	entry := &model.ChannelPromptLog{
		CreatedAt:     common.GetTimestamp(),
		RequestId:     "req-ctrl-1",
		ChannelId:     3,
		ChannelName:   "OpenAI",
		ChannelType:   1,
		UserId:        10,
		Username:      "alice",
		ModelName:     "gpt-4o",
		Endpoint:      "/v1/chat/completions",
		RelayFormat:   "openai",
		PromptPreview: "hello world",
		PromptText:    "[user]\nhello world",
		MessageCount:  1,
		MetadataJSON:  `{"model":"gpt-4o"}`,
	}
	require.NoError(t, entry.SetAttachments([]model.ChannelPromptAttachment{{
		ID:           "att_01_ctrl",
		Kind:         "image",
		Source:       "inline_base64",
		MimeType:     "image/png",
		FileName:     "sample.png",
		SizeBytes:    7,
		RelativePath: "2026-11-18/req-ctrl/01_test.png",
	}}))
	require.NoError(t, model.InsertChannelPromptLog(entry))
	require.NoError(t, model.DB.Create(&model.Channel{Id: 3, Name: "OpenAI", Type: 1, Status: 1, Key: "k"}).Error)

	// List
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/prompt_log/?channel_id=3", nil)
	GetChannelPromptLogs(c)
	require.Equal(t, http.StatusOK, w.Code)
	var listResp struct {
		Success bool `json:"success"`
		Data    struct {
			Total int64                      `json:"total"`
			Items []ChannelPromptLogItemView `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &listResp))
	require.True(t, listResp.Success)
	require.Equal(t, int64(1), listResp.Data.Total)
	require.Len(t, listResp.Data.Items, 1)
	assert.Equal(t, fmt.Sprintf("/api/prompt_log/%d/attachments/att_01_ctrl", entry.Id), listResp.Data.Items[0].Attachments[0].DownloadURL)

	// Detail
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", entry.Id)}}
	c.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/prompt_log/%d", entry.Id), nil)
	GetChannelPromptLogDetail(c)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "hello world")

	// Attachment download
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Params = gin.Params{
		{Key: "id", Value: fmt.Sprintf("%d", entry.Id)},
		{Key: "attachment_id", Value: "att_01_ctrl"},
	}
	c.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/prompt_log/%d/attachments/att_01_ctrl", entry.Id), nil)
	DownloadChannelPromptAttachment(c)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "PNGDATA", w.Body.String())
	assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))

	// Admin (non-root) cannot change global settings
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Set("role", common.RoleAdminUser)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/prompt_log/settings", bytes.NewBufferString(`{"enabled":false}`))
	c.Request.Header.Set("Content-Type", "application/json")
	UpdatePromptLogSettings(c)
	assert.Equal(t, http.StatusForbidden, w.Code)

	// Root can update global settings
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Set("id", 1)
	c.Set("username", "root")
	c.Set("role", common.RoleRootUser)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/prompt_log/settings", bytes.NewBufferString(`{"enabled":false,"retention_days":14}`))
	c.Request.Header.Set("Content-Type", "application/json")
	UpdatePromptLogSettings(c)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"retention_days":14`)

	// Root toggles channel switch
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Set("id", 1)
	c.Set("username", "root")
	c.Set("role", common.RoleRootUser)
	c.Params = gin.Params{{Key: "id", Value: "3"}}
	c.Request = httptest.NewRequest(http.MethodPut, "/api/prompt_log/channels/3", bytes.NewBufferString(`{"enabled":true}`))
	c.Request.Header.Set("Content-Type", "application/json")
	UpdatePromptLogChannelToggle(c)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"prompt_log_enabled":true`)

	// Delete removes DB record and file
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Set("id", 1)
	c.Set("username", "root")
	c.Set("role", common.RoleRootUser)
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", entry.Id)}}
	c.Request = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/prompt_log/%d", entry.Id), nil)
	DeleteChannelPromptLog(c)
	require.Equal(t, http.StatusOK, w.Code)
	_, statErr := os.Stat(mediaPath)
	assert.True(t, os.IsNotExist(statErr))
}
