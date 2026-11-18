package controller

import (
	"errors"
	"fmt"
	"mime"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PromptLogAttachmentView struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	Source      string `json:"source"`
	MimeType    string `json:"mime_type,omitempty"`
	FileName    string `json:"file_name,omitempty"`
	FieldName   string `json:"field_name,omitempty"`
	SizeBytes   int64  `json:"size_bytes,omitempty"`
	SHA256      string `json:"sha256,omitempty"`
	ExternalURL string `json:"external_url,omitempty"`
	Truncated   bool   `json:"truncated,omitempty"`
	Error       string `json:"error,omitempty"`
	HasFile     bool   `json:"has_file"`
	DownloadURL string `json:"download_url,omitempty"`
}

type ChannelPromptLogItemView struct {
	Id              int64                     `json:"id"`
	CreatedAt       int64                     `json:"created_at"`
	RequestId       string                    `json:"request_id"`
	ChannelId       int                       `json:"channel_id"`
	ChannelName     string                    `json:"channel_name"`
	ChannelType     int                       `json:"channel_type"`
	UserId          int                       `json:"user_id"`
	Username        string                    `json:"username"`
	TokenId         int                       `json:"token_id"`
	TokenName       string                    `json:"token_name"`
	ModelName       string                    `json:"model_name"`
	Endpoint        string                    `json:"endpoint"`
	RelayFormat     string                    `json:"relay_format"`
	PromptPreview   string                    `json:"prompt_preview"`
	PromptTruncated bool                      `json:"prompt_truncated"`
	MessageCount    int                       `json:"message_count"`
	HasAttachments  bool                      `json:"has_attachments"`
	AttachmentCount int                       `json:"attachment_count"`
	Attachments     []PromptLogAttachmentView `json:"attachments"`
}

type ChannelPromptLogDetailView struct {
	ChannelPromptLogItemView
	PromptText   string `json:"prompt_text"`
	MetadataJSON string `json:"metadata_json,omitempty"`
}

func buildPromptLogAttachmentViews(logID int64, items []model.ChannelPromptAttachment) []PromptLogAttachmentView {
	views := make([]PromptLogAttachmentView, 0, len(items))
	for _, att := range items {
		hasFile := strings.TrimSpace(att.RelativePath) != ""
		downloadURL := ""
		if hasFile {
			downloadURL = fmt.Sprintf("/api/prompt_log/%d/attachments/%s", logID, att.ID)
		}
		views = append(views, PromptLogAttachmentView{
			ID:          att.ID,
			Kind:        att.Kind,
			Source:      att.Source,
			MimeType:    att.MimeType,
			FileName:    att.FileName,
			FieldName:   att.FieldName,
			SizeBytes:   att.SizeBytes,
			SHA256:      att.SHA256,
			ExternalURL: att.ExternalURL,
			Truncated:   att.Truncated,
			Error:       att.Error,
			HasFile:     hasFile,
			DownloadURL: downloadURL,
		})
	}
	return views
}

func toPromptLogItemView(entry *model.ChannelPromptLog) ChannelPromptLogItemView {
	return ChannelPromptLogItemView{
		Id:              entry.Id,
		CreatedAt:       entry.CreatedAt,
		RequestId:       entry.RequestId,
		ChannelId:       entry.ChannelId,
		ChannelName:     entry.ChannelName,
		ChannelType:     entry.ChannelType,
		UserId:          entry.UserId,
		Username:        entry.Username,
		TokenId:         entry.TokenId,
		TokenName:       entry.TokenName,
		ModelName:       entry.ModelName,
		Endpoint:        entry.Endpoint,
		RelayFormat:     entry.RelayFormat,
		PromptPreview:   entry.PromptPreview,
		PromptTruncated: entry.PromptTruncated,
		MessageCount:    entry.MessageCount,
		HasAttachments:  entry.HasAttachments,
		AttachmentCount: entry.AttachmentCount,
		Attachments:     buildPromptLogAttachmentViews(entry.Id, entry.GetAttachments()),
	}
}

func GetChannelPromptLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	var filter model.ChannelPromptLogFilter
	if v := strings.TrimSpace(c.Query("channel_id")); v != "" {
		id, err := strconv.Atoi(v)
		if err != nil || id < 0 {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid channel_id"))
			return
		}
		filter.ChannelId = id
	}
	if v := strings.TrimSpace(c.Query("user_id")); v != "" {
		id, err := strconv.Atoi(v)
		if err != nil || id < 0 {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid user_id"))
			return
		}
		filter.UserId = id
	}
	filter.Username = c.Query("username")
	filter.ModelName = c.Query("model_name")
	filter.RequestId = c.Query("request_id")
	filter.Keyword = c.Query("keyword")
	if v := strings.TrimSpace(c.Query("has_attachments")); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid has_attachments"))
			return
		}
		filter.HasAttachments = &b
	}
	if v := strings.TrimSpace(c.Query("start_timestamp")); v != "" {
		ts, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid start_timestamp"))
			return
		}
		filter.StartTimestamp = ts
	}
	if v := strings.TrimSpace(c.Query("end_timestamp")); v != "" {
		ts, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid end_timestamp"))
			return
		}
		filter.EndTimestamp = ts
	}

	startIdx := pageInfo.GetStartIdx()
	rows, total, err := model.ListChannelPromptLogs(filter, startIdx, pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]ChannelPromptLogItemView, 0, len(rows))
	for _, row := range rows {
		items = append(items, toPromptLogItemView(row))
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     items,
			"total":     total,
			"page":      pageInfo.GetPage(),
			"page_size": pageInfo.GetPageSize(),
		},
	})
}

func GetChannelPromptLogDetail(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid prompt log id"))
		return
	}
	entry, err := model.GetChannelPromptLogById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Prompt log not found"))
			return
		}
		common.ApiError(c, err)
		return
	}
	detail := ChannelPromptLogDetailView{
		ChannelPromptLogItemView: toPromptLogItemView(entry),
		PromptText:               entry.PromptText,
		MetadataJSON:             entry.MetadataJSON,
	}
	common.ApiSuccess(c, detail)
}

func DownloadChannelPromptAttachment(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid prompt log id"))
		return
	}
	attID := strings.TrimSpace(c.Param("attachment_id"))
	if attID == "" {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid attachment id"))
		return
	}
	entry, err := model.GetChannelPromptLogById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Prompt log not found"))
			return
		}
		common.ApiError(c, err)
		return
	}

	var matched *model.ChannelPromptAttachment
	for _, att := range entry.GetAttachments() {
		if att.ID == attID {
			copyAtt := att
			matched = &copyAtt
			break
		}
	}
	if matched == nil || strings.TrimSpace(matched.RelativePath) == "" {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Attachment not found"))
		return
	}
	absPath, err := service.ResolvePromptAttachmentPath(matched.RelativePath)
	if err != nil {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Attachment file unavailable"))
		return
	}

	safeCT, allowInline := service.SafePromptAttachmentContentType(matched.MimeType)
	forceDownload := c.Query("download") == "1" || c.Query("download") == "true"
	dispositionType := "attachment"
	if allowInline && !forceDownload {
		dispositionType = "inline"
	}
	filename := matched.FileName
	if filename == "" {
		filename = matched.ID
	}
	disposition := mime.FormatMediaType(dispositionType, map[string]string{"filename": filename})
	if disposition == "" {
		disposition = dispositionType
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "private, no-store")
	c.Header("Content-Disposition", disposition)
	c.Header("Content-Type", safeCT)
	c.File(absPath)
}

func DeleteChannelPromptLog(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid prompt log id"))
		return
	}
	entry, err := model.DeleteChannelPromptLogById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Prompt log not found"))
			return
		}
		common.ApiError(c, err)
		return
	}
	service.DeletePromptAttachmentFiles([]*model.ChannelPromptLog{entry})
	recordManageAudit(c, "prompt_log.delete", map[string]any{
		"prompt_log_id": id,
		"channel_id":    entry.ChannelId,
	})
	common.ApiSuccess(c, gin.H{"deleted": 1})
}

func CleanupChannelPromptLogs(c *gin.Context) {
	var req struct {
		BeforeTimestamp int64 `json:"before_timestamp"`
		Days            int   `json:"days"`
		ChannelID       int   `json:"channel_id"`
		All             bool  `json:"all"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	cutoff := req.BeforeTimestamp
	if req.Days > 0 {
		cutoff = common.GetTimestamp() - int64(req.Days)*86400
	}
	if cutoff <= 0 && req.ChannelID <= 0 && !req.All {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Specify days, before_timestamp, channel_id, or all=true"))
		return
	}
	if req.All {
		cutoff = 0
	}
	deleted, err := service.CleanupPromptLogs(cutoff, req.ChannelID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "prompt_log.cleanup", map[string]any{
		"deleted":    deleted,
		"channel_id": req.ChannelID,
		"days":       req.Days,
	})
	common.ApiSuccess(c, gin.H{"deleted": deleted})
}

func GetPromptLogSettings(c *gin.Context) {
	channels, err := model.GetPromptLogChannelSummaries()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userID := c.GetInt("id")
	role := c.GetInt("role")
	common.ApiSuccess(c, gin.H{
		"global":              operation_setting.GetPromptLogSetting(),
		"channels":            channels,
		"can_manage_global":   role >= common.RoleRootUser,
		"can_manage_channels": role >= common.RoleRootUser || authz.Can(userID, role, authz.ChannelSensitiveWrite),
	})
}

func UpdatePromptLogSettings(c *gin.Context) {
	if c.GetInt("role") < common.RoleRootUser {
		common.ApiErrorStatus(c, http.StatusForbidden, common.NewMessage("Super administrator privileges required to change global prompt log settings"))
		return
	}
	var req struct {
		Enabled       *bool `json:"enabled"`
		RetentionDays *int  `json:"retention_days"`
		MaxTextBytes  *int  `json:"max_text_bytes"`
		MaxFileSizeMB *int  `json:"max_file_size_mb"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	updates := make(map[string]string)
	if req.Enabled != nil {
		updates["prompt_log_setting.enabled"] = strconv.FormatBool(*req.Enabled)
	}
	if req.RetentionDays != nil {
		if *req.RetentionDays < 0 || *req.RetentionDays > 3650 {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("retention_days must be between 0 and 3650"))
			return
		}
		updates["prompt_log_setting.retention_days"] = strconv.Itoa(*req.RetentionDays)
	}
	if req.MaxTextBytes != nil {
		if *req.MaxTextBytes < 1024 || *req.MaxTextBytes > 1048576 {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("max_text_bytes must be between 1024 and 1048576"))
			return
		}
		updates["prompt_log_setting.max_text_bytes"] = strconv.Itoa(*req.MaxTextBytes)
	}
	if req.MaxFileSizeMB != nil {
		if *req.MaxFileSizeMB < 1 || *req.MaxFileSizeMB > 200 {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("max_file_size_mb must be between 1 and 200"))
			return
		}
		updates["prompt_log_setting.max_file_size_mb"] = strconv.Itoa(*req.MaxFileSizeMB)
	}
	if len(updates) == 0 {
		common.ApiSuccess(c, operation_setting.GetPromptLogSetting())
		return
	}
	if err := model.UpdateOptionsBulk(updates); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "prompt_log.setting_update", map[string]any{
		"keys": len(updates),
	})
	common.ApiSuccess(c, operation_setting.GetPromptLogSetting())
}

func UpdatePromptLogChannelToggle(c *gin.Context) {
	if c.GetInt("role") < common.RoleRootUser && !authz.Can(c.GetInt("id"), c.GetInt("role"), authz.ChannelSensitiveWrite) {
		common.ApiErrorStatus(c, http.StatusForbidden, common.NewMessage("Channel settings permission required"))
		return
	}
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid channel id"))
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	if err := model.UpdateChannelPromptLogEnabled(channelID, req.Enabled); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Channel not found"))
			return
		}
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "prompt_log.channel_toggle", map[string]any{
		"channel_id": channelID,
		"enabled":    req.Enabled,
	})
	common.ApiSuccess(c, gin.H{
		"channel_id":         channelID,
		"prompt_log_enabled": req.Enabled,
	})
}
