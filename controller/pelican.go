package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const pelicanListLimit = 200

type pelicanRecordView struct {
	model.PelicanRecord
	Username string `json:"username"`
	Mine     bool   `json:"mine"`
}

type pelicanRecordRequest struct {
	Model        string `json:"model"`
	Vendor       string `json:"vendor"`
	Prompt       string `json:"prompt"`
	Group        string `json:"group"`
	Svg          string `json:"svg"`
	Reasoning    string `json:"reasoning"`
	ReasoningMs  *int64 `json:"reasoning_ms"`
	FirstTokenMs *int64 `json:"first_token_ms"`
	TotalMs      int64  `json:"total_ms"`
	OutputTokens *int   `json:"output_tokens"`
}

// maskPelicanUsername hides most of a username before it is shown to other
// users, e.g. 584702675@qq.com -> 584****@qq.com.
func maskPelicanUsername(name string) string {
	local, domain := name, ""
	if at := strings.LastIndex(name, "@"); at > 0 {
		local, domain = name[:at], name[at:]
	}
	runes := []rune(local)
	keep := 3
	if len(runes) <= 4 {
		keep = 1
	}
	if len(runes) <= keep {
		return local + "****" + domain
	}
	return string(runes[:keep]) + "****" + domain
}

// GetPelicanRecords lists the shared pelican tests, newest first.
func GetPelicanRecords(c *gin.Context) {
	records, err := model.ListPelicanRecords(strings.TrimSpace(c.Query("model")), pelicanListLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userIds := make([]int, 0, len(records))
	for _, record := range records {
		userIds = append(userIds, record.UserId)
	}
	names, err := model.GetUsernamesByIds(userIds)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	viewerId := c.GetInt("id")
	views := make([]pelicanRecordView, 0, len(records))
	for _, record := range records {
		views = append(views, pelicanRecordView{
			PelicanRecord: record,
			Username:      maskPelicanUsername(names[record.UserId]),
			Mine:          viewerId != 0 && record.UserId == viewerId,
		})
	}
	common.ApiSuccess(c, views)
}

// CreatePelicanRecord stores the caller's finished test so everyone can see it.
func CreatePelicanRecord(c *gin.Context) {
	var req pelicanRecordRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	req.Model = strings.TrimSpace(req.Model)
	svg := strings.TrimSpace(req.Svg)
	// The frontend renders SVG through <img>, so scripts never run; the
	// shape check only rejects payloads that are not an SVG document.
	validSvg := strings.HasPrefix(strings.ToLower(svg), "<svg") && strings.HasSuffix(strings.ToLower(svg), "</svg>")
	if req.Model == "" || len(req.Model) > 255 || !validSvg || len(svg) > model.PelicanRecordSvgMaxBytes ||
		len(req.Prompt) > 4000 || len(req.Vendor) > 255 || len(req.Group) > 64 || req.TotalMs < 0 ||
		len(req.Reasoning) > model.PelicanRecordReasoningMaxBytes || (req.ReasoningMs != nil && *req.ReasoningMs < 0) {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	record := model.PelicanRecord{
		UserId:       c.GetInt("id"),
		ModelName:    req.Model,
		Vendor:       req.Vendor,
		Prompt:       req.Prompt,
		Group:        req.Group,
		Svg:          svg,
		Reasoning:    req.Reasoning,
		ReasoningMs:  req.ReasoningMs,
		FirstTokenMs: req.FirstTokenMs,
		TotalMs:      req.TotalMs,
		OutputTokens: req.OutputTokens,
		CreatedAt:    time.Now().UnixMilli(),
	}
	if err := model.CreatePelicanRecord(&record); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, pelicanRecordView{
		PelicanRecord: record,
		Username:      maskPelicanUsername(c.GetString("username")),
		Mine:          true,
	})
}

// DeletePelicanRecord lets the author or an admin remove a shared test.
func DeletePelicanRecord(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorT(c, "Invalid ID")
		return
	}
	record, err := model.GetPelicanRecordById(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorT(c, "Invalid ID")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if record.UserId != c.GetInt("id") && c.GetInt("role") < common.RoleAdminUser {
		common.ApiErrorStatus(c, http.StatusForbidden, common.NewMessage("No permission to perform this action"))
		return
	}
	if err := model.DeletePelicanRecord(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
