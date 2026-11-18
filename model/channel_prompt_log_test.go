package model

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPromptLogTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "prompt_log_test.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	prevDB := DB
	DB = db
	t.Cleanup(func() {
		DB = prevDB
		_ = sqlDB.Close()
	})
	require.NoError(t, db.AutoMigrate(&Channel{}, &ChannelPromptLog{}))
}

func TestChannelPromptLogCRUDFilterAndCleanup(t *testing.T) {
	setupPromptLogTestDB(t)

	att1 := ChannelPromptAttachment{
		ID:           "att_01_abc",
		Kind:         "image",
		Source:       "inline_base64",
		MimeType:     "image/png",
		FileName:     "img.png",
		SizeBytes:    128,
		RelativePath: "2026-11-18/req1/01.png",
	}
	entry1 := &ChannelPromptLog{
		CreatedAt:     1000,
		RequestId:     "req-1",
		ChannelId:     12,
		ChannelName:   "OpenAI-Main",
		ChannelType:   1,
		UserId:        7,
		Username:      "alice",
		TokenId:       3,
		TokenName:     "dev-key",
		ModelName:     "gpt-4o",
		Endpoint:      "/v1/chat/completions",
		RelayFormat:   "openai",
		PromptPreview: "describe this diagram",
		PromptText:    "[user]\ndescribe this diagram",
		MessageCount:  1,
		MetadataJSON:  `{"model":"gpt-4o"}`,
	}
	require.NoError(t, entry1.SetAttachments([]ChannelPromptAttachment{att1}))
	require.NoError(t, InsertChannelPromptLog(entry1))

	entry2 := &ChannelPromptLog{
		CreatedAt:     2000,
		RequestId:     "req-2",
		ChannelId:     15,
		ChannelName:   "Claude-Prod",
		ChannelType:   14,
		UserId:        8,
		Username:      "bob",
		ModelName:     "claude-3-7-sonnet",
		Endpoint:      "/v1/messages",
		RelayFormat:   "claude",
		PromptPreview: "write unit tests",
		PromptText:    "[user]\nwrite unit tests",
		MessageCount:  1,
	}
	require.NoError(t, InsertChannelPromptLog(entry2))

	dup, err := HasChannelPromptLog("req-1", 12)
	require.NoError(t, err)
	assert.True(t, dup)
	otherChanDup, err := HasChannelPromptLog("req-1", 15)
	require.NoError(t, err)
	assert.False(t, otherChanDup)

	hasAtt := true
	items, total, err := ListChannelPromptLogs(ChannelPromptLogFilter{
		ChannelId:      12,
		HasAttachments: &hasAtt,
		Keyword:        "diagram",
	}, 0, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, "req-1", items[0].RequestId)
	assert.True(t, items[0].HasAttachments)
	assert.Equal(t, 1, items[0].AttachmentCount)
	assert.Empty(t, items[0].PromptText, "list view should omit heavy prompt_text column")

	full, err := GetChannelPromptLogById(entry1.Id)
	require.NoError(t, err)
	assert.Equal(t, "[user]\ndescribe this diagram", full.PromptText)
	require.Len(t, full.GetAttachments(), 1)
	assert.Equal(t, "2026-11-18/req1/01.png", full.GetAttachments()[0].RelativePath)

	removed, err := CleanupChannelPromptLogs(1500, 0)
	require.NoError(t, err)
	require.Len(t, removed, 1)
	assert.Equal(t, entry1.Id, removed[0].Id)

	_, err = GetChannelPromptLogById(entry1.Id)
	require.Error(t, err)

	deleted, err := DeleteChannelPromptLogById(entry2.Id)
	require.NoError(t, err)
	assert.Equal(t, "req-2", deleted.RequestId)
}

func TestUpdateChannelPromptLogEnabledAndSummaries(t *testing.T) {
	setupPromptLogTestDB(t)
	prevCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = prevCache })

	ch := &Channel{
		Id:            21,
		Name:          "Test-Channel",
		Type:          1,
		Status:        1,
		Key:           "sk-secret-key",
		OtherSettings: `{"allow_service_tier":true}`,
	}
	require.NoError(t, DB.Create(ch).Error)

	require.NoError(t, UpdateChannelPromptLogEnabled(21, true))
	summaries, err := GetPromptLogChannelSummaries()
	require.NoError(t, err)
	require.Len(t, summaries, 1)
	assert.Equal(t, 21, summaries[0].Id)
	assert.True(t, summaries[0].PromptLogEnabled)

	var updated Channel
	require.NoError(t, DB.First(&updated, 21).Error)
	assert.Equal(t, "sk-secret-key", updated.Key)
	assert.True(t, updated.GetOtherSettings().AllowServiceTier)
	assert.True(t, updated.GetOtherSettings().PromptLogEnabled)

	require.NoError(t, UpdateChannelPromptLogEnabled(21, false))
	require.NoError(t, DB.First(&updated, 21).Error)
	assert.False(t, updated.GetOtherSettings().PromptLogEnabled)
	assert.True(t, updated.GetOtherSettings().AllowServiceTier)
}
