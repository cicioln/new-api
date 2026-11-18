package muse

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
)

var videoQueueTimeout = time.Duration(max(1, common.GetEnvOrDefault("MUSE_QUEUE_TIMEOUT_MINUTES", 10))) * time.Minute
var videoMaxAttempts = max(1, common.GetEnvOrDefault("MUSE_VIDEO_MAX_ATTEMPTS", 3))

// Inputs and checkpoints never enter public task Data or Redis. In particular,
// upstream media URLs, prompts and reference images remain on the owner node.
// Credentials are reloaded from the channel; they are never written here.
type videoInput struct {
	ChannelID int
	MultiKey  bool
	Prompt    string
	Refs      []musesdk.RefImage
	Long      *videoLongInput
}

type videoLongInput struct {
	Limit   int
	Seconds int
	Request relaycommon.TaskSubmitReq
	Extras  videoExtras
	First   *musesdk.RefImage
	Last    *musesdk.RefImage
	Refs    []musesdk.RefImage
	Shots   []musesdk.VideoShot
}

type videoCheckpoint struct {
	Job      videoJob
	State    json.RawMessage
	KeyIndex int
	Tried    map[int]bool
	File     string
	Mime     string
	ReadyAt  time.Time
}

func videoJobPath(id, suffix string) string {
	return filepath.Join(filepath.Dir(engineConfig.MediaDir()), "video-jobs", filepath.Base(id)+suffix)
}

func writeVideoJSON(path string, value any) error {
	body, err := common.Marshal(value)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".checkpoint-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(body); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(f.Name(), path)
}

// Caller holds videoJobsMu; serialization and atomic replacement preserve
// checkpoint ordering even when progress and deadline events race.
func persistVideoJobLocked(id string, job *videoJob) error {
	if job.input == nil {
		return nil
	} // legacy jobs and scheduler fixtures
	job.UpdatedAt = time.Now().Unix()
	return writeVideoJSON(videoJobPath(id, ".json"), videoCheckpoint{
		Job: *job, State: job.state, KeyIndex: job.keyIndex, Tried: job.tried, File: job.file, Mime: job.mime, ReadyAt: job.readyAt,
	})
}

func saveVideoState(id string, state any) error {
	body, err := common.Marshal(state)
	if err != nil {
		return err
	}
	videoJobsMu.Lock()
	defer videoJobsMu.Unlock()
	job := videoJobs[id]
	if job == nil || job.ctx.Err() != nil {
		return context.Canceled
	}
	job.state = body
	if err := persistVideoJobLocked(id, job); err != nil {
		job.Code, job.Reason = "storage_failed", "Video could not be saved"
		job.cancel()
		return &musesdk.NoRetry{Err: err}
	}
	return nil
}

func setVideoStage(id, stage string, segment, segments int) {
	videoJobsMu.Lock()
	defer videoJobsMu.Unlock()
	job := videoJobs[id]
	if job == nil || !job.finished.IsZero() {
		return
	}
	now := time.Now().Unix()
	if job.Stage != stage || job.Segment != segment {
		if job.StageSeconds == nil {
			job.StageSeconds = map[string]int64{}
		}
		if job.StageStartedAt > 0 {
			job.StageSeconds[job.Stage] += max(0, now-job.StageStartedAt)
		}
		job.StageStartedAt = now
	}
	job.Stage, job.Segment, job.Segments = stage, segment, segments
	if err := persistVideoJobLocked(id, job); err != nil {
		job.Code, job.Reason = "storage_failed", "Video could not be saved"
		common.SysError(common.LogText("muse video %s checkpoint failed: %v", id, err))
		if job.cancel != nil {
			job.cancel()
		}
	}
}

func videoExecutionBudget(input *videoInput) time.Duration {
	if input.Long == nil {
		return videoGenerateTimeout + 7*time.Minute
	}
	n := len(musesdk.SplitVideoSeconds(input.Long.Seconds, maxVideoSeconds))
	if len(input.Long.Shots) > 0 {
		n = len(input.Long.Shots)
	}
	return longVideoTimeout(max(1, n))
}

func videoFailure(err error, stage string) (string, string) {
	var phase *musesdk.StageError
	if errors.As(err, &phase) {
		stage = phase.Stage
	}
	if errors.Is(err, context.DeadlineExceeded) {
		switch stage {
		case "queued", "retrying":
			return "queue_timeout", "Video queue wait timed out"
		case "downloading":
			return "download_timeout", "Video download timed out"
		case "joining":
			return "join_timeout", "Video assembly timed out"
		default:
			return "generation_timeout", "Video generation timed out"
		}
	}
	if errors.Is(err, context.Canceled) {
		return "canceled", "Video task canceled"
	}
	if stage == "downloading" {
		return "download_failed", "Video generated but download failed"
	}
	if stage == "joining" {
		return "join_failed", "Video assembly failed"
	}
	switch musesdk.KindOf(err) {
	case musesdk.KindBadRequest:
		return "invalid_request", "Video request was rejected"
	case musesdk.KindRefusal:
		return "generation_refused", "Video generation was refused"
	case musesdk.KindAuth:
		return "account_unavailable", "Video account is unavailable"
	case musesdk.KindQuota:
		return "quota_exhausted", "Video account quota is exhausted"
	case musesdk.KindRateLimit:
		return "rate_limited", "Video generation is rate limited"
	default:
		return "generation_failed", "Video generation failed"
	}
}

// StartVideoWorker initializes checkpoint recovery on every node, including
// workers that do not own the global async-task polling lease.
func StartVideoWorker() { sharedEngine() }

func expireQueuedVideos(now time.Time) {
	var expired []string
	videoJobsMu.Lock()
	for id, job := range videoJobs {
		if job.Status == model.TaskStatusQueued && job.ctx != nil && (job.ctx.Err() != nil ||
			(job.ExecutionDeadline > 0 && now.Unix() >= job.ExecutionDeadline) ||
			now.Unix()-job.StageStartedAt >= int64(videoQueueTimeout/time.Second)) {
			expired = append(expired, id)
		}
	}
	videoJobsMu.Unlock()
	for _, id := range expired {
		if dropQueuedVideo(id) {
			finishVideoJob(id, nil, context.DeadlineExceeded)
		}
	}
}

func maintainVideoJobs() {
	entries, _ := os.ReadDir(filepath.Dir(videoJobPath("", ".json")))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") || strings.HasSuffix(entry.Name(), ".input.json") {
			continue
		}
		id := strings.TrimSuffix(entry.Name(), ".json")
		if err := restoreVideoJob(id); err != nil {
			common.SysError(common.LogText("muse video %s recovery failed: %v", id, err))
		}
	}
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		// Database state is durable across Redis outages and process restarts.
		// Read outside videoJobsMu so termination never blocks progress updates.
		var running []string
		videoJobsMu.Lock()
		for id, job := range videoJobs {
			if job.finished.IsZero() {
				running = append(running, id)
			}
		}
		videoJobsMu.Unlock()
		for _, id := range running {
			if task, exists, err := model.GetUniqueByOnlyTaskId(id); err == nil && exists && task.Status == model.TaskStatusFailure && task.FailReason == service.VideoTaskTerminatedReason {
				terminateVideoJob(id)
			}
		}
		expireQueuedVideos(time.Now())
		var snapshots = map[string][]byte{}
		videoJobsMu.Lock()
		for id, job := range videoJobs {
			if common.RedisEnabled && common.RDB != nil {
				body, err := common.Marshal(job)
				if err == nil {
					snapshots[id] = body
				}
			}
		}
		videoJobsMu.Unlock()
		schedMu.Lock()
		for channelID := range videoQueues {
			dispatchLocked(channelID)
		}
		schedMu.Unlock()
		if len(snapshots) > 0 {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			pipe := common.RDB.Pipeline()
			for id, body := range snapshots {
				pipe.Set(ctx, "muse:video:"+id, body, 24*time.Hour)
			}
			_, err := pipe.Exec(ctx)
			_ = pipe.Close()
			cancel()
			if err != nil {
				common.SysError(common.LogText("muse shared video status failed: %v", err))
			}
		}
	}
}

func restoreVideoJob(id string) error {
	videoJobsMu.Lock()
	defer videoJobsMu.Unlock()
	if videoJobs[id] != nil {
		return nil
	}
	body, err := os.ReadFile(videoJobPath(id, ".json"))
	if err != nil {
		return err
	}
	var checkpoint videoCheckpoint
	if err := common.Unmarshal(body, &checkpoint); err != nil {
		return err
	}
	job := &checkpoint.Job
	if job.Owner != common.NodeName {
		return nil
	}
	job.file, job.mime, job.state, job.keyIndex, job.tried = checkpoint.File, checkpoint.Mime, checkpoint.State, checkpoint.KeyIndex, checkpoint.Tried
	job.readyAt = checkpoint.ReadyAt
	if path, mime := findVideoFile(id); path != "" {
		job.file, job.mime, job.Status, job.Progress, job.Stage = path, mime, model.TaskStatusSuccess, 100, "completed"
	}
	if job.Status == model.TaskStatusSuccess || job.Status == model.TaskStatusFailure {
		job.finished = time.Unix(job.UpdatedAt, 0)
		videoJobs[id] = job
		return nil
	}
	body, err = os.ReadFile(videoJobPath(id, ".input.json"))
	if err != nil {
		return err
	}
	job.input = &videoInput{}
	if err := common.Unmarshal(body, job.input); err != nil {
		return err
	}
	deadline := job.Deadline
	if job.ExecutionDeadline > 0 {
		deadline = min(deadline, job.ExecutionDeadline)
	}
	job.ctx, job.cancel = context.WithDeadline(context.Background(), time.Unix(deadline, 0))
	resumed := job.Status != model.TaskStatusQueued || len(job.state) > 0
	if job.Status != model.TaskStatusQueued {
		job.Status, job.Stage, job.StageStartedAt = model.TaskStatusQueued, "recovering", time.Now().Unix()
	}
	videoJobs[id] = job
	// Scheduling must acquire schedMu before videoJobsMu, never in reverse.
	go func() {
		if task, exists, err := model.GetUniqueByOnlyTaskId(id); err != nil {
			finishVideoJob(id, nil, &musesdk.NoRetry{Err: err})
			return
		} else if exists && task.Status == model.TaskStatusFailure && task.FailReason == service.VideoTaskTerminatedReason {
			terminateVideoJob(id)
			return
		}
		if job.ctx.Err() != nil {
			finishVideoJob(id, nil, job.ctx.Err())
			return
		}
		channel, err := model.CacheGetChannel(job.input.ChannelID)
		if err != nil {
			finishVideoJob(id, nil, err)
			return
		}
		keys := channel.GetKeys()
		if job.keyIndex < 0 || job.keyIndex >= len(keys) {
			finishVideoJob(id, nil, errors.New("saved Muse account is unavailable"))
			return
		}
		slot := videoSlot{channelID: channel.Id, multiKey: job.input.MultiKey, proxy: channel.GetSetting().Proxy,
			keys: channelVideoKeys(channel.Id, job.keyIndex, keys[job.keyIndex], job.input.MultiKey)}
		// Any saved session must stay on the original account. Only a never
		// submitted queued job may be assigned to another available account.
		if len(job.state) > 0 {
			var selected []channelKey
			for _, key := range slot.keys {
				if key.index == job.keyIndex {
					selected = []channelKey{key}
					break
				}
			}
			if len(selected) == 0 {
				finishVideoJob(id, nil, errors.New("saved Muse account is disabled"))
				return
			}
			slot.keys = selected
		}
		req := videoRequest{slot: slot, prompt: job.input.Prompt, refs: job.input.Refs}
		if v := job.input.Long; v != nil {
			req.long = &longVideo{limit: v.Limit, seconds: v.Seconds, req: v.Request, extras: v.Extras, first: v.First, last: v.Last, refs: v.Refs, shots: v.Shots}
		}
		queued := &queuedVideo{jobID: id, slot: slot, tried: job.tried, resumed: resumed, readyAt: job.readyAt, run: func(acc *musesdk.Account) ([]musesdk.Media, error) { return runVideoJob(id, acc, req) }}
		if err := scheduleVideo(queued); err != nil {
			finishVideoJob(id, nil, err)
		}
	}()
	return nil
}
