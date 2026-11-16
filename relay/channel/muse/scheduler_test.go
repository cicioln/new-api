package muse

import (
	"sync"
	"testing"
	"time"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/model"
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

// recorder starts jobs that block until the test ends their attempt, and
// records which account each attempt ran on.
type recorder struct {
	mu       sync.Mutex
	accounts map[string][]string
	results  map[string]chan error
	signal   chan string
}

func newRecorder() *recorder {
	return &recorder{accounts: map[string][]string{}, results: map[string]chan error{}, signal: make(chan string, 16)}
}

func (r *recorder) resultOf(id string) chan error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.results[id] == nil {
		r.results[id] = make(chan error, 4)
	}
	return r.results[id]
}

func (r *recorder) job(id string, slot videoSlot) *queuedVideo {
	results := r.resultOf(id)
	return &queuedVideo{jobID: id, slot: slot, run: func(acc *musesdk.Account) ([]musesdk.Media, error) {
		r.mu.Lock()
		r.accounts[id] = append(r.accounts[id], acc.ID)
		r.mu.Unlock()
		r.signal <- id
		return nil, <-results
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

// release ends the job's current attempt successfully.
func (r *recorder) release(id string) { r.resultOf(id) <- nil }

// fail ends the job's current attempt with err.
func (r *recorder) fail(id string, err error) { r.resultOf(id) <- err }

func (r *recorder) accountsOf(id string) []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.accounts[id]...)
}

// trackJob registers a task the way DoRequest does and returns a function
// that waits for its final status.
func trackJob(t *testing.T, id string) func() videoJob {
	t.Helper()
	videoJobsMu.Lock()
	videoJobs[id] = &videoJob{Status: model.TaskStatusQueued}
	videoJobsMu.Unlock()
	t.Cleanup(func() {
		videoJobsMu.Lock()
		delete(videoJobs, id)
		videoJobsMu.Unlock()
	})
	return func() videoJob {
		t.Helper()
		var job videoJob
		require.Eventually(t, func() bool {
			videoJobsMu.Lock()
			defer videoJobsMu.Unlock()
			job = *videoJobs[id]
			return !job.finished.IsZero()
		}, 2*time.Second, 10*time.Millisecond)
		return job
	}
}

func twoKeySlot(channelID int) videoSlot {
	return videoSlot{channelID: channelID, multiKey: true, keys: []channelKey{{index: 0, key: testCookie}, {index: 1, key: testCookie}}}
}

func TestSchedulerSpreadsJobsAcrossKeysAndQueuesTheRest(t *testing.T) {
	resetScheduler(t, 1, 5)
	r := newRecorder()
	slot := twoKeySlot(9001)

	scheduleVideo(r.job("a", slot))
	r.wait(t, "a")
	scheduleVideo(r.job("b", slot))
	r.wait(t, "b")
	assert.NotEqual(t, r.accountsOf("a"), r.accountsOf("b"), "two jobs on one account while another was free")

	// Both keys are busy: c and d wait, in order.
	scheduleVideo(r.job("c", slot))
	scheduleVideo(r.job("d", slot))
	r.idle(t)

	r.release("a")
	r.wait(t, "c")
	assert.Equal(t, r.accountsOf("a"), r.accountsOf("c"))
	r.idle(t)

	r.release("b")
	r.wait(t, "d")

	r.release("c")
	r.release("d")
	require.Eventually(t, func() bool {
		schedMu.Lock()
		defer schedMu.Unlock()
		return len(activeVideos) == 0 && len(videoQueues) == 0
	}, 2*time.Second, 10*time.Millisecond)
}

func TestSchedulerQueueLimitAndDrop(t *testing.T) {
	resetScheduler(t, 1, 2)
	r := newRecorder()
	slot := videoSlot{channelID: 9002, keys: []channelKey{{index: 0, key: testCookie}}}

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
	one := videoSlot{channelID: 9003, keys: []channelKey{{index: 0, key: testCookie}}}
	two := videoSlot{channelID: 9004, keys: []channelKey{{index: 0, key: testCookie}}}

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
	slot := videoSlot{channelID: 9005, keys: []channelKey{{index: 0, key: testCookie}}}
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

func TestSchedulerRetriesFailedJobOnEveryOtherKey(t *testing.T) {
	resetScheduler(t, 1, 5)
	r := newRecorder()
	slot := videoSlot{channelID: 9006, multiKey: true, keys: []channelKey{{index: 0, key: testCookie}, {index: 1, key: testCookie}, {index: 2, key: testCookie}}}
	final := trackJob(t, "a")
	refusal := &musesdk.Error{Kind: musesdk.KindRefusal, Msg: "无法生成该视频"}

	scheduleVideo(r.job("a", slot))
	r.wait(t, "a")
	r.fail("a", refusal)
	r.wait(t, "a")
	r.fail("a", refusal)
	r.wait(t, "a")
	r.fail("a", refusal)

	job := final()
	assert.Equal(t, model.TaskStatusFailure, job.Status)
	assert.Equal(t, "无法生成该视频", job.Reason)
	assert.ElementsMatch(t, []string{accountID(9006, 0), accountID(9006, 1), accountID(9006, 2)}, r.accountsOf("a"), "each key tried exactly once")
	r.idle(t)
}

func TestSchedulerStopsRetryingOnceAKeySucceeds(t *testing.T) {
	resetScheduler(t, 1, 5)
	r := newRecorder()
	slot := twoKeySlot(9007)
	final := trackJob(t, "a")

	scheduleVideo(r.job("a", slot))
	r.wait(t, "a")
	r.fail("a", &musesdk.Error{Kind: musesdk.KindQuota, Msg: "账号额度不足"})
	r.wait(t, "a")
	r.release("a")

	// The recorder returns no file, so the task ends with "muse returned no
	// video" instead of the first key's quota error.
	job := final()
	assert.NotEqual(t, "账号额度不足", job.Reason)
	r.idle(t)
	accounts := r.accountsOf("a")
	require.Len(t, accounts, 2)
	assert.NotEqual(t, accounts[0], accounts[1])
}

func TestSchedulerRetryWaitsForAnUntriedKey(t *testing.T) {
	resetScheduler(t, 1, 5)
	r := newRecorder()
	slot := twoKeySlot(9008)
	trackJob(t, "a")

	scheduleVideo(r.job("a", slot))
	r.wait(t, "a")
	scheduleVideo(r.job("b", slot))
	r.wait(t, "b")
	scheduleVideo(r.job("c", slot))
	r.idle(t)

	// a fails on its key while c waits: a takes b's key when it frees, and
	// c gets a's old key.
	r.fail("a", &musesdk.Error{Kind: musesdk.KindTransient, Msg: "等待回复中断"})
	r.wait(t, "c")
	r.release("b")
	r.wait(t, "a")
	assert.NotEqual(t, r.accountsOf("a")[0], r.accountsOf("a")[1])
	r.release("a")
	r.release("c")
}

func TestSchedulerDoesNotRetryInvalidInput(t *testing.T) {
	resetScheduler(t, 1, 5)
	r := newRecorder()
	final := trackJob(t, "a")

	scheduleVideo(r.job("a", twoKeySlot(9009)))
	r.wait(t, "a")
	r.fail("a", musesdk.BadRequest("at most 9 reference images are supported"))

	assert.Equal(t, model.TaskStatusFailure, final().Status)
	r.idle(t)
	assert.Len(t, r.accountsOf("a"), 1)
}
