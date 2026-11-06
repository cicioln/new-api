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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clapperboard,
  Copy,
  Download,
  LoaderCircle,
  Play,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { deleteImageJob, deleteVideoTask, getVideoUrl } from '../api'
import { deleteImage, deleteSavedJob } from '../lib/image-history'
import { SAVED_IMAGES_KEY } from '../lib/local-copies'
import { IMAGE_JOBS_KEY, VIDEO_TASKS_KEY } from '../lib/queries'
import { IconAction } from './shared'

/** One image or video shown in the studio. */
export type MediaItem = {
  kind: 'image' | 'video'
  src: string
  prompt: string
  model: string
  /** Size or ratio and duration, for the viewer's caption. */
  meta?: string
  /** Server image job; deleting removes every image of the job. */
  jobId?: string
  jobImages?: number
  /** Image kept only in this browser. */
  localId?: string
  /** Job whose images remain only as copies in this browser. */
  savedJobId?: string
  /** Video task ID. */
  taskId?: string
}

/** Delete with confirmation; refreshes the list the item came from. */
export function useDeleteMedia(onLocalDeleted?: (id: string) => void) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<MediaItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const confirm = async () => {
    if (!target) return
    setDeleting(true)
    try {
      if (target.taskId) {
        await deleteVideoTask(target.taskId)
        await queryClient.invalidateQueries({ queryKey: VIDEO_TASKS_KEY })
      } else if (target.jobId) {
        await deleteImageJob(target.jobId)
        await deleteSavedJob(target.jobId)
        await queryClient.invalidateQueries({ queryKey: IMAGE_JOBS_KEY })
        await queryClient.invalidateQueries({ queryKey: SAVED_IMAGES_KEY })
      } else if (target.savedJobId) {
        await deleteSavedJob(target.savedJobId)
        await queryClient.invalidateQueries({ queryKey: SAVED_IMAGES_KEY })
      } else if (target.localId) {
        await deleteImage(target.localId)
        onLocalDeleted?.(target.localId)
      }
      toast.success(t('Deleted successfully'))
      setTarget(null)
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Delete failed')))
    } finally {
      setDeleting(false)
    }
  }

  const video = target?.kind === 'video'
  const many = (target?.jobImages ?? 0) > 1
  const dialog = (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !deleting) setTarget(null)
      }}
      title={video ? t('Delete video') : t('Delete image')}
      desc={
        video
          ? t(
              'The video is removed from this list and its file is deleted from the server. This action cannot be undone.'
            )
          : many
            ? t(
                'All {{count}} images from this generation will be deleted. This action cannot be undone.',
                { count: target?.jobImages }
              )
            : t('This action cannot be undone.')
      }
      confirmText={t('Delete')}
      destructive
      isLoading={deleting}
      handleConfirm={() => void confirm()}
    />
  )
  return { ask: setTarget, dialog }
}

export function ImageTile(props: {
  item: MediaItem
  aspect: string
  onOpen: (item: MediaItem) => void
  onToVideo?: (src: string) => void
  onLocalDeleted?: (id: string) => void
  className?: string
}) {
  const { t } = useTranslation()
  const remove = useDeleteMedia(props.onLocalDeleted)
  // The real pixel size, read from the loaded file.
  const [pixels, setPixels] = useState('')
  const item =
    pixels && !props.item.meta ? { ...props.item, meta: pixels } : props.item
  return (
    <div
      className={cn(
        'group bg-muted relative overflow-hidden rounded-xl border',
        props.className
      )}
      style={{ aspectRatio: props.aspect }}
    >
      <button
        type='button'
        aria-label={t('View image')}
        onClick={() => props.onOpen(item)}
        className='block size-full cursor-zoom-in'
      >
        <img
          src={props.item.src}
          alt={props.item.prompt}
          loading='lazy'
          className='size-full object-cover'
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth && naturalHeight)
              setPixels(`${naturalWidth}×${naturalHeight}`)
          }}
        />
      </button>
      {pixels && (
        <span className='pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-px font-mono text-[10.5px] text-white'>
          {pixels}
        </span>
      )}
      <div className='absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
        <IconAction
          overlay
          label={t('Download')}
          href={props.item.src}
          download
        >
          <Download />
        </IconAction>
        {props.onToVideo && (
          <IconAction
            overlay
            label={t('Make video')}
            onClick={() => props.onToVideo?.(props.item.src)}
          >
            <Clapperboard />
          </IconAction>
        )}
        <IconAction
          overlay
          label={t('Delete')}
          onClick={() => remove.ask(props.item)}
        >
          <Trash2 />
        </IconAction>
      </div>
      {remove.dialog}
    </div>
  )
}

/** Signed playback URL of a finished video task. */
export function useVideoUrl(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['studio-video-url', taskId],
    queryFn: () => getVideoUrl(taskId),
    enabled,
    staleTime: Infinity,
    retry: false,
  })
}

export function VideoTile(props: {
  item: Omit<MediaItem, 'src'> & { taskId: string }
  aspect: string
  duration?: string
  onOpen: (item: MediaItem) => void
  className?: string
}) {
  const { t } = useTranslation()
  const remove = useDeleteMedia()
  const video = useVideoUrl(props.item.taskId, true)
  const [expired, setExpired] = useState(false)
  useEffect(() => setExpired(false), [video.data])
  const src = video.data
  const item: MediaItem | null = src ? { ...props.item, src } : null

  return (
    <div
      className={cn(
        'group bg-muted relative overflow-hidden rounded-xl border',
        props.className
      )}
      style={{ aspectRatio: props.aspect }}
    >
      {item && !expired ? (
        <button
          type='button'
          aria-label={t('Play video')}
          onClick={() => props.onOpen(item)}
          className='relative block size-full cursor-pointer bg-black'
        >
          <video
            src={item.src}
            preload='metadata'
            muted
            playsInline
            className='pointer-events-none size-full object-contain'
            onError={() => setExpired(true)}
          />
          <span className='absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/30'>
            <span className='flex size-10 items-center justify-center rounded-full bg-black/60 text-white'>
              <Play className='size-4 fill-current' />
            </span>
          </span>
          {props.duration && (
            <span className='absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-px font-mono text-[11px] text-white'>
              {props.duration}
            </span>
          )}
        </button>
      ) : (
        <div className='text-muted-foreground flex size-full items-center justify-center text-xs'>
          {video.isLoading ? (
            <LoaderCircle className='size-5 animate-spin' />
          ) : (
            t('Expired')
          )}
        </div>
      )}
      <div className='absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
        {item && !expired && (
          <IconAction overlay label={t('Download')} href={item.src} download>
            <Download />
          </IconAction>
        )}
        <IconAction
          overlay
          label={t('Delete')}
          onClick={() => remove.ask({ ...props.item, src: '' })}
        >
          <Trash2 />
        </IconAction>
      </div>
      {remove.dialog}
    </div>
  )
}

/** Full-size preview of an image or playback of a video. */
export function MediaViewer(props: {
  item: MediaItem | null
  onClose: () => void
  onToVideo?: (src: string) => void
}) {
  const { t } = useTranslation()
  const item = props.item
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className='sm:max-w-4xl'>
        <DialogTitle className='pr-8 text-sm font-medium'>
          {item?.kind === 'video' ? t('Video preview') : t('Image preview')}
        </DialogTitle>
        {item && (
          <div className='grid gap-3'>
            {item.kind === 'video' ? (
              <video
                src={item.src}
                controls
                autoPlay
                className='mx-auto max-h-[70dvh] w-full rounded-lg bg-black object-contain'
              />
            ) : (
              <img
                src={item.src}
                alt={item.prompt}
                className='bg-muted mx-auto max-h-[70dvh] w-auto max-w-full rounded-lg object-contain'
              />
            )}
            <p className='text-muted-foreground text-xs break-words whitespace-pre-wrap'>
              {item.prompt}
            </p>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='text-muted-foreground font-mono text-xs'>
                {[item.model, item.meta].filter(Boolean).join(' · ')}
              </span>
              <div className='flex gap-1'>
                <IconAction label={t('Download')} href={item.src} download>
                  <Download />
                </IconAction>
                <IconAction
                  label={t('Copy prompt')}
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(item.prompt)
                      .then(() => toast.success(t('Copied')))
                      .catch(() => toast.error(t('Copy failed')))
                  }
                >
                  <Copy />
                </IconAction>
                {item.kind === 'image' && props.onToVideo && (
                  <IconAction
                    label={t('Make video')}
                    onClick={() => {
                      props.onToVideo?.(item.src)
                      props.onClose()
                    }}
                  >
                    <Clapperboard />
                  </IconAction>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
