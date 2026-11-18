package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"gorm.io/gorm"
)

// ChannelPromptAttachment stores metadata for an image, audio, document, video,
// or other file extracted from a user's prompt payload.
type ChannelPromptAttachment struct {
	ID           string `json:"id"`
	Kind         string `json:"kind"` // image, audio, video, document, file
	Source       string `json:"source"` // inline_base64, multipart_file, url
	MimeType     string `json:"mime_type,omitempty"`
	FileName     string `json:"file_name,omitempty"`
	FieldName    string `json:"field_name,omitempty"`
	SizeBytes    int64  `json:"size_bytes,omitempty"`
	SHA256       string `json:"sha256,omitempty"`
	RelativePath string `json:"relative_path,omitempty"`
	ExternalURL  string `json:"external_url,omitempty"`
	Truncated    bool   `json:"truncated,omitempty"`
	Error        string `json:"error,omitempty"`
}

// ChannelPromptLog stores extracted user prompts and attachment metadata for
// channels that opt into prompt extraction logging. Only admins may access it.
type ChannelPromptLog struct {
	Id              int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	CreatedAt       int64  `json:"created_at" gorm:"type:bigint;index:idx_prompt_log_created;index:idx_prompt_log_channel_created,priority:2"`
	RequestId       string `json:"request_id" gorm:"type:varchar(64);index:idx_prompt_log_req"`
	ChannelId       int    `json:"channel_id" gorm:"index:idx_prompt_log_channel_created,priority:1"`
	ChannelName     string `json:"channel_name" gorm:"type:varchar(128)"`
	ChannelType     int    `json:"channel_type"`
	UserId          int    `json:"user_id" gorm:"index:idx_prompt_log_user"`
	Username        string `json:"username" gorm:"type:varchar(64);index"`
	TokenId         int    `json:"token_id" gorm:"index"`
	TokenName       string `json:"token_name" gorm:"type:varchar(64)"`
	ModelName       string `json:"model_name" gorm:"type:varchar(128);index"`
	Endpoint        string `json:"endpoint" gorm:"type:varchar(128)"`
	RelayFormat     string `json:"relay_format" gorm:"type:varchar(64)"`
	PromptPreview   string `json:"prompt_preview" gorm:"type:varchar(512)"`
	PromptText      string `json:"prompt_text" gorm:"type:text"`
	PromptTruncated bool   `json:"prompt_truncated"`
	MessageCount    int    `json:"message_count"`
	HasAttachments  bool   `json:"has_attachments" gorm:"index"`
	AttachmentCount int    `json:"attachment_count"`
	AttachmentsJSON string `json:"-" gorm:"type:text"`
	MetadataJSON    string `json:"metadata_json,omitempty" gorm:"type:text"`
}

func (ChannelPromptLog) TableName() string {
	return "channel_prompt_logs"
}

type ChannelPromptLogFilter struct {
	ChannelId      int
	UserId         int
	Username       string
	ModelName      string
	RequestId      string
	Keyword        string
	HasAttachments *bool
	StartTimestamp int64
	EndTimestamp   int64
}

func (l *ChannelPromptLog) GetAttachments() []ChannelPromptAttachment {
	if l == nil || strings.TrimSpace(l.AttachmentsJSON) == "" {
		return nil
	}
	var items []ChannelPromptAttachment
	if err := common.UnmarshalJsonStr(l.AttachmentsJSON, &items); err != nil {
		return nil
	}
	return items
}

func (l *ChannelPromptLog) SetAttachments(items []ChannelPromptAttachment) error {
	if len(items) == 0 {
		l.AttachmentsJSON = "[]"
		l.HasAttachments = false
		l.AttachmentCount = 0
		return nil
	}
	data, err := common.Marshal(items)
	if err != nil {
		return err
	}
	l.AttachmentsJSON = string(data)
	l.HasAttachments = true
	l.AttachmentCount = len(items)
	return nil
}

func InsertChannelPromptLog(entry *ChannelPromptLog) error {
	if entry == nil {
		return nil
	}
	return DB.Create(entry).Error
}

// HasChannelPromptLog checks whether a log entry for the same request and
// channel has already been persisted (e.g., on same-channel multi-key retry).
func HasChannelPromptLog(requestID string, channelID int) (bool, error) {
	if strings.TrimSpace(requestID) == "" || channelID <= 0 {
		return false, nil
	}
	var count int64
	err := DB.Model(&ChannelPromptLog{}).
		Where("request_id = ? AND channel_id = ?", requestID, channelID).
		Limit(1).
		Count(&count).Error
	return count > 0, err
}

func applyChannelPromptLogFilter(query *gorm.DB, filter ChannelPromptLogFilter) *gorm.DB {
	if filter.ChannelId > 0 {
		query = query.Where("channel_id = ?", filter.ChannelId)
	}
	if filter.UserId > 0 {
		query = query.Where("user_id = ?", filter.UserId)
	}
	if username := strings.TrimSpace(filter.Username); username != "" {
		query = query.Where("username = ?", username)
	}
	if modelName := strings.TrimSpace(filter.ModelName); modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	if requestID := strings.TrimSpace(filter.RequestId); requestID != "" {
		query = query.Where("request_id = ?", requestID)
	}
	if filter.HasAttachments != nil {
		query = query.Where("has_attachments = ?", *filter.HasAttachments)
	}
	if filter.StartTimestamp > 0 {
		query = query.Where("created_at >= ?", filter.StartTimestamp)
	}
	if filter.EndTimestamp > 0 {
		query = query.Where("created_at <= ?", filter.EndTimestamp)
	}
	if kw := strings.TrimSpace(filter.Keyword); kw != "" {
		pattern := "%" + strings.ToLower(kw) + "%"
		query = query.Where(
			"LOWER(prompt_preview) LIKE ? OR LOWER(model_name) LIKE ? OR LOWER(request_id) LIKE ? OR LOWER(username) LIKE ? OR LOWER(channel_name) LIKE ?",
			pattern, pattern, pattern, pattern, pattern,
		)
	}
	return query
}

func ListChannelPromptLogs(filter ChannelPromptLogFilter, startIdx int, limit int) ([]*ChannelPromptLog, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if startIdx < 0 {
		startIdx = 0
	}
	base := applyChannelPromptLogFilter(DB.Model(&ChannelPromptLog{}), filter)
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	logs := make([]*ChannelPromptLog, 0)
	// Omit heavy prompt_text and metadata_json columns on paginated list queries.
	err := base.Select(
		"id", "created_at", "request_id", "channel_id", "channel_name", "channel_type",
		"user_id", "username", "token_id", "token_name", "model_name", "endpoint", "relay_format",
		"prompt_preview", "prompt_truncated", "message_count",
		"has_attachments", "attachment_count", "attachments_json",
	).
		Order("created_at DESC, id DESC").
		Offset(startIdx).
		Limit(limit).
		Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

func GetChannelPromptLogById(id int64) (*ChannelPromptLog, error) {
	if id <= 0 {
		return nil, errors.New("invalid prompt log id")
	}
	var entry ChannelPromptLog
	err := DB.First(&entry, id).Error
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func DeleteChannelPromptLogById(id int64) (*ChannelPromptLog, error) {
	entry, err := GetChannelPromptLogById(id)
	if err != nil {
		return nil, err
	}
	if err := DB.Delete(&ChannelPromptLog{}, entry.Id).Error; err != nil {
		return nil, err
	}
	return entry, nil
}

// CleanupChannelPromptLogs deletes matching logs in bounded batches and
// returns the deleted rows so callers can remove their stored media files.
func CleanupChannelPromptLogs(beforeTimestamp int64, channelID int) ([]*ChannelPromptLog, error) {
	const batchSize = 200
	var removed []*ChannelPromptLog
	for {
		var batch []*ChannelPromptLog
		q := DB.Model(&ChannelPromptLog{}).Select("id", "attachments_json")
		if beforeTimestamp > 0 {
			q = q.Where("created_at < ?", beforeTimestamp)
		}
		if channelID > 0 {
			q = q.Where("channel_id = ?", channelID)
		}
		if err := q.Order("id ASC").Limit(batchSize).Find(&batch).Error; err != nil {
			return removed, err
		}
		if len(batch) == 0 {
			break
		}
		ids := make([]int64, 0, len(batch))
		for _, item := range batch {
			ids = append(ids, item.Id)
		}
		if err := DB.Where("id IN ?", ids).Delete(&ChannelPromptLog{}).Error; err != nil {
			return removed, err
		}
		removed = append(removed, batch...)
		if len(batch) < batchSize {
			break
		}
	}
	return removed, nil
}

// PromptLogChannelSummary is a sanitized channel view excluding keys and
// upstream URLs, used in the admin prompt log management UI.
type PromptLogChannelSummary struct {
	Id               int    `json:"id"`
	Name             string `json:"name"`
	Type             int    `json:"type"`
	Status           int    `json:"status"`
	PromptLogEnabled bool   `json:"prompt_log_enabled"`
}

func GetPromptLogChannelSummaries() ([]PromptLogChannelSummary, error) {
	type channelRow struct {
		Id            int    `gorm:"column:id"`
		Name          string `gorm:"column:name"`
		Type          int    `gorm:"column:type"`
		Status        int    `gorm:"column:status"`
		OtherSettings string `gorm:"column:settings"`
	}
	var rows []channelRow
	if err := DB.Model(&Channel{}).
		Select("id", "name", "type", "status", "settings").
		Order("id DESC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	summaries := make([]PromptLogChannelSummary, 0, len(rows))
	for _, row := range rows {
		var other dto.ChannelOtherSettings
		if strings.TrimSpace(row.OtherSettings) != "" {
			_ = common.UnmarshalJsonStr(row.OtherSettings, &other)
		}
		summaries = append(summaries, PromptLogChannelSummary{
			Id:               row.Id,
			Name:             row.Name,
			Type:             row.Type,
			Status:           row.Status,
			PromptLogEnabled: other.PromptLogEnabled,
		})
	}
	return summaries, nil
}

func UpdateChannelPromptLogEnabled(channelID int, enabled bool) error {
	if channelID <= 0 {
		return errors.New("invalid channel id")
	}
	var row struct {
		Id            int    `gorm:"column:id"`
		OtherSettings string `gorm:"column:settings"`
	}
	if err := DB.Model(&Channel{}).Select("id", "settings").First(&row, "id = ?", channelID).Error; err != nil {
		return err
	}
	// Preserve raw settings JSON fields untouched except prompt_log_enabled.
	settingsMap := make(map[string]any)
	if strings.TrimSpace(row.OtherSettings) != "" {
		if err := common.UnmarshalJsonStr(row.OtherSettings, &settingsMap); err != nil || settingsMap == nil {
			settingsMap = make(map[string]any)
		}
	}
	if enabled {
		settingsMap["prompt_log_enabled"] = true
	} else {
		delete(settingsMap, "prompt_log_enabled")
	}
	encoded, err := common.Marshal(settingsMap)
	if err != nil {
		return err
	}
	if err := DB.Model(&Channel{}).Where("id = ?", channelID).Update("settings", string(encoded)).Error; err != nil {
		return err
	}
	InitChannelCache()
	return nil
}
