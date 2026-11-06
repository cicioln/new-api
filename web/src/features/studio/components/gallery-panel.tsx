/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { TASK_STATUS } from '@/features/usage-logs/constants'

import { useImageJobs, useVideoTasks } from '../lib/queries'
import { ImageTile, MediaViewer, VideoTile, type MediaItem } from './media'
import { sizeAspect } from './shared'

type Filter = 'all' | 'image' | 'video'

type Entry =
  | { kind: 'image'; key: string; at: number; item: MediaItem; aspect: string }
  | {
      kind: 'video'
      key: string
      at: number
      taskId: string
      prompt: string
      model: string
    }

/** Every finished image and video, newest first. */
export function GalleryPanel(props: { onToVideo: (src: string) => void }) {
  const { t } = useTranslation()
  const images = useImageJobs()
  const videos = useVideoTasks()
  const [filter, setFilter] = useState<Filter>('all')
  const [viewing, setViewing] = useState<MediaItem | null>(null)

  const imageEntries: Entry[] = (images.data ?? [])
    .filter((job) => job.status === 'success')
    .flatMap((job) =>
      job.images.map((src) => ({
        kind: 'image' as const,
        key: src,
        at: job.finished_at ?? job.created_at,
        aspect: sizeAspect(job.size),
        item: {
          kind: 'image' as const,
          src,
          prompt: job.prompt,
          model: job.model,
          jobId: job.id,
          jobImages: job.images.length,
        },
      }))
    )
  const videoEntries: Entry[] = (videos.data ?? [])
    .filter((task) => task.status === TASK_STATUS.SUCCESS)
    .map((task) => ({
      kind: 'video' as const,
      key: task.task_id,
      at: task.finish_time ?? task.submit_time,
      taskId: task.task_id,
      prompt: (task.properties?.input ?? '').trim(),
      model: task.properties?.origin_model_name ?? '',
    }))
  const entries = [
    ...(filter === 'video' ? [] : imageEntries),
    ...(filter === 'image' ? [] : videoEntries),
  ].sort((a, b) => b.at - a.at)

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: t('All'), count: imageEntries.length + videoEntries.length },
    { value: 'image', label: t('Images'), count: imageEntries.length },
    { value: 'video', label: t('Videos'), count: videoEntries.length },
  ]

  return (
    <div className='min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7'>
      <div className='mx-auto grid max-w-[1000px] gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h2 className='text-lg font-semibold'>{t('Gallery')}</h2>
          <div role='radiogroup' className='bg-muted/50 flex rounded-lg border p-0.5'>
            {filters.map((item) => (
              <button
                key={item.value}
                type='button'
                role='radio'
                aria-checked={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs',
                  filter === item.value
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}{' '}
                <span className='font-mono tabular-nums'>{item.count}</span>
              </button>
            ))}
          </div>
        </div>
        {entries.length === 0 ? (
          <p className='text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm'>
            {images.isLoading || videos.isLoading
              ? t('Loading...')
              : t('Finished images and videos appear here.')}
          </p>
        ) : (
          <div className='columns-2 gap-2.5 sm:columns-3 lg:columns-4'>
            {entries.map((entry) =>
              entry.kind === 'image' ? (
                <ImageTile
                  key={entry.key}
                  item={entry.item}
                  aspect={entry.aspect}
                  onOpen={setViewing}
                  onToVideo={props.onToVideo}
                  className='mb-2.5 break-inside-avoid'
                />
              ) : (
                <VideoTile
                  key={entry.key}
                  item={{
                    kind: 'video',
                    prompt: entry.prompt,
                    model: entry.model,
                    taskId: entry.taskId,
                  }}
                  aspect='16 / 9'
                  onOpen={setViewing}
                  className='mb-2.5 break-inside-avoid'
                />
              )
            )}
          </div>
        )}
      </div>
      <MediaViewer
        item={viewing}
        onClose={() => setViewing(null)}
        onToVideo={props.onToVideo}
      />
    </div>
  )
}
