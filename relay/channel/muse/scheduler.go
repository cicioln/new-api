package muse

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	musesdk "github.com/CoolkHz/muse-protocol-go/muse"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// Video jobs are scheduled per Muse account (one channel key). Each account
// has one cloud VM, so it runs at most accountConcurrency video jobs at a
// time; a long video holds its slot for all of its segments and the join,
// because the segments live on that VM. A job goes to the least busy enabled
// key of its channel. When every key is busy it waits in the channel's queue
// and starts as soon as a key of that channel frees up. A channel whose queue
// is full rejects new jobs with 429, so the relay can try another channel.
//
// A safely retryable failure moves to the queue tail for another enabled key,
// bounded by the attempt limit, provider backoff and original task deadline.
//
// The owner node restores jobs and their queue state from durable checkpoints.

var (
	accountConcurrency = common.GetEnvOrDefault("MUSE_ACCOUNT_CONCURRENCY", 1)
	channelQueueLimit  = common.GetEnvOrDefault("MUSE_QUEUE_LIMIT", 20)
)

// channelKey is one key of a Muse channel.
type channelKey struct {
	index       int
	key         string
	concurrency int
}

// videoSlot is where a video job may run: its channel's enabled keys.
type videoSlot struct {
	channelID int
	multiKey  bool
	proxy     string
	keys      []channelKey
}

type queuedVideo struct {
	jobID string
	slot  videoSlot
	// tried holds the indexes of the keys the job has already failed on.
	tried   map[int]bool
	run     func(acc *musesdk.Account) ([]musesdk.Media, error)
	resumed bool
	readyAt time.Time
}

var (
	schedMu      sync.Mutex
	videoWorkers sync.WaitGroup
	activeVideos = map[string]int{}         // account ID -> running video jobs
	videoQueues  = map[int][]*queuedVideo{} // channel ID -> waiting jobs, oldest first
)

func accountID(channelID, keyIndex int) string {
	return fmt.Sprintf("channel-%d-%d", channelID, keyIndex)
}

// channelVideoKeys returns the enabled keys of a channel. It falls back to
// the key the relay selected when the channel cannot be read.
func channelVideoKeys(channelID, selectedIndex int, selectedKey string, multiKey bool) []channelKey {
	defaultConc := max(accountConcurrency, 1)
	channel, err := model.CacheGetChannel(channelID)
	if err == nil && channel != nil && channel.ChannelInfo.KeyConcurrency > 0 {
		defaultConc = channel.ChannelInfo.KeyConcurrency
	}
	selected := []channelKey{{index: selectedIndex, key: selectedKey, concurrency: defaultConc}}
	if !multiKey || err != nil || channel == nil {
		return selected
	}
	statuses := channel.ChannelInfo.MultiKeyStatusList
	concList := channel.ChannelInfo.MultiKeyConcurrencyList
	var keys []channelKey
	for i, key := range channel.GetKeys() {
		if status, ok := statuses[i]; ok && status != common.ChannelStatusEnabled {
			continue
		}
		if key != "" {
			conc := defaultConc
			if concList != nil {
				if c, ok := concList[i]; ok && c > 0 {
					conc = c
				}
			}
			keys = append(keys, channelKey{index: i, key: key, concurrency: conc})
		}
	}
	if len(keys) == 0 {
		return selected
	}
	return keys
}

// freeKeyLocked returns the least busy key of slot with a free slot, skipping
// the keys in tried. schedMu must be held.
func freeKeyLocked(slot videoSlot, tried map[int]bool) (channelKey, bool) {
	best, bestActive, found := channelKey{}, 0, false
	for _, k := range slot.keys {
		if tried[k.index] {
			continue
		}
		limit := max(accountConcurrency, 1)
		if k.concurrency > 0 {
			limit = k.concurrency
		}
		n := activeVideos[accountID(slot.channelID, k.index)]
		if n >= limit {
			continue
		}
		if !found || n < bestActive {
			best, bestActive, found = k, n, true
		}
	}
	return best, found
}

// videoQueueFull reports whether a new job on the channel would have to wait
// in a queue that is already full.
func videoQueueFull(slot videoSlot) bool {
	schedMu.Lock()
	defer schedMu.Unlock()
	if _, ok := freeKeyLocked(slot, nil); ok && len(videoQueues[slot.channelID]) == 0 {
		return false
	}
	return len(videoQueues[slot.channelID]) >= max(channelQueueLimit, 0)
}

// scheduleVideo starts the job on a free key of its channel, or queues it.
func scheduleVideo(job *queuedVideo) error {
	schedMu.Lock()
	defer schedMu.Unlock()
	if !job.resumed && len(videoQueues[job.slot.channelID]) >= max(channelQueueLimit, 0) {
		if _, free := freeKeyLocked(job.slot, job.tried); !free {
			return errors.New("Muse video queue is full")
		}
	}
	videoQueues[job.slot.channelID] = append(videoQueues[job.slot.channelID], job)
	dispatchLocked(job.slot.channelID)
	return nil
}

// dispatchLocked starts, in queue order, every waiting job of the channel
// that has a free key it has not failed on. schedMu must be held.
func dispatchLocked(channelID int) {
	queue := videoQueues[channelID]
	waiting := queue[:0]
	for _, job := range queue {
		if time.Now().Before(job.readyAt) {
			waiting = append(waiting, job)
			continue
		}
		if key, ok := freeKeyLocked(job.slot, job.tried); ok {
			startLocked(job, key)
			continue
		}
		waiting = append(waiting, job)
	}
	if len(waiting) == 0 {
		delete(videoQueues, channelID)
	} else {
		videoQueues[channelID] = waiting
	}
}

// startLocked reserves the key's slot and runs the job on its own goroutine.
// schedMu must be held.
func startLocked(job *queuedVideo, key channelKey) {
	activeVideos[accountID(job.slot.channelID, key.index)]++
	videoWorkers.Add(1)
	go func() {
		defer videoWorkers.Done()
		videoJobsMu.Lock()
		var prepareErr error
		if state := videoJobs[job.jobID]; state != nil && state.input != nil {
			if state.ctx.Err() != nil {
				prepareErr = state.ctx.Err()
			}
			if state.Status == model.TaskStatusQueued && time.Now().Unix()-state.StageStartedAt >= int64(videoQueueTimeout/time.Second) {
				prepareErr = context.DeadlineExceeded
			}
			if !state.finished.IsZero() {
				prepareErr = context.Canceled
			}
			state.keyIndex = key.index
			state.tried = job.tried
			if !job.resumed {
				state.Attempt++
			}
			if state.ExecutionDeadline == 0 {
				state.ExecutionDeadline = min(state.Deadline, time.Now().Add(videoExecutionBudget(state.input)).Unix())
			}
			if time.Now().Unix() >= state.ExecutionDeadline {
				prepareErr = context.DeadlineExceeded
			}
			if prepareErr == nil {
				prepareErr = persistVideoJobLocked(job.jobID, state)
			}
		}
		videoJobsMu.Unlock()
		acc, err := accountFor(job.slot.channelID, key.index, job.slot.multiKey, key.key, job.slot.proxy)
		if prepareErr != nil {
			err = prepareErr
		}
		var files []musesdk.Media
		if err == nil {
			files, err = job.run(acc)
		}
		finishAttempt(job, key, files, err)
	}()
}

// finishAttempt frees the key the job ran on. A job that failed there and
// still has untried keys goes back to the tail of the queue; any other job
// is finished.
func finishAttempt(job *queuedVideo, key channelKey, files []musesdk.Media, err error) {
	if err != nil {
		logVideoFailure(job.jobID, key.index, err)
	}
	channelID := job.slot.channelID
	schedMu.Lock()
	id := accountID(channelID, key.index)
	if activeVideos[id]--; activeVideos[id] <= 0 {
		delete(activeVideos, id)
	}
	// videoJobsMu is taken inside schedMu here and never the other way round.
	readyAt := time.Now().Add(musesdk.RetryAfterOf(err))
	retry := err != nil && tryNextKey(err) && job.markTried(key.index) && requeueVideoJob(job.jobID, job.tried, readyAt)
	if retry {
		job.resumed = false
		job.readyAt = readyAt
		videoQueues[channelID] = append(videoQueues[channelID], job)
	}
	dispatchLocked(channelID)
	schedMu.Unlock()
	if retry {
		removeMedia(files)
		common.SysLog(common.LogText("muse video %s: retrying on another key after key %d failed", job.jobID, key.index))
		return
	}
	finishVideoJob(job.jobID, files, err)
}

// requeueVideoJob preserves progress and the retry delay for another attempt.
// It reports false when the task was deleted meanwhile.
func requeueVideoJob(jobID string, tried map[int]bool, readyAt time.Time) bool {
	videoJobsMu.Lock()
	defer videoJobsMu.Unlock()
	job := videoJobs[jobID]
	if job == nil {
		return false
	}
	if job.ctx != nil && (job.ctx.Err() != nil || job.Attempt >= videoMaxAttempts ||
		(job.ExecutionDeadline > 0 && time.Now().Unix() >= job.ExecutionDeadline)) {
		return false
	}
	job.Status, job.Stage, job.StageStartedAt = model.TaskStatusQueued, "retrying", time.Now().Unix()
	job.tried = tried
	job.readyAt = readyAt
	// Retryable means the SDK knows this attempt did not start generation.
	job.state = nil
	if err := persistVideoJobLocked(jobID, job); err != nil {
		return false
	}
	return true
}

// markTried records that the job failed on the key and reports whether the
// channel has a key the job has not tried yet.
func (job *queuedVideo) markTried(index int) bool {
	if job.tried == nil {
		job.tried = map[int]bool{}
	}
	job.tried[index] = true
	for _, k := range job.slot.keys {
		if !job.tried[k.index] {
			return true
		}
	}
	return false
}

// tryNextKey reports whether another key might succeed where this one
// failed. Invalid input, a model refusal, and a crashed job fail the same
// way on every key.
func tryNextKey(err error) bool {
	var crashed *videoPanic
	return err != nil && musesdk.Retryable(err) && !errors.As(err, &crashed) &&
		!errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded)
}

// logVideoFailure logs a failed attempt with the model's own reply when it
// answered with text: the reason shown to the user is a fixed sentence.
func logVideoFailure(jobID string, keyIndex int, err error) {
	var reply *musesdk.ModelReply
	if !errors.As(err, &reply) {
		common.SysLog(common.LogText("muse video %s failed on key %d: %s", jobID, keyIndex, err.Error()))
		return
	}
	text := []rune(reply.Text)
	if len(text) > 300 {
		text = append(text[:300], '…')
	}
	common.SysLog(common.LogText("muse video %s failed on key %d (%s), model replied: %q", jobID, keyIndex, err.Error(), string(text)))
}

// dropQueuedVideo removes a job that has not started. It reports whether
// the job was waiting.
func dropQueuedVideo(jobID string) bool {
	schedMu.Lock()
	defer schedMu.Unlock()
	for channelID, queue := range videoQueues {
		for i, job := range queue {
			if job.jobID != jobID {
				continue
			}
			queue = append(queue[:i:i], queue[i+1:]...)
			if len(queue) == 0 {
				delete(videoQueues, channelID)
			} else {
				videoQueues[channelID] = queue
			}
			return true
		}
	}
	return false
}
