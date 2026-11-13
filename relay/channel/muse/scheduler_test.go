package muse

import (
	"sync"
	"testing"
	"time"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testCookie = "hatch_sess=s1; hatch_vml=v1"

func resetScheduler(t *testing.T, concurrency, queueLimit int) {
	t.Helper()
	prevConcurrency, prevLimit := accountConcurrency, channelQueueLimit
	accountConcurrency, channelQueueLimit = concurrency, queueLimit
	schedMu.Lock()
	activeVideos, videoQueues = map[string]int{}, map[int][]*queuedVideo{}
	schedMu.Unlock()
	t.Cleanup(func() {
		accountConcurrency, channelQueueLimit = prevConcurrency, prevLimit
		schedMu.Lock()
		activeVideos, videoQueues = map[string]int{}, map[int][]*queuedVideo{}
		schedMu.Unlock()
	})
}

// recorder starts jobs that block until released, and records which account
// each one ran on.
type recorder struct {
	mu       sync.Mutex
	started  []string
	accounts map[string]string
	releases map[string]func()
	signal   chan string
}

func newRecorder() *recorder {
	return &recorder{accounts: map[string]string{}, releases: map[string]func(){}, signal: make(chan string, 16)}
}

func (r *recorder) job(id string, slot videoSlot) *queuedVideo {
	return &queuedVideo{jobID: id, slot: slot, start: func(acc *musesdk.Account, release func()) {
		r.mu.Lock()
		r.started = append(r.started, id)
		r.accounts[id] = acc.ID
		r.releases[id] = release
		r.mu.Unlock()
		r.signal <- id
	}}
}

func (r *recorder) wait(t *testing.T, want string) {
	t.Helper()
	select {
	case got := <-r.signal:
		require.Equal(t, want, got)
	case <-time.After(2 * time.Second):
		t.Fatalf("job %s did not start", want)
	}
}

func (r *recorder) idle(t *testing.T) {
	t.Helper()
	select {
	case got := <-r.signal:
		t.Fatalf("job %s started while every account was busy", got)
	case <-time.After(100 * time.Millisecond):
	}
}

func (r *recorder) release(id string) {
	r.mu.Lock()
	release := r.releases[id]
	r.mu.Unlock()
	release()
}

func twoKeySlot(channelID int) videoSlot {
	return videoSlot{channelID: channelID, multiKey: true, keys: []channelKey{{0, testCookie}, {1, testCookie}}}
}

func TestSchedulerSpreadsJobsAcrossKeysAndQueuesTheRest(t *testing.T) {
	resetScheduler(t, 1, 5)
	r := newRecorder()
	slot := twoKeySlot(9001)

	scheduleVideo(r.job("a", slot))
	r.wait(t, "a")
	scheduleVideo(r.job("b", slot))
	r.wait(t, "b")
	assert.NotEqual(t, r.accounts["a"], r.accounts["b"], "two jobs on one account while another was free")

	// Both keys are busy: c and d wait, in order.
	scheduleVideo(r.job("c", slot))
	scheduleVideo(r.job("d", slot))
	r.idle(t)

	r.release("a")
	r.wait(t, "c")
	assert.Equal(t, r.accounts["a"], r.accounts["c"])
	r.idle(t)

	r.release("b")
	r.wait(t, "d")

	// Releasing twice frees only one slot.
	r.release("c")
	r.release("c")
	r.release("d")
	schedMu.Lock()
	assert.Empty(t, activeVideos)
	assert.Empty(t, videoQueues)
	schedMu.Unlock()
}

func TestSchedulerQueueLimitAndDrop(t *testing.T) {
	resetScheduler(t, 1, 2)
	r := newRecorder()
	slot := videoSlot{channelID: 9002, keys: []channelKey{{0, testCookie}}}

	assert.False(t, videoQueueFull(slot))
	scheduleVideo(r.job("a", slot))
	r.wait(t, "a")
	assert.False(t, videoQueueFull(slot), "an empty queue with a busy key still has room")
	scheduleVideo(r.job("b", slot))
	scheduleVideo(r.job("c", slot))
	assert.True(t, videoQueueFull(slot))

	assert.True(t, dropQueuedVideo("b"))
	assert.False(t, dropQueuedVideo("b"))
	assert.False(t, videoQueueFull(slot))

	r.release("a")
	r.wait(t, "c")
	r.idle(t)
	r.release("c")
}

func TestSchedulerKeepsChannelsApart(t *testing.T) {
	resetScheduler(t, 1, 5)
	r := newRecorder()
	one := videoSlot{channelID: 9003, keys: []channelKey{{0, testCookie}}}
	two := videoSlot{channelID: 9004, keys: []channelKey{{0, testCookie}}}

	scheduleVideo(r.job("a", one))
	r.wait(t, "a")
	scheduleVideo(r.job("b", one))
	// A busy channel does not hold up another channel.
	scheduleVideo(r.job("c", two))
	r.wait(t, "c")
	r.idle(t)

	r.release("a")
	r.wait(t, "b")
	r.release("b")
	r.release("c")
}

func TestSchedulerConcurrencyAboveOne(t *testing.T) {
	resetScheduler(t, 2, 5)
	r := newRecorder()
	slot := videoSlot{channelID: 9005, keys: []channelKey{{0, testCookie}}}
	scheduleVideo(r.job("a", slot))
	r.wait(t, "a")
	scheduleVideo(r.job("b", slot))
	r.wait(t, "b")
	scheduleVideo(r.job("c", slot))
	r.idle(t)
	r.release("b")
	r.wait(t, "c")
	r.release("a")
	r.release("c")
}
