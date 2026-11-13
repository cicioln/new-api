package muse

import (
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
// Like the jobs themselves, the queue lives in this process only: queued jobs
// are lost on restart and their tasks fail and are refunded.

var (
	accountConcurrency = common.GetEnvOrDefault("MUSE_ACCOUNT_CONCURRENCY", 1)
	channelQueueLimit  = common.GetEnvOrDefault("MUSE_QUEUE_LIMIT", 20)
)

// channelKey is one key of a Muse channel.
type channelKey struct {
	index int
	key   string
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
	start func(acc *musesdk.Account, release func())
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
	selected := []channelKey{{index: selectedIndex, key: selectedKey}}
	if !multiKey {
		return selected
	}
	channel, err := model.CacheGetChannel(channelID)
	if err != nil || channel == nil {
		return selected
	}
	statuses := channel.ChannelInfo.MultiKeyStatusList
	var keys []channelKey
	for i, key := range channel.GetKeys() {
		if status, ok := statuses[i]; ok && status != common.ChannelStatusEnabled {
			continue
		}
		if key != "" {
			keys = append(keys, channelKey{index: i, key: key})
		}
	}
	if len(keys) == 0 {
		return selected
	}
	return keys
}

// freeKeyLocked returns the least busy key of slot with a free slot.
// schedMu must be held.
func freeKeyLocked(slot videoSlot) (channelKey, bool) {
	best, bestActive, found := channelKey{}, 0, false
	for _, k := range slot.keys {
		n := activeVideos[accountID(slot.channelID, k.index)]
		if n >= max(accountConcurrency, 1) {
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
	if _, ok := freeKeyLocked(slot); ok && len(videoQueues[slot.channelID]) == 0 {
		return false
	}
	return len(videoQueues[slot.channelID]) >= max(channelQueueLimit, 0)
}

// scheduleVideo starts the job on a free key of its channel, or queues it.
func scheduleVideo(job *queuedVideo) {
	schedMu.Lock()
	// Jobs already waiting go first.
	if len(videoQueues[job.slot.channelID]) == 0 {
		if key, ok := freeKeyLocked(job.slot); ok {
			startLocked(job, key)
			schedMu.Unlock()
			return
		}
	}
	videoQueues[job.slot.channelID] = append(videoQueues[job.slot.channelID], job)
	schedMu.Unlock()
}

// startLocked reserves the key's slot and starts the job. schedMu must be
// held; the job itself runs on its own goroutine.
func startLocked(job *queuedVideo, key channelKey) {
	id := accountID(job.slot.channelID, key.index)
	activeVideos[id]++
	var once sync.Once
	release := func() { once.Do(func() { releaseVideo(job.slot.channelID, id) }) }
	go func() {
		acc, err := accountFor(job.slot.channelID, key.index, job.slot.multiKey, key.key, job.slot.proxy)
		if err != nil {
			release()
			finishVideoJob(job.jobID, nil, err)
			return
		}
		job.start(acc, release)
	}()
}

// releaseVideo frees one slot of the account and starts the jobs of its
// channel that can run now.
func releaseVideo(channelID int, id string) {
	schedMu.Lock()
	defer schedMu.Unlock()
	if activeVideos[id]--; activeVideos[id] <= 0 {
		delete(activeVideos, id)
	}
	queue := videoQueues[channelID]
	for len(queue) > 0 {
		key, ok := freeKeyLocked(queue[0].slot)
		if !ok {
			break
		}
		startLocked(queue[0], key)
		queue = queue[1:]
	}
	if len(queue) == 0 {
		delete(videoQueues, channelID)
	} else {
		videoQueues[channelID] = queue
	}
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
