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
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// Video generation runs in a background goroutine on the node that accepted
// the request. Jobs and their files live on that node only: the task poller
// reads job state from this process, and an unfinished job missing after a
// restart (or on another node) is reported as not found, which fails and
// refunds the task. Finished videos are stored under their task ID, so they
// stay playable across restarts. They are kept until the administrator's
// video retention period (video_setting.retention_days, 0 = forever) ends.

const videoGenerateTimeout = 20 * time.Minute

// maxVideoSeconds is the longest clip Muse generates in one request.
const maxVideoSeconds = musesdk.MaxVideoSegmentSeconds

// videoTierSeconds returns the longest video a model makes: 10 seconds for
// muse-video, N for muse-video-<N>s. Videos longer than 10 seconds are
// generated as consecutive segments, each continuing from the last frame of
// the one before, and joined with ffmpeg.
func videoTierSeconds(modelName string) int {
	rest, ok := strings.CutPrefix(modelName, "muse-video-")
	if !ok {
		return maxVideoSeconds
	}
	digits, ok := strings.CutSuffix(rest, "s")
	if !ok {
		return maxVideoSeconds
	}
	seconds, err := strconv.Atoi(digits)
	if err != nil || seconds <= maxVideoSeconds || seconds > musesdk.MaxLongVideoSeconds {
		return maxVideoSeconds
	}
	return seconds
}

func videoModelName(info *relaycommon.RelayInfo) string {
	if info.UpstreamModelName != "" {
		return info.UpstreamModelName
	}
	return info.OriginModelName
}

// videoJoinMode is where long videos are joined: "" (on the Muse VM, falling
// back to this server's ffmpeg), "vm", or "local".
var videoJoinMode = common.GetEnvOrDefaultString("MUSE_VIDEO_JOIN", musesdk.JoinAuto)

// longVideoTimeout bounds a whole segmented job.
func longVideoTimeout(segments int) time.Duration {
	return time.Duration(segments)*videoGenerateTimeout + 5*time.Minute
}

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

// videoJobMemory is how long a finished job stays in memory. Its file outlives
// it on disk and is found by task ID afterwards.
const videoJobMemory = 24 * time.Hour

func cleanupVideoJobs(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		forget := time.Now().Add(-videoJobMemory)
		videoJobsMu.Lock()
		for id, job := range videoJobs {
			if !job.finished.IsZero() && job.finished.Before(forget) {
				delete(videoJobs, id)
			}
		}
		videoJobsMu.Unlock()
		if days := operation_setting.GetVideoSetting().RetentionDays; days > 0 {
			removeExpiredVideoFiles(time.Now().AddDate(0, 0, -days))
		}
		removeExpiredPublicImages()
	}
}

type videoRequest struct {
	slot   videoSlot
	prompt string
	refs   []musesdk.RefImage
	// long is set for videos made of several segments; prompt and refs are
	// then unused.
	long *longVideo
}

func videoSlotOf(info *relaycommon.RelayInfo) videoSlot {
	return videoSlot{
		channelID: info.ChannelId,
		multiKey:  info.ChannelIsMultiKey,
		proxy:     info.ChannelSetting.Proxy,
		keys:      channelVideoKeys(info.ChannelId, info.ChannelMultiKeyIndex, info.ApiKey, info.ChannelIsMultiKey),
	}
}

// longVideo is a video longer than one Muse clip.
type longVideo struct {
	seconds int
	req     relaycommon.TaskSubmitReq
	extras  videoExtras
	first   *musesdk.RefImage
	last    *musesdk.RefImage
	refs    []musesdk.RefImage
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
	modelName := videoModelName(info)
	if limit := videoTierSeconds(modelName); videoSeconds(req) > limit {
		msg := fmt.Sprintf("%s makes videos of at most %d seconds", modelName, limit)
		if limit == maxVideoSeconds {
			msg += "; use muse-video-20s to muse-video-60s for longer videos"
		}
		return service.TaskErrorWrapperLocal(errors.New(msg), "invalid_seconds", http.StatusBadRequest)
	}
	extras := videoExtrasOf(c)
	if extras.LastImageURL != "" && extras.FirstImageURL == "" {
		return service.TaskErrorWrapperLocal(errors.New("last_image_url requires first_image_url"), "invalid_request", http.StatusBadRequest)
	}
	if videoTierSeconds(modelName) > maxVideoSeconds {
		// Later segments also carry the previous segment's last frame.
		if n := videoImageCount(c, req, extras); n > musesdk.MaxRefImages-1 {
			return service.TaskErrorWrapperLocal(fmt.Errorf("long videos take at most %d images", musesdk.MaxRefImages-1), "invalid_request", http.StatusBadRequest)
		}
	}
	if req.InputReference != "" || len(req.Images) > 0 || hasMultipartReference(c) || extras.hasImages() {
		info.Action = constant.TaskActionImageToVideo
	}
	// A busy channel answers 429 before billing, so the relay can retry on
	// another channel. LocalError keeps the channel from being disabled.
	if videoQueueFull(videoSlotOf(info)) {
		return service.TaskErrorWrapperLocal(errors.New("all Muse accounts of this channel are busy and its queue is full; try again later"), "channel_busy", http.StatusTooManyRequests)
	}
	return nil
}

// videoExtras are request fields TaskSubmitReq does not carry. The names
// follow common Muse video APIs so clients written for them work unchanged.
type videoExtras struct {
	AspectRatio        string   `json:"aspect_ratio"`
	CameraMovement     string   `json:"camera_movement"`
	Style              string   `json:"style"`
	NegativePrompt     string   `json:"negative_prompt"`
	ReferenceImageURLs []string `json:"reference_image_urls"`
	FirstImageURL      string   `json:"first_image_url"`
	LastImageURL       string   `json:"last_image_url"`
}

func (e videoExtras) hasImages() bool {
	return e.FirstImageURL != "" || e.LastImageURL != "" || len(e.ReferenceImageURLs) > 0
}

func videoExtrasOf(c *gin.Context) videoExtras {
	var extras videoExtras
	if form := c.Request.MultipartForm; form != nil {
		get := func(key string) string {
			if values := form.Value[key]; len(values) > 0 {
				return values[0]
			}
			return ""
		}
		extras = videoExtras{
			AspectRatio:        get("aspect_ratio"),
			CameraMovement:     get("camera_movement"),
			Style:              get("style"),
			NegativePrompt:     get("negative_prompt"),
			ReferenceImageURLs: form.Value["reference_image_urls"],
			FirstImageURL:      get("first_image_url"),
			LastImageURL:       get("last_image_url"),
		}
	} else if strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") {
		_ = common.UnmarshalBodyReusable(c, &extras)
	}
	extras.AspectRatio = strings.TrimSpace(extras.AspectRatio)
	extras.CameraMovement = strings.TrimSpace(extras.CameraMovement)
	extras.Style = strings.TrimSpace(extras.Style)
	extras.NegativePrompt = strings.TrimSpace(extras.NegativePrompt)
	extras.FirstImageURL = strings.TrimSpace(extras.FirstImageURL)
	extras.LastImageURL = strings.TrimSpace(extras.LastImageURL)
	return extras
}

func videoSeconds(req relaycommon.TaskSubmitReq) int {
	if req.Duration > 0 {
		return req.Duration
	}
	seconds, _ := strconv.Atoi(req.Seconds)
	return seconds
}

// videoImageCount counts the frames and reference images of a request the
// way BuildRequestBody loads them.
func videoImageCount(c *gin.Context, req relaycommon.TaskSubmitReq, extras videoExtras) int {
	n := len(req.Images)
	if extras.FirstImageURL != "" {
		n++
	}
	if extras.LastImageURL != "" {
		n++
	}
	for _, source := range extras.ReferenceImageURLs {
		if strings.TrimSpace(source) != "" {
			n++
		}
	}
	if req.InputReference != "" {
		n++
	}
	if n == 0 && strings.TrimSpace(req.Image) != "" {
		n++
	}
	if form := c.Request.MultipartForm; form != nil {
		n += len(form.File["input_reference"])
	}
	return n
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
	extras := videoExtrasOf(c)
	// Frames go first so the prompt can name them by position.
	var sources []string
	if extras.FirstImageURL != "" {
		sources = append(sources, extras.FirstImageURL)
	}
	if extras.LastImageURL != "" {
		sources = append(sources, extras.LastImageURL)
	}
	sources = append(sources, req.Images...)
	for _, source := range extras.ReferenceImageURLs {
		if source = strings.TrimSpace(source); source != "" {
			sources = append(sources, source)
		}
	}
	if req.InputReference != "" {
		sources = append(sources, req.InputReference)
	}
	if len(sources) == 0 && strings.TrimSpace(req.Image) != "" {
		sources = append(sources, strings.TrimSpace(req.Image))
	}
	if len(sources) > musesdk.MaxRefImages {
		return nil, fmt.Errorf("at most %d reference images are supported", musesdk.MaxRefImages)
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
		if len(raw) == 0 || len(raw) > musesdk.MaxRefImageBytes {
			return nil, fmt.Errorf("reference image exceeds %d bytes", musesdk.MaxRefImageBytes)
		}
		refs = append(refs, musesdk.RefImage{Data: raw, Mime: mime})
	}
	if form := c.Request.MultipartForm; form != nil {
		for _, header := range form.File["input_reference"] {
			if header.Size > musesdk.MaxRefImageBytes {
				return nil, fmt.Errorf("reference image %s exceeds %d bytes", header.Filename, musesdk.MaxRefImageBytes)
			}
			file, err := header.Open()
			if err != nil {
				return nil, err
			}
			raw, err := io.ReadAll(io.LimitReader(file, musesdk.MaxRefImageBytes+1))
			file.Close()
			if err != nil {
				return nil, err
			}
			if len(raw) == 0 || len(raw) > musesdk.MaxRefImageBytes {
				return nil, fmt.Errorf("reference image %s exceeds %d bytes", header.Filename, musesdk.MaxRefImageBytes)
			}
			refs = append(refs, musesdk.RefImage{Data: raw, Mime: http.DetectContentType(raw)})
		}
	}
	if len(refs) > musesdk.MaxRefImages {
		return nil, fmt.Errorf("at most %d reference images are supported", musesdk.MaxRefImages)
	}
	// Check the selected key's cookies now, so a broken key fails the
	// submission instead of a queued job.
	if _, err := accountFor(info.ChannelId, info.ChannelMultiKeyIndex, info.ChannelIsMultiKey, info.ApiKey, info.ChannelSetting.Proxy); err != nil {
		return nil, err
	}
	slot := videoSlotOf(info)
	if limit := videoTierSeconds(videoModelName(info)); limit > maxVideoSeconds {
		if len(refs) > musesdk.MaxRefImages-1 {
			return nil, fmt.Errorf("long videos take at most %d images", musesdk.MaxRefImages-1)
		}
		long := &longVideo{seconds: videoSeconds(req), req: req, extras: extras}
		if long.seconds <= 0 {
			long.seconds = limit
		}
		rest := refs
		if extras.FirstImageURL != "" {
			long.first, rest = &rest[0], rest[1:]
		}
		if extras.LastImageURL != "" {
			long.last, rest = &rest[0], rest[1:]
		}
		long.refs = rest
		a.request = &videoRequest{slot: slot, long: long}
		return strings.NewReader(""), nil
	}
	prompt := videoPrompt(req, extras, len(refs) > 0)
	a.request = &videoRequest{slot: slot, prompt: prompt, refs: refs}
	return strings.NewReader(""), nil
}

// segment returns the prompt and images of one segment of a long video.
// Every segment gets the user's reference images. The first segment also
// gets the requested first frame; later segments start from the previous
// segment's last frame, and the final segment ends on the requested last
// frame.
func (v *longVideo) segment(s musesdk.VideoSegment) (string, []musesdk.RefImage) {
	var refs []musesdk.RefImage
	var frames []string
	if s.LastFrame != nil {
		refs = append(refs, *s.LastFrame)
		frames = append(frames, "The first attached image is the last frame of the previous part. Start this part exactly from that frame and continue the motion smoothly, keeping the same characters, setting, lighting and style.")
	} else if v.first != nil {
		refs = append(refs, *v.first)
		frames = append(frames, "The first attached image is the opening frame.")
	}
	if s.Index == s.Count-1 && v.last != nil {
		refs = append(refs, *v.last)
		frames = append(frames, fmt.Sprintf("Attached image %d is the final frame; end this part on it.", len(refs)))
	}
	if len(v.refs) > 0 {
		refs = append(refs, v.refs...)
		frames = append(frames, "The other attached images are references for characters, objects and style.")
	}

	var b strings.Builder
	if len(refs) > 0 {
		b.WriteString("Use your video generation tool to create a video from the attached image(s). Do not answer with text only; produce the video file.")
	} else {
		b.WriteString("Use your video generation tool to create a video. Do not answer with text only; produce the video file.")
	}
	if s.Count > 1 {
		fmt.Fprintf(&b, "\nThis is part %d of %d of one continuous %d-second video. It covers seconds %d to %d. Make only this part.", s.Index+1, s.Count, v.seconds, s.Start, s.Start+s.Seconds)
	}
	for _, line := range frames {
		b.WriteString("\n" + line)
	}
	ratio := aspectRatio(v.req.Size)
	if ratio == "" {
		ratio = aspectRatio(v.extras.AspectRatio)
	}
	if ratio != "" {
		b.WriteString("\nVideo aspect ratio: " + ratio + ".")
	}
	fmt.Fprintf(&b, "\nVideo length: %d seconds.", s.Seconds)
	if v.extras.CameraMovement != "" {
		b.WriteString("\nCamera movement: " + v.extras.CameraMovement + ".")
	}
	if v.extras.Style != "" {
		b.WriteString("\nStyle: " + v.extras.Style + ".")
	}
	if v.extras.NegativePrompt != "" {
		b.WriteString("\nAvoid: " + v.extras.NegativePrompt + ".")
	}
	if s.Count > 1 {
		b.WriteString("\n\nDescription of the whole video (make only the part above):\n")
	} else {
		b.WriteString("\n\nVideo description:\n")
	}
	b.WriteString(v.req.Prompt)
	return b.String(), refs
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
	req := *a.request
	videoJobsMu.Lock()
	_, exists := videoJobs[jobID]
	if !exists {
		videoJobs[jobID] = &videoJob{Status: model.TaskStatusQueued}
	}
	videoJobsMu.Unlock()
	if !exists {
		scheduleVideo(&queuedVideo{jobID: jobID, slot: req.slot, start: func(acc *musesdk.Account, release func()) {
			defer release()
			runVideoJob(jobID, acc, req)
		}})
	}
	return jsonResponse(http.StatusOK, []byte(`{}`)), nil
}

// videoPrompt wraps the user's description in an explicit instruction. Muse is
// a general agent: given a bare description such as "a cat running on the
// beach" it often answers in text instead of calling its video tool.
func videoPrompt(req relaycommon.TaskSubmitReq, extras videoExtras, hasRefs bool) string {
	var b strings.Builder
	if hasRefs {
		b.WriteString("Use your video generation tool to animate the attached image(s) into a video. Do not answer with text only; produce the video file.")
	} else {
		b.WriteString("Use your video generation tool to create a video. Do not answer with text only; produce the video file.")
	}
	switch {
	case extras.FirstImageURL != "" && extras.LastImageURL != "":
		b.WriteString("\nThe first attached image is the opening frame and the second attached image is the final frame.")
	case extras.FirstImageURL != "":
		b.WriteString("\nThe first attached image is the opening frame.")
	}
	ratio := aspectRatio(req.Size)
	if ratio == "" {
		ratio = aspectRatio(extras.AspectRatio)
	}
	if ratio != "" {
		b.WriteString("\nVideo aspect ratio: " + ratio + ".")
	}
	if seconds := videoSeconds(req); seconds > 0 {
		b.WriteString(fmt.Sprintf("\nVideo length: %d seconds.", seconds))
	}
	if extras.CameraMovement != "" {
		b.WriteString("\nCamera movement: " + extras.CameraMovement + ".")
	}
	if extras.Style != "" {
		b.WriteString("\nStyle: " + extras.Style + ".")
	}
	if extras.NegativePrompt != "" {
		b.WriteString("\nAvoid: " + extras.NegativePrompt + ".")
	}
	b.WriteString("\n\nVideo description:\n")
	b.WriteString(req.Prompt)
	return b.String()
}

func runVideoJob(jobID string, acc *musesdk.Account, req videoRequest) {
	videoJobsMu.Lock()
	if job := videoJobs[jobID]; job != nil && job.Status == model.TaskStatusQueued {
		job.Status = model.TaskStatusInProgress
	}
	videoJobsMu.Unlock()
	defer func() {
		if recovered := recover(); recovered != nil {
			finishVideoJob(jobID, nil, fmt.Errorf("muse video job panic: %v", recovered))
		}
	}()
	onProgress := func(pct int) {
		videoJobsMu.Lock()
		if job := videoJobs[jobID]; job != nil {
			job.Status = model.TaskStatusInProgress
			job.Progress = min(pct, 99)
		}
		videoJobsMu.Unlock()
	}
	if long := req.long; long != nil {
		segments := len(musesdk.SplitVideoSeconds(long.seconds, maxVideoSeconds))
		ctx, cancel := context.WithTimeout(context.Background(), longVideoTimeout(segments))
		defer cancel()
		file, err := sharedEngine().GenerateLongVideo(ctx, acc, musesdk.LongVideoRequest{
			Seconds:    long.seconds,
			Segment:    long.segment,
			Timeout:    videoGenerateTimeout,
			OnProgress: onProgress,
			Join:       videoJoinMode,
			OnJoin: func(where string, vmErr error) {
				if vmErr != nil {
					common.SysLog(common.LogText("muse video %s: VM join failed, joined locally: %s", jobID, vmErr.Error()))
				}
			},
		})
		var files []musesdk.Media
		if file != nil {
			files = []musesdk.Media{*file}
		}
		finishVideoJob(jobID, files, mediaRefusal(err, "video"))
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), videoGenerateTimeout+time.Minute)
	defer cancel()
	files, err := sharedEngine().Generate(ctx, acc, musesdk.GenRequest{
		Prompt:     req.prompt,
		Kind:       "video",
		Refs:       req.refs,
		N:          1,
		Timeout:    videoGenerateTimeout,
		OnProgress: onProgress,
	})
	finishVideoJob(jobID, files, mediaRefusal(err, "video"))
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
		// A job that finished before a restart left its video on disk.
		sharedEngine()
		if path, _ := findVideoFile(task.GetUpstreamTaskID()); path == "" {
			return jsonResponse(http.StatusNotFound, []byte(`{"status":"NOT_FOUND"}`)), nil
		}
		snapshot = videoJob{Status: model.TaskStatusSuccess, Progress: 100}
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
	if job.Status == model.TaskStatusQueued {
		result.Progress = "0%"
	} else if job.Status == model.TaskStatusInProgress && job.Progress > 0 {
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
// DeleteVideo removes the stored file of a finished Muse video task.
func DeleteVideo(task *model.Task) {
	sharedEngine() // initializes engineConfig, which locates the media dir
	id := task.GetUpstreamTaskID()
	dropQueuedVideo(id)
	videoJobsMu.Lock()
	delete(videoJobs, id)
	videoJobsMu.Unlock()
	if path, _ := findVideoFile(id); path != "" {
		_ = os.Remove(path)
	}
}

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
