package controller

import (
	"bytes"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
)

// Studio video requests are saved next to the studio images so a failed
// task can be retried with the same prompt, settings and reference images.

const (
	maxStudioVideoRequestBytes = 64 << 20
	studioVideoRequestTTL      = 30 * 24 * time.Hour
)

var studioTaskIDPattern = regexp.MustCompile(`^task_[0-9A-Za-z]{1,64}$`)

type studioVideoRequest struct {
	Group string            `json:"group"`
	Body  common.RawMessage `json:"body"`
}

// studioVideoMeta is the part of a saved request shown in the task list.
// A task with it can be retried.
type studioVideoMeta struct {
	Prompt    string `json:"prompt"`
	Size      string `json:"size,omitempty"`
	Seconds   string `json:"seconds,omitempty"`
	HasImages bool   `json:"has_images,omitempty"`
}

type studioVideoView struct {
	*dto.TaskDto
	Studio *studioVideoMeta `json:"studio,omitempty"`
}

func studioVideoRequestDir(userID int) string {
	return filepath.Join(studioDataDir(), "video-requests", strconv.Itoa(userID))
}

func studioVideoRequestPath(userID int, taskID string) (string, bool) {
	if !studioTaskIDPattern.MatchString(taskID) {
		return "", false
	}
	return filepath.Join(studioVideoRequestDir(userID), taskID+".json"), true
}

// captureWriter keeps a copy of a small JSON response.
type captureWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *captureWriter) Write(data []byte) (int, error) {
	if w.body.Len() < 64<<10 {
		w.body.Write(data)
	}
	return w.ResponseWriter.Write(data)
}

func (w *captureWriter) WriteString(s string) (int, error) {
	return w.Write([]byte(s))
}

func relayStudioVideo(c *gin.Context) {
	var body []byte
	if strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") {
		if storage, err := common.GetBodyStorage(c); err == nil {
			if data, err := storage.Bytes(); err == nil && len(data) <= maxStudioVideoRequestBytes {
				body = append([]byte(nil), data...)
			}
		}
	}
	writer := &captureWriter{ResponseWriter: c.Writer}
	c.Writer = writer
	RelayTask(c)
	c.Writer = writer.ResponseWriter

	if body == nil || writer.Status() != http.StatusOK {
		return
	}
	var submitted struct {
		ID     string `json:"id"`
		TaskID string `json:"task_id"`
	}
	if common.Unmarshal(writer.body.Bytes(), &submitted) != nil {
		return
	}
	taskID := submitted.TaskID
	if taskID == "" {
		taskID = submitted.ID
	}
	if err := saveStudioVideoRequest(c.GetInt("id"), taskID, c.Query("group"), body); err != nil {
		common.SysError(common.LogText("failed to save studio video request: %s", err.Error()))
	}
}

func saveStudioVideoRequest(userID int, taskID, group string, body []byte) error {
	path, ok := studioVideoRequestPath(userID, taskID)
	if !ok {
		return errors.New("invalid task id")
	}
	data, err := common.Marshal(studioVideoRequest{Group: group, Body: body})
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	pruneStudioVideoRequests(dir)
	return os.WriteFile(path, data, 0o644)
}

func pruneStudioVideoRequests(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	cutoff := time.Now().Add(-studioVideoRequestTTL)
	for _, entry := range entries {
		if info, err := entry.Info(); err == nil && !entry.IsDir() && info.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(dir, entry.Name()))
		}
	}
}

func loadStudioVideoRequest(userID int, taskID string) (*studioVideoRequest, error) {
	path, ok := studioVideoRequestPath(userID, taskID)
	if !ok {
		return nil, os.ErrNotExist
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var request studioVideoRequest
	if err := common.Unmarshal(data, &request); err != nil {
		return nil, err
	}
	return &request, nil
}

func removeStudioVideoRequest(userID int, taskID string) {
	if path, ok := studioVideoRequestPath(userID, taskID); ok {
		_ = os.Remove(path)
	}
}

func studioVideoMetaOf(userID int, taskID string) *studioVideoMeta {
	request, err := loadStudioVideoRequest(userID, taskID)
	if err != nil {
		return nil
	}
	var fields struct {
		Prompt         string            `json:"prompt"`
		Size           string            `json:"size"`
		Seconds        common.RawMessage `json:"seconds"`
		Images         []string          `json:"images"`
		InputReference string            `json:"input_reference"`
	}
	if common.Unmarshal(request.Body, &fields) != nil {
		return nil
	}
	return &studioVideoMeta{
		Prompt:    fields.Prompt,
		Size:      fields.Size,
		Seconds:   strings.Trim(string(fields.Seconds), `"`),
		HasImages: len(fields.Images) > 0 || fields.InputReference != "",
	}
}

func studioVideoViews(userID int, tasks []*dto.TaskDto) []studioVideoView {
	views := make([]studioVideoView, len(tasks))
	for i, task := range tasks {
		views[i] = studioVideoView{TaskDto: task, Studio: studioVideoMetaOf(userID, task.TaskID)}
	}
	return views
}

// GetStudioVideoRequest returns the saved request of a studio video task so
// the studio can submit it again.
func GetStudioVideoRequest(c *gin.Context) {
	request, err := loadStudioVideoRequest(c.GetInt("id"), c.Param("task_id"))
	if err != nil {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("The original request of this video is no longer available"))
		return
	}
	common.ApiSuccess(c, request)
}
