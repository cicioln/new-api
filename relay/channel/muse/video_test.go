package muse

import (
	"strings"
	"testing"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
