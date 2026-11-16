package muse

import (
	"errors"
	"fmt"
	"sync"

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
// A job that fails on a key runs again from the start on another key of its
// channel it has not tried, ahead of the jobs still waiting, until every key
// has failed it. Only then does the task fail.
//
// Like the jobs themselves, the queue lives in this process only: queued jobs
// are lost on restart and their tasks fail and are refunded.

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
	tried map[int]bool
	run   func(acc *musesdk.Account) ([]musesdk.Media, error)
}

var (
	schedMu      sync.Mutex
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
func scheduleVideo(job *queuedVideo) {
	schedMu.Lock()
	defer schedMu.Unlock()
	videoQueues[job.slot.channelID] = append(videoQueues[job.slot.channelID], job)
	dispatchLocked(job.slot.channelID)
}

// dispatchLocked starts, in queue order, every waiting job of the channel
// that has a free key it has not failed on. schedMu must be held.
func dispatchLocked(channelID int) {
	queue := videoQueues[channelID]
	waiting := queue[:0]
	for _, job := range queue {
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
	go func() {
		acc, err := accountFor(job.slot.channelID, key.index, job.slot.multiKey, key.key, job.slot.proxy)
		var files []musesdk.Media
		if err == nil {
			files, err = job.run(acc)
		}
		finishAttempt(job, key, files, err)
	}()
}

// finishAttempt frees the key the job ran on. A job that failed there and
// still has untried keys goes back to the front of the queue; any other job
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
	retry := err != nil && tryNextKey(err) && job.markTried(key.index) && requeueVideoJob(job.jobID)
	if retry {
		videoQueues[channelID] = append([]*queuedVideo{job}, videoQueues[channelID]...)
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

// requeueVideoJob shows a job that will run again as queued from the start.
// It reports false when the task was deleted meanwhile.
func requeueVideoJob(jobID string) bool {
	videoJobsMu.Lock()
	defer videoJobsMu.Unlock()
	job := videoJobs[jobID]
	if job == nil {
		return false
	}
	job.Status, job.Progress = model.TaskStatusQueued, 0
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
// failed. Invalid input and a crashed job fail the same way on every key.
func tryNextKey(err error) bool {
	var crashed *videoPanic
	return musesdk.KindOf(err) != musesdk.KindBadRequest && !errors.As(err, &crashed)
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
