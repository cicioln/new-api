package muse

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// Video generation runs in a background goroutine on the node that accepted
// the request. Jobs and their files live on that node only: the task poller
// reads job state from this process, and an unfinished job missing after a
// restart (or on another node) is reported as not found, which fails and
// refunds the task. Finished videos are stored under their task ID, so they
// stay playable across restarts until the retention period ends.

const videoGenerateTimeout = 20 * time.Minute

// maxVideoSeconds is the longest clip Muse generates in one request.
const maxVideoSeconds = 10

type videoJob struct {
	Status   string `json:"status"`
	Progress int    `json:"progress"`
	Reason   string `json:"reason,omitempty"`
	file     string
	mime     string
	finished time.Time
}

var (
	videoJobsMu sync.Mutex
	videoJobs   = map[string]*videoJob{}
)

func videoRetention() time.Duration {
	return time.Duration(common.GetEnvOrDefault("MUSE_VIDEO_RETENTION_HOURS", 24)) * time.Hour
}

func cleanupVideoJobs(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		cutoff := time.Now().Add(-videoRetention())
		videoJobsMu.Lock()
		for id, job := range videoJobs {
			if job.finished.IsZero() || job.finished.After(cutoff) {
				continue
			}
			if job.file != "" {
				_ = os.Remove(job.file)
			}
			delete(videoJobs, id)
		}
		videoJobsMu.Unlock()
		removeExpiredVideoFiles(cutoff)
	}
}

type videoRequest struct {
	acc    *musesdk.Account
	prompt string
	refs   []musesdk.RefImage
}

// TaskAdaptor serves Muse video generation through the async task relay.
type TaskAdaptor struct {
	taskcommon.BaseBilling
	request *videoRequest
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextToVideo); taskErr != nil {
		return taskErr
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if videoSeconds(req) > maxVideoSeconds {
		return service.TaskErrorWrapperLocal(fmt.Errorf("muse videos are at most %d seconds", maxVideoSeconds), "invalid_seconds", http.StatusBadRequest)
	}
	if req.InputReference != "" || len(req.Images) > 0 || hasMultipartReference(c) {
		info.Action = constant.TaskActionImageToVideo
	}
	return nil
}

func videoSeconds(req relaycommon.TaskSubmitReq) int {
	if req.Duration > 0 {
		return req.Duration
	}
	seconds, _ := strconv.Atoi(req.Seconds)
	return seconds
}

func hasMultipartReference(c *gin.Context) bool {
	form := c.Request.MultipartForm
	return form != nil && len(form.File["input_reference"]) > 0
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return "", nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	return nil
}

// BuildRequestBody loads reference images while the client request is still
// available; the background job cannot read it later.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	sources := append([]string(nil), req.Images...)
	if req.InputReference != "" {
		sources = append(sources, req.InputReference)
	}
	if len(sources) == 0 && strings.TrimSpace(req.Image) != "" {
		sources = append(sources, strings.TrimSpace(req.Image))
	}
	var refs []musesdk.RefImage
	for _, source := range sources {
		data, mime, err := service.GetBase64Data(c, types.NewFileSourceFromData(source, ""), "muse_video_reference")
		if err != nil {
			return nil, fmt.Errorf("load reference image failed: %w", err)
		}
		raw, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			return nil, fmt.Errorf("decode reference image failed: %w", err)
		}
		refs = append(refs, musesdk.RefImage{Data: raw, Mime: mime})
	}
	if form := c.Request.MultipartForm; form != nil {
		for _, header := range form.File["input_reference"] {
			file, err := header.Open()
			if err != nil {
				return nil, err
			}
			raw, err := io.ReadAll(io.LimitReader(file, musesdk.MaxRefImageBytes+1))
			file.Close()
			if err != nil {
				return nil, err
			}
			refs = append(refs, musesdk.RefImage{Data: raw, Mime: http.DetectContentType(raw)})
		}
	}
	if len(refs) > musesdk.MaxRefImages {
		return nil, fmt.Errorf("at most %d reference images are supported", musesdk.MaxRefImages)
	}
	prompt := videoPrompt(req, len(refs) > 0)
	acc, err := accountFor(info.ChannelId, info.ChannelMultiKeyIndex, info.ChannelIsMultiKey, info.ApiKey, info.ChannelSetting.Proxy)
	if err != nil {
		return nil, err
	}
	a.request = &videoRequest{acc: acc, prompt: prompt, refs: refs}
	return strings.NewReader(""), nil
}

// DoRequest starts the background job. Jobs are keyed by the public task ID,
// so a retried submission reuses the running job instead of starting another.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	if a.request == nil {
		return nil, errors.New("muse video request was not built")
	}
	if info.PublicTaskID == "" {
		return nil, errors.New("muse video task id is missing")
	}
	jobID := info.PublicTaskID
	videoJobsMu.Lock()
	if _, exists := videoJobs[jobID]; !exists {
		videoJobs[jobID] = &videoJob{Status: model.TaskStatusQueued}
		go runVideoJob(jobID, *a.request)
	}
	videoJobsMu.Unlock()
	return jsonResponse(http.StatusOK, []byte(`{}`)), nil
}

// videoPrompt wraps the user's description in an explicit instruction. Muse is
// a general agent: given a bare description such as "a cat running on the
// beach" it often answers in text instead of calling its video tool.
func videoPrompt(req relaycommon.TaskSubmitReq, hasRefs bool) string {
	var b strings.Builder
	if hasRefs {
		b.WriteString("Use your video generation tool to animate the attached image(s) into a video. Do not answer with text only; produce the video file.")
	} else {
		b.WriteString("Use your video generation tool to create a video. Do not answer with text only; produce the video file.")
	}
	if req.Size != "" {
		b.WriteString("\nVideo size: " + req.Size + ".")
	}
	if seconds := videoSeconds(req); seconds > 0 {
		b.WriteString(fmt.Sprintf("\nVideo length: %d seconds.", seconds))
	}
	b.WriteString("\n\nVideo description:\n")
	b.WriteString(req.Prompt)
	return b.String()
}

func runVideoJob(jobID string, req videoRequest) {
	defer func() {
		if recovered := recover(); recovered != nil {
			finishVideoJob(jobID, nil, fmt.Errorf("muse video job panic: %v", recovered))
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), videoGenerateTimeout+time.Minute)
	defer cancel()
	files, err := sharedEngine().Generate(ctx, req.acc, musesdk.GenRequest{
		Prompt:  req.prompt,
		Kind:    "video",
		Refs:    req.refs,
		N:       1,
		Timeout: videoGenerateTimeout,
		OnProgress: func(pct int) {
			videoJobsMu.Lock()
			if job := videoJobs[jobID]; job != nil {
				job.Status = model.TaskStatusInProgress
				job.Progress = min(pct, 99)
			}
			videoJobsMu.Unlock()
		},
	})
	finishVideoJob(jobID, files, err)
}

func finishVideoJob(jobID string, files []musesdk.Media, err error) {
	videoJobsMu.Lock()
	defer videoJobsMu.Unlock()
	job := videoJobs[jobID]
	if job == nil {
		removeMedia(files)
		return
	}
	job.finished = time.Now()
	if err == nil && len(files) == 0 {
		err = errors.New("muse returned no video")
	}
	if err != nil {
		removeMedia(files)
		job.Status = model.TaskStatusFailure
		job.Reason = err.Error()
		return
	}
	removeMedia(files[1:])
	job.Status = model.TaskStatusSuccess
	job.Progress = 100
	job.file = mediaPath(files[0])
	job.mime = files[0].Mime
	// Name the file after the task so ServeVideo still finds it after a
	// restart has emptied videoJobs.
	if named := videoFilePath(jobID, filepath.Ext(job.file)); os.Rename(job.file, named) == nil {
		job.file = named
	}
}

const videoFilePrefix = "video-"

func videoFilePath(jobID, ext string) string {
	return filepath.Join(engineConfig.MediaDir(), videoFilePrefix+filepath.Base(jobID)+ext)
}

// findVideoFile locates a finished video by task ID when its job is gone.
func findVideoFile(jobID string) (string, string) {
	for _, ext := range []string{".mp4", ".webm", ".mov"} {
		path := videoFilePath(jobID, ext)
		if _, err := os.Stat(path); err == nil {
			return path, map[string]string{".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime"}[ext]
		}
	}
	return "", ""
}

// removeExpiredVideoFiles deletes task-named videos older than the cutoff,
// including ones whose job was lost in a restart.
func removeExpiredVideoFiles(cutoff time.Time) {
	entries, err := os.ReadDir(engineConfig.MediaDir())
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), videoFilePrefix) {
			continue
		}
		if info, err := entry.Info(); err == nil && info.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(engineConfig.MediaDir(), entry.Name()))
		}
	}
}

func (a *TaskAdaptor) ParseResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*channel.TaskSubmitResponse, *taskdto.TaskError) {
	return &channel.TaskSubmitResponse{UpstreamTaskID: info.PublicTaskID}, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, task *model.Task, proxy string) (*http.Response, error) {
	videoJobsMu.Lock()
	job := videoJobs[task.GetUpstreamTaskID()]
	var snapshot videoJob
	if job != nil {
		snapshot = *job
	}
	videoJobsMu.Unlock()
	if job == nil {
		return jsonResponse(http.StatusNotFound, []byte(`{"status":"NOT_FOUND"}`)), nil
	}
	body, err := common.Marshal(snapshot)
	if err != nil {
		return nil, err
	}
	return jsonResponse(http.StatusOK, body), nil
}

func (a *TaskAdaptor) ParseTaskResult(task *model.Task, resp *http.Response, respBody []byte) (*relaycommon.TaskInfo, error) {
	var job videoJob
	if err := common.Unmarshal(respBody, &job); err != nil {
		return nil, err
	}
	result := &relaycommon.TaskInfo{TaskID: task.GetUpstreamTaskID(), Status: job.Status, Reason: job.Reason}
	if job.Status == model.TaskStatusInProgress && job.Progress > 0 {
		result.Progress = fmt.Sprintf("%d%%", min(job.Progress, 99))
	}
	return result, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := task.ToOpenAIVideo()
	if task.Status == model.TaskStatusFailure {
		video.Error = &dto.OpenAIVideoError{Message: task.FailReason, Code: "generation_failed"}
	}
	return common.Marshal(video)
}

// ServeVideo writes a finished Muse video. The caller has already checked that
// the requester may read the task.
func ServeVideo(c *gin.Context, task *model.Task) {
	sharedEngine() // initializes engineConfig, which locates the media dir
	videoJobsMu.Lock()
	job := videoJobs[task.GetUpstreamTaskID()]
	var path, mime string
	if job != nil {
		path, mime = job.file, job.mime
	}
	videoJobsMu.Unlock()
	if path == "" {
		path, mime = findVideoFile(task.GetUpstreamTaskID())
	}
	file, err := os.Open(path)
	if path == "" || err != nil {
		c.Header("Cache-Control", "private, no-store")
		c.JSON(http.StatusGone, gin.H{"error": gin.H{"message": "Artifact content is no longer available", "type": "invalid_request_error", "code": "artifact_gone"}})
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	if mime == "" {
		mime = "video/mp4"
	}
	header := c.Writer.Header()
	header.Set("Content-Type", mime)
	header.Set("Cache-Control", "private, no-store")
	header.Set("Content-Security-Policy", "sandbox; default-src 'none'")
	header.Set("Referrer-Policy", "no-referrer")
	header.Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(c.Writer, c.Request, task.TaskID+".mp4", info.ModTime(), file)
}

func jsonResponse(status int, body []byte) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(string(body))),
	}
}
