package controller

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/muse"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// Creative Studio storage. Studio image requests run in the background,
// detached from the browser request, and their results are saved on this
// server, so a user can close the page and find the images later from any
// device. Files live under STUDIO_DATA_DIR (default "studio-data", which is
// /data/studio-data in the Docker image).

const (
	studioImageRunning = "running"
	studioImageSuccess = "success"
	studioImageFailed  = "failed"

	maxRunningStudioImages = 4
	maxListedStudioImages  = 100
	maxListedStudioVideos  = 30
	studioImageTimeout     = 30 * time.Minute
)

var (
	studioImageJobPattern  = regexp.MustCompile(`^img([1-9][0-9]{0,9})_[0-9A-Za-z]{24}$`)
	studioImageFilePattern = regexp.MustCompile(`^(img[1-9][0-9]{0,9}_[0-9A-Za-z]{24})-[0-9]{1,3}\.(png|jpg|webp|gif)$`)

	studioMu sync.Mutex
	// studioActiveImages maps the jobs running in this process to their user.
	studioActiveImages = map[string]int{}
)

type studioImageJob struct {
	ID         string   `json:"id"`
	UserID     int      `json:"user_id"`
	Status     string   `json:"status"`
	Prompt     string   `json:"prompt"`
	Model      string   `json:"model"`
	Group      string   `json:"group,omitempty"`
	Size       string   `json:"size,omitempty"`
	Count      int      `json:"count,omitempty"`
	CreatedAt  int64    `json:"created_at"`
	FinishedAt int64    `json:"finished_at,omitempty"`
	Error      string   `json:"error,omitempty"`
	Files      []string `json:"files,omitempty"`
	URLs       []string `json:"urls,omitempty"`
}

type studioImageView struct {
	ID         string   `json:"id"`
	Status     string   `json:"status"`
	Prompt     string   `json:"prompt"`
	Model      string   `json:"model"`
	Group      string   `json:"group,omitempty"`
	Size       string   `json:"size,omitempty"`
	Count      int      `json:"count,omitempty"`
	CreatedAt  int64    `json:"created_at"`
	FinishedAt int64    `json:"finished_at,omitempty"`
	Error      string   `json:"error,omitempty"`
	Images     []string `json:"images"`
}

func studioDataDir() string {
	return common.GetEnvOrDefaultString("STUDIO_DATA_DIR", "studio-data")
}

func studioImageDir(userID int) string {
	return filepath.Join(studioDataDir(), "images", strconv.Itoa(userID))
}

// studioImageJobUser returns the owner encoded in a job ID.
func studioImageJobUser(id string) (int, bool) {
	match := studioImageJobPattern.FindStringSubmatch(id)
	if match == nil {
		return 0, false
	}
	userID, err := strconv.Atoi(match[1])
	return userID, err == nil && userID > 0
}

func saveStudioImageJob(job *studioImageJob) error {
	dir := studioImageDir(job.UserID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := common.Marshal(job)
	if err != nil {
		return err
	}
	path := filepath.Join(dir, job.ID+".json")
	if err := os.WriteFile(path+".tmp", data, 0o644); err != nil {
		return err
	}
	return os.Rename(path+".tmp", path)
}

func loadStudioImageJob(userID int, id string) (*studioImageJob, error) {
	data, err := os.ReadFile(filepath.Join(studioImageDir(userID), id+".json"))
	if err != nil {
		return nil, err
	}
	var job studioImageJob
	if err := common.Unmarshal(data, &job); err != nil {
		return nil, err
	}
	return &job, nil
}

// startStudioImageJob answers with a job ID right away and runs the image
// relay in the background. Billing is the normal image relay billing.
func startStudioImageJob(c *gin.Context) {
	userID := c.GetInt("id")
	var request struct {
		Model  string `json:"model"`
		Prompt string `json:"prompt"`
		Size   string `json:"size"`
		// Multipart forms carry n as a string, JSON bodies as a number.
		N any `json:"n"`
	}
	if err := common.UnmarshalBodyReusable(c, &request); err != nil {
		writeStudioSubmitError(c, http.StatusBadRequest, "Invalid parameters")
		return
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		writeStudioSubmitError(c, http.StatusBadRequest, "Invalid parameters")
		return
	}
	body, err := storage.Bytes()
	if err != nil {
		writeStudioSubmitError(c, http.StatusBadRequest, "Invalid parameters")
		return
	}

	key, err := common.GenerateRandomCharsKey(24)
	if err != nil {
		writeStudioSubmitError(c, http.StatusInternalServerError, "Image generation failed")
		return
	}
	job := &studioImageJob{
		ID:        fmt.Sprintf("img%d_%s", userID, key),
		UserID:    userID,
		Status:    studioImageRunning,
		Prompt:    request.Prompt,
		Model:     request.Model,
		Group:     c.Query("group"),
		Size:      request.Size,
		Count:     studioImageCount(request.N),
		CreatedAt: common.GetTimestamp(),
	}

	studioMu.Lock()
	running := 0
	for _, owner := range studioActiveImages {
		if owner == userID {
			running++
		}
	}
	if running >= maxRunningStudioImages {
		studioMu.Unlock()
		writeStudioSubmitError(c, http.StatusTooManyRequests, "Too many images are generating. Wait for one to finish.")
		return
	}
	studioActiveImages[job.ID] = userID
	studioMu.Unlock()

	if err := saveStudioImageJob(job); err != nil {
		studioMu.Lock()
		delete(studioActiveImages, job.ID)
		studioMu.Unlock()
		common.SysError(common.LogText("failed to save studio image job: %s", err.Error()))
		writeStudioSubmitError(c, http.StatusInternalServerError, "Image generation failed")
		return
	}

	// The gin context returns to its pool when this handler ends, so the
	// relay runs on a copy with its own request body and a buffered writer.
	background := c.Copy()
	ctx, cancel := context.WithTimeout(context.WithoutCancel(c.Request.Context()), studioImageTimeout)
	background.Request = c.Request.Clone(ctx)
	background.Request.Body = io.NopCloser(bytes.NewReader(body))
	background.Request.MultipartForm = nil
	delete(background.Keys, string(constant.ContextKeyFileSourcesToCleanup))
	if copied, err := common.CreateBodyStorage(body); err == nil {
		background.Set(common.KeyBodyStorage, copied)
	} else {
		delete(background.Keys, common.KeyBodyStorage)
	}
	recorder := httptest.NewRecorder()
	writerContext, _ := gin.CreateTestContext(recorder)
	background.Writer = writerContext.Writer

	go func() {
		defer func() {
			if recovered := recover(); recovered != nil {
				common.SysError(common.LogText("studio image job %s panicked: %v", job.ID, recovered))
				job.Status, job.Error = studioImageFailed, "Image generation failed"
				job.FinishedAt = common.GetTimestamp()
				_ = saveStudioImageJob(job)
			}
			cancel()
			common.CleanupBodyStorage(background)
			service.CleanupFileSources(background)
			studioMu.Lock()
			delete(studioActiveImages, job.ID)
			studioMu.Unlock()
		}()
		Relay(background, types.RelayFormatOpenAIImage)
		storeStudioImageResult(job, recorder.Code, recorder.Body.Bytes())
		job.FinishedAt = common.GetTimestamp()
		if err := saveStudioImageJob(job); err != nil {
			common.SysError(common.LogText("failed to save studio image job: %s", err.Error()))
		}
	}()

	c.JSON(http.StatusOK, gin.H{"id": job.ID})
}

func studioImageCount(raw any) int {
	switch value := raw.(type) {
	case float64:
		return int(value)
	case string:
		count, _ := strconv.Atoi(value)
		return count
	}
	return 0
}

func writeStudioSubmitError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": gin.H{"message": message, "type": "invalid_request_error"}})
}

// storeStudioImageResult saves the images of an OpenAI image response.
func storeStudioImageResult(job *studioImageJob, status int, body []byte) {
	job.Status = studioImageFailed
	if status != http.StatusOK {
		var failure struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = common.Unmarshal(body, &failure)
		message := failure.Error.Message
		// Relay appends " (request id: ...)" for support; users don't need it.
		if index := strings.LastIndex(message, " (request id: "); index >= 0 {
			message = message[:index]
		}
		job.Error = strings.TrimSpace(message)
		if job.Error == "" {
			job.Error = "Image generation failed"
		}
		return
	}
	var response kitdto.ImageResponse
	if err := common.Unmarshal(body, &response); err != nil {
		job.Error = "Image generation failed"
		return
	}
	dir := studioImageDir(job.UserID)
	for index, item := range response.Data {
		if item.B64Json != "" {
			raw, err := base64.StdEncoding.DecodeString(item.B64Json)
			if err != nil {
				continue
			}
			ext := ".png"
			switch http.DetectContentType(raw) {
			case "image/jpeg":
				ext = ".jpg"
			case "image/webp":
				ext = ".webp"
			case "image/gif":
				ext = ".gif"
			}
			name := fmt.Sprintf("%s-%d%s", job.ID, index, ext)
			if err := os.WriteFile(filepath.Join(dir, name), raw, 0o644); err != nil {
				common.SysError(common.LogText("failed to save studio image: %s", err.Error()))
				continue
			}
			job.Files = append(job.Files, name)
		} else if item.Url != "" {
			job.URLs = append(job.URLs, item.Url)
		}
	}
	if len(job.Files) == 0 && len(job.URLs) == 0 {
		job.Error = "The model returned no images"
		return
	}
	job.Status = studioImageSuccess
}

// GetStudioImages lists the signed-in user's studio images, newest first.
func GetStudioImages(c *gin.Context) {
	userID := c.GetInt("id")
	views := make([]studioImageView, 0)
	entries, err := os.ReadDir(studioImageDir(userID))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		common.ApiError(c, err)
		return
	}
	jobs := make([]*studioImageJob, 0, len(entries))
	for _, entry := range entries {
		id, ok := strings.CutSuffix(entry.Name(), ".json")
		if !ok || entry.IsDir() || !studioImageJobPattern.MatchString(id) {
			continue
		}
		job, err := loadStudioImageJob(userID, id)
		if err != nil || job.UserID != userID {
			continue
		}
		jobs = append(jobs, job)
	}
	sort.Slice(jobs, func(i, j int) bool { return jobs[i].CreatedAt > jobs[j].CreatedAt })
	if len(jobs) > maxListedStudioImages {
		jobs = jobs[:maxListedStudioImages]
	}

	studioMu.Lock()
	active := make(map[string]bool, len(studioActiveImages))
	for id := range studioActiveImages {
		active[id] = true
	}
	studioMu.Unlock()

	for _, job := range jobs {
		if job.Status == studioImageRunning && !active[job.ID] {
			// The server restarted while this job was running.
			job.Status, job.Error = studioImageFailed, "Generation was interrupted by a server restart"
			job.FinishedAt = common.GetTimestamp()
			_ = saveStudioImageJob(job)
		}
		view := studioImageView{
			ID:         job.ID,
			Status:     job.Status,
			Prompt:     job.Prompt,
			Model:      job.Model,
			Group:      job.Group,
			Size:       job.Size,
			Count:      job.Count,
			CreatedAt:  job.CreatedAt,
			FinishedAt: job.FinishedAt,
			Error:      job.Error,
			Images:     make([]string, 0, len(job.Files)+len(job.URLs)),
		}
		for _, name := range job.Files {
			access, err := service.IssueTaskArtifactAccess(job.ID, name)
			if err != nil {
				continue
			}
			view.Images = append(view.Images, "/pg/studio/media/"+access+"/"+name)
		}
		view.Images = append(view.Images, job.URLs...)
		views = append(views, view)
	}
	common.ApiSuccess(c, views)
}

// StudioImageContent serves a stored studio image. The URL carries a
// signature bound to the file, because an <img> tag cannot send the
// dashboard Authorization header.
func StudioImageContent(c *gin.Context) {
	name := c.Param("name")
	match := studioImageFilePattern.FindStringSubmatch(name)
	if match == nil || !service.VerifyTaskArtifactAccess(c.Param("access"), match[1], name) {
		c.Status(http.StatusNotFound)
		return
	}
	userID, ok := studioImageJobUser(match[1])
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}
	path := filepath.Join(studioImageDir(userID), name)
	if _, err := os.Stat(path); err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", "private, max-age=31536000, immutable")
	c.Header("Content-Security-Policy", "sandbox; default-src 'none'")
	c.Header("X-Content-Type-Options", "nosniff")
	c.File(path)
}

// DeleteStudioImage removes a finished studio image job and its files.
func DeleteStudioImage(c *gin.Context) {
	userID := c.GetInt("id")
	id := c.Param("id")
	owner, ok := studioImageJobUser(id)
	if !ok || owner != userID {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Image not found"))
		return
	}
	studioMu.Lock()
	_, running := studioActiveImages[id]
	studioMu.Unlock()
	if running {
		common.ApiErrorStatus(c, http.StatusConflict, common.NewMessage("This image is still generating"))
		return
	}
	job, err := loadStudioImageJob(userID, id)
	if err != nil {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Image not found"))
		return
	}
	if err := removeStudioImageJob(job); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func removeStudioImageJob(job *studioImageJob) error {
	dir := studioImageDir(job.UserID)
	for _, name := range job.Files {
		if studioImageFilePattern.MatchString(name) {
			_ = os.Remove(filepath.Join(dir, name))
		}
	}
	return os.Remove(filepath.Join(dir, job.ID+".json"))
}

// GetStudioSettings tells the studio how long the server keeps its media.
func GetStudioSettings(c *gin.Context) {
	setting := operation_setting.GetVideoSetting()
	common.ApiSuccess(c, gin.H{
		"video_retention_days": setting.RetentionDays,
		"image_retention_days": setting.ImageRetentionDays,
	})
}

// StartStudioImageCleanup deletes studio images older than the image
// retention period. Each node cleans its own STUDIO_DATA_DIR.
func StartStudioImageCleanup() {
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if days := operation_setting.GetVideoSetting().ImageRetentionDays; days > 0 {
				removeExpiredStudioImages(time.Now().AddDate(0, 0, -days).Unix())
			}
		}
	}()
}

func removeExpiredStudioImages(cutoff int64) {
	users, err := os.ReadDir(filepath.Join(studioDataDir(), "images"))
	if err != nil {
		return
	}
	studioMu.Lock()
	active := make(map[string]bool, len(studioActiveImages))
	for id := range studioActiveImages {
		active[id] = true
	}
	studioMu.Unlock()
	for _, user := range users {
		userID, err := strconv.Atoi(user.Name())
		if !user.IsDir() || err != nil || userID <= 0 {
			continue
		}
		entries, err := os.ReadDir(studioImageDir(userID))
		if err != nil {
			continue
		}
		for _, entry := range entries {
			id, ok := strings.CutSuffix(entry.Name(), ".json")
			if !ok || entry.IsDir() || active[id] || !studioImageJobPattern.MatchString(id) {
				continue
			}
			job, err := loadStudioImageJob(userID, id)
			if err != nil || job.UserID != userID {
				continue
			}
			at := job.FinishedAt
			if at == 0 {
				at = job.CreatedAt
			}
			if at > 0 && at < cutoff {
				if err := removeStudioImageJob(job); err != nil {
					common.SysError(common.LogText("failed to remove expired studio image %s: %s", id, err.Error()))
				}
			}
		}
	}
}

var studioVideoActions = []string{constant.TaskActionTextToVideo, constant.TaskActionImageToVideo}

func studioHiddenVideosPath(userID int) string {
	return filepath.Join(studioDataDir(), "hidden-videos", strconv.Itoa(userID)+".json")
}

// loadStudioHiddenVideos returns the video task IDs the user deleted from
// the studio. The tasks themselves stay in the task log for billing records.
func loadStudioHiddenVideos(userID int) []string {
	data, err := os.ReadFile(studioHiddenVideosPath(userID))
	if err != nil {
		return nil
	}
	var ids []string
	_ = common.Unmarshal(data, &ids)
	return ids
}

// GetStudioVideos lists the signed-in user's video tasks shown in the studio.
func GetStudioVideos(c *gin.Context) {
	userID := c.GetInt("id")
	studioMu.Lock()
	hidden := loadStudioHiddenVideos(userID)
	studioMu.Unlock()
	tasks := model.TaskGetAllUserTask(userID, 0, 100, model.SyncTaskQueryParams{})
	kept := make([]*model.Task, 0, maxListedStudioVideos)
	for _, task := range tasks {
		if !slices.Contains(studioVideoActions, task.Action) || slices.Contains(hidden, task.TaskID) {
			continue
		}
		kept = append(kept, task)
		if len(kept) == maxListedStudioVideos {
			break
		}
	}
	common.ApiSuccess(c, studioVideoViews(userID, tasksToDto(kept, false, common.RoleCommonUser)))
}

// DeleteStudioVideo removes a finished video from the studio and deletes
// the video file stored on this server.
func DeleteStudioVideo(c *gin.Context) {
	userID := c.GetInt("id")
	task, exists, err := model.GetByTaskId(userID, c.Param("task_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !exists || task == nil || !slices.Contains(studioVideoActions, task.Action) {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Video not found"))
		return
	}
	if task.Status != model.TaskStatusSuccess && task.Status != model.TaskStatusFailure {
		common.ApiErrorStatus(c, http.StatusConflict, common.NewMessage("This video is still generating"))
		return
	}
	if task.Platform == muse.TaskPlatform {
		muse.DeleteVideo(task)
	}
	removeStudioVideoRequest(userID, task.TaskID)

	studioMu.Lock()
	defer studioMu.Unlock()
	hidden := loadStudioHiddenVideos(userID)
	if !slices.Contains(hidden, task.TaskID) {
		hidden = append(hidden, task.TaskID)
	}
	data, err := common.Marshal(hidden)
	if err == nil {
		path := studioHiddenVideosPath(userID)
		if err = os.MkdirAll(filepath.Dir(path), 0o755); err == nil {
			err = os.WriteFile(path, data, 0o644)
		}
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
