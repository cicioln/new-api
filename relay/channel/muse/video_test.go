package muse

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVideoPollerReadsOwnerStatusFromRedis(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { require.NoError(t, client.Close()) })
	oldConfig, oldRedis, oldClient := engineConfig, common.RedisEnabled, common.RDB
	engineConfig, common.RedisEnabled, common.RDB = musesdk.Config{DataDir: t.TempDir()}, true, client
	t.Cleanup(func() { engineConfig, common.RedisEnabled, common.RDB = oldConfig, oldRedis, oldClient })
	remote := videoJob{Status: model.TaskStatusInProgress, Owner: "remote-worker", Progress: 92, Stage: "joining", Segment: 3, Segments: 3, Deadline: time.Now().Add(time.Minute).Unix()}
	body, err := common.Marshal(remote)
	require.NoError(t, err)
	require.NoError(t, client.Set(context.Background(), "muse:video:remote-redis", body, time.Hour).Err())
	task := &model.Task{TaskID: "remote-redis", Status: model.TaskStatusInProgress}
	snapshot := loadVideoSnapshot(task)
	assert.Equal(t, "joining", snapshot.Stage)
	assert.Equal(t, 92, snapshot.Progress)
	assert.Equal(t, model.TaskStatusInProgress, snapshot.Status)
	task.Data = body
	response, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	require.NoError(t, err)
	assert.Contains(t, string(response), `"stage":"joining"`)
	assert.Contains(t, string(response), `"segments":3`)
}

func TestVideoCheckpointRecoversCompletedFileAndKeepsStatePrivate(t *testing.T) {
	oldConfig, oldNode := engineConfig, common.NodeName
	engineConfig, common.NodeName = musesdk.Config{DataDir: t.TempDir()}, "test-owner"
	t.Cleanup(func() { engineConfig, common.NodeName = oldConfig, oldNode })
	id := "checkpoint-test"
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	job := &videoJob{Status: model.TaskStatusInProgress, Owner: common.NodeName, Deadline: time.Now().Add(time.Minute).Unix(), input: &videoInput{ChannelID: 42}, ctx: ctx, cancel: cancel}
	videoJobsMu.Lock()
	videoJobs[id] = job
	videoJobsMu.Unlock()
	t.Cleanup(func() { videoJobsMu.Lock(); delete(videoJobs, id); videoJobsMu.Unlock() })
	state := &musesdk.GenerationState{SessionID: "private-session", MessageID: "private-message", Deadline: time.Now().Add(time.Minute)}
	require.NoError(t, saveVideoState(id, state))
	body, err := os.ReadFile(videoJobPath(id, ".json"))
	require.NoError(t, err)
	var checkpoint videoCheckpoint
	require.NoError(t, common.Unmarshal(body, &checkpoint))
	assert.Equal(t, job.Deadline, checkpoint.Job.Deadline)
	assert.Contains(t, string(checkpoint.State), "private-session")
	public, err := common.Marshal(job)
	require.NoError(t, err)
	assert.NotContains(t, string(public), "private-session")
	assert.NotContains(t, string(public), "private-message")
	require.NoError(t, os.MkdirAll(engineConfig.MediaDir(), 0700))
	require.NoError(t, os.WriteFile(videoFilePath(id, ".mp4"), []byte("finished video"), 0600))
	videoJobsMu.Lock()
	delete(videoJobs, id)
	videoJobsMu.Unlock()
	require.NoError(t, restoreVideoJob(id))
	videoJobsMu.Lock()
	restored := *videoJobs[id]
	videoJobsMu.Unlock()
	assert.Equal(t, model.TaskStatusSuccess, restored.Status)
	assert.Equal(t, 100, restored.Progress)
}

func TestVideoMissingOnPollingNodeRemainsUnknownUntilDeadline(t *testing.T) {
	oldConfig, oldRedis := engineConfig, common.RedisEnabled
	engineConfig, common.RedisEnabled = musesdk.Config{DataDir: t.TempDir()}, false
	t.Cleanup(func() { engineConfig, common.RedisEnabled = oldConfig, oldRedis })
	task := &model.Task{TaskID: "remote-task", SubmitTime: time.Now().Unix(), PrivateData: model.TaskPrivateData{NodeName: "other-node"}}
	task.SetData(videoJob{Deadline: time.Now().Add(time.Minute).Unix()})
	snapshot := loadVideoSnapshot(task)
	assert.Equal(t, model.TaskStatusInProgress, snapshot.Status)
	assert.Equal(t, "status_unknown", snapshot.Stage)
	assert.Empty(t, snapshot.Reason)
	task.SetData(videoJob{Deadline: time.Now().Add(-time.Minute).Unix()})
	snapshot = loadVideoSnapshot(task)
	assert.Equal(t, model.TaskStatusFailure, snapshot.Status)
	assert.Equal(t, "recovery_timeout", snapshot.Code)
	task.SetData(videoJob{Status: model.TaskStatusFailure, Code: "download_failed", Reason: "Video generated but download failed"})
	snapshot = loadVideoSnapshot(task)
	assert.Equal(t, model.TaskStatusFailure, snapshot.Status)
	assert.Equal(t, "download_failed", snapshot.Code)
}

func TestVideoFailureUsesStageAndTypedCause(t *testing.T) {
	for _, tc := range []struct{ stage, code string }{
		{"queued", "queue_timeout"}, {"generating", "generation_timeout"}, {"downloading", "download_timeout"}, {"joining", "join_timeout"},
	} {
		code, _ := videoFailure(&musesdk.StageError{Stage: tc.stage, Err: context.DeadlineExceeded}, "other")
		assert.Equal(t, tc.code, code)
	}
	code, _ := videoFailure(errors.New("network failed"), "downloading")
	assert.Equal(t, "download_failed", code)
}

func TestVideoRetryKeepsDeadlineAndProgress(t *testing.T) {
	oldConfig := engineConfig
	engineConfig = musesdk.Config{DataDir: t.TempDir()}
	t.Cleanup(func() { engineConfig = oldConfig })
	id := "retry-budget-test"
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	deadline := time.Now().Add(time.Minute).Unix()
	job := &videoJob{Status: model.TaskStatusInProgress, Progress: 35, Deadline: deadline, ExecutionDeadline: deadline, Attempt: 1, ctx: ctx, input: &videoInput{}}
	videoJobsMu.Lock()
	videoJobs[id] = job
	videoJobsMu.Unlock()
	t.Cleanup(func() { videoJobsMu.Lock(); delete(videoJobs, id); videoJobsMu.Unlock() })
	readyAt := time.Now().Add(30 * time.Second)
	assert.True(t, requeueVideoJob(id, map[int]bool{0: true}, readyAt))
	body, err := os.ReadFile(videoJobPath(id, ".json"))
	require.NoError(t, err)
	var checkpoint videoCheckpoint
	require.NoError(t, common.Unmarshal(body, &checkpoint))
	assert.True(t, readyAt.Equal(checkpoint.ReadyAt), "restart must preserve provider retry delay")
	assert.Equal(t, deadline, job.Deadline)
	assert.Equal(t, deadline, job.ExecutionDeadline)
	assert.Equal(t, 35, job.Progress)
	job.Attempt = videoMaxAttempts
	assert.False(t, requeueVideoJob(id, nil, readyAt))
	job.Attempt = 1
	cancel()
	assert.False(t, requeueVideoJob(id, nil, readyAt))
}

func TestExpiredQueuedVideoStopsWithoutGenerating(t *testing.T) {
	resetScheduler(t, 1, 2)
	id := "expired-queued"
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	job := &videoJob{Status: model.TaskStatusQueued, Stage: "queued", StageStartedAt: time.Now().Add(-videoQueueTimeout - time.Second).Unix(), ctx: ctx, cancel: cancel}
	videoJobsMu.Lock()
	videoJobs[id] = job
	videoJobsMu.Unlock()
	t.Cleanup(func() { videoJobsMu.Lock(); delete(videoJobs, id); videoJobsMu.Unlock() })
	schedMu.Lock()
	videoQueues[9050] = []*queuedVideo{{jobID: id, slot: videoSlot{channelID: 9050}}}
	schedMu.Unlock()
	expireQueuedVideos(time.Now())
	assert.Equal(t, model.TaskStatusFailure, job.Status)
	assert.Equal(t, "queue_timeout", job.Code)
	assert.ErrorIs(t, ctx.Err(), context.Canceled)
	schedMu.Lock()
	assert.Empty(t, videoQueues[9050])
	schedMu.Unlock()
}

func TestAdminTerminationCancelsMuseWorkAndRejectsLateResult(t *testing.T) {
	resetScheduler(t, 1, 2)
	id := "admin-terminated"
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	job := &videoJob{Status: model.TaskStatusQueued, Stage: "queued", ctx: ctx, cancel: cancel}
	videoJobsMu.Lock()
	videoJobs[id] = job
	videoJobsMu.Unlock()
	t.Cleanup(func() { videoJobsMu.Lock(); delete(videoJobs, id); videoJobsMu.Unlock() })
	schedMu.Lock()
	videoQueues[9060] = []*queuedVideo{{jobID: id, slot: videoSlot{channelID: 9060}}}
	schedMu.Unlock()
	terminateVideoJob(id)
	assert.ErrorIs(t, ctx.Err(), context.Canceled)
	assert.Equal(t, model.TaskStatusFailure, job.Status)
	assert.Equal(t, "admin_terminated", job.Code)
	finishVideoJob(id, nil, nil)
	assert.Equal(t, "admin_terminated", job.Code)
	schedMu.Lock()
	assert.Empty(t, videoQueues[9060])
	schedMu.Unlock()
}

func TestVideoTierSeconds(t *testing.T) {
	cases := map[string]int{
		"muse-video":     10,
		"muse-video-20s": 20,
		"muse-video-30s": 30,
		"muse-video-60s": 60,
		"muse-video-10s": 10,
		"muse-video-5s":  10,
		"muse-video-20":  10,
		"muse-video-xs":  10,
		"muse-image":     10,
	}
	for name, want := range cases {
		assert.Equal(t, want, videoTierSeconds(name), name)
	}
	for _, name := range ModelList {
		if strings.HasPrefix(name, "muse-video-") {
			assert.Greater(t, videoTierSeconds(name), maxVideoSeconds, name)
		}
	}
}

func TestLongVideoSegmentPrompts(t *testing.T) {
	first := musesdk.RefImage{Data: []byte("first"), Mime: "image/png"}
	last := musesdk.RefImage{Data: []byte("last"), Mime: "image/png"}
	ref := musesdk.RefImage{Data: []byte("ref"), Mime: "image/png"}
	prev := musesdk.RefImage{Data: []byte("prev"), Mime: "image/png"}
	v := &longVideo{
		seconds: 30,
		req:     relaycommon.TaskSubmitReq{Prompt: "a fox runs through snow", Size: "1280x720"},
		extras:  videoExtras{Style: "anime"},
		first:   &first,
		last:    &last,
		refs:    []musesdk.RefImage{ref},
	}

	prompt, refs := v.segment(musesdk.VideoSegment{Index: 0, Count: 3, Start: 0, Seconds: 10})
	require.Equal(t, []musesdk.RefImage{first, ref}, refs)
	assert.Contains(t, prompt, "part 1 of 3")
	assert.Contains(t, prompt, "opening frame")
	assert.Contains(t, prompt, "Video length: 10 seconds.")
	assert.Contains(t, prompt, "Video aspect ratio: 16:9.")
	assert.Contains(t, prompt, "Style: anime.")
	assert.NotContains(t, prompt, "final frame")
	assert.True(t, strings.HasSuffix(prompt, "a fox runs through snow"))

	prompt, refs = v.segment(musesdk.VideoSegment{Index: 1, Count: 3, Start: 10, Seconds: 10, LastFrame: &prev})
	require.Equal(t, []musesdk.RefImage{prev, ref}, refs)
	assert.Contains(t, prompt, "seconds 10 to 20")
	assert.Contains(t, prompt, "last frame of the previous part")
	assert.NotContains(t, prompt, "opening frame")

	prompt, refs = v.segment(musesdk.VideoSegment{Index: 2, Count: 3, Start: 20, Seconds: 10, LastFrame: &prev})
	require.Equal(t, []musesdk.RefImage{prev, last, ref}, refs)
	assert.Contains(t, prompt, "Attached image 2 is the final frame")
}

func TestLongVideoSingleSegmentPrompt(t *testing.T) {
	v := &longVideo{seconds: 8, req: relaycommon.TaskSubmitReq{Prompt: "rain"}}
	prompt, refs := v.segment(musesdk.VideoSegment{Index: 0, Count: 1, Seconds: 8})
	assert.Empty(t, refs)
	assert.NotContains(t, prompt, "part 1")
	assert.Contains(t, prompt, "Video length: 8 seconds.")
}

func TestParseTaskResultKeepsQueuedAtZeroProgress(t *testing.T) {
	var a TaskAdaptor
	task := &model.Task{TaskID: "task_muse_q1"}

	queued, err := a.ParseTaskResult(task, nil, []byte(`{"status":"QUEUED","progress":0}`))
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusQueued, queued.Status)
	assert.Equal(t, "0%", queued.Progress)

	running, err := a.ParseTaskResult(task, nil, []byte(`{"status":"IN_PROGRESS","progress":45}`))
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusInProgress, running.Status)
	assert.Equal(t, "45%", running.Progress)
}

func TestLongVideoStoryboardShotsWithCutAndContinuous(t *testing.T) {
	ref := musesdk.RefImage{Data: []byte("ref"), Mime: "image/png"}
	prev := musesdk.RefImage{Data: []byte("prev"), Mime: "image/png"}
	v := &longVideo{
		limit:   20,
		seconds: 15,
		req:     relaycommon.TaskSubmitReq{Prompt: "1-7s: 镜头A 7-15s: 镜头B"},
		refs:    []musesdk.RefImage{ref},
		shots: []musesdk.VideoShot{
			{Seconds: 7, ContinuousFromPrev: false, Prompt: "镜头A：男主在咖啡馆看表"},
			{Seconds: 8, ContinuousFromPrev: false, Prompt: "镜头B：切到窗外警车飞驰"},
		},
	}

	p0, refs0 := v.segment(musesdk.VideoSegment{Index: 0, Count: 2, Start: 0, Seconds: 7})
	require.Equal(t, []musesdk.RefImage{ref}, refs0)
	assert.Contains(t, p0, "seconds 0 to 7 (7 seconds)")
	assert.Contains(t, p0, "Video length: 7 seconds.")
	assert.Contains(t, p0, "镜头A：男主在咖啡馆看表")
	assert.NotContains(t, p0, "镜头B")

	// Scene cut (ContinuousFromPrev == false): LastFrame is omitted so the camera can cut cleanly.
	p1, refs1 := v.segment(musesdk.VideoSegment{Index: 1, Count: 2, Start: 7, Seconds: 8, LastFrame: &prev})
	require.Equal(t, []musesdk.RefImage{ref}, refs1)
	assert.Contains(t, p1, "seconds 7 to 15 (8 seconds)")
	assert.Contains(t, p1, "Video length: 8 seconds.")
	assert.Contains(t, p1, "new camera angle or scene cut")
	assert.Contains(t, p1, "镜头B：切到窗外警车飞驰")

	// Continuous shot (ContinuousFromPrev == true): LastFrame is attached first.
	v.shots[1].ContinuousFromPrev = true
	p1Cont, refs1Cont := v.segment(musesdk.VideoSegment{Index: 1, Count: 2, Start: 7, Seconds: 8, LastFrame: &prev})
	require.Equal(t, []musesdk.RefImage{prev, ref}, refs1Cont)
	assert.Contains(t, p1Cont, "last frame of the previous part")
}
