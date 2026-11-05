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
import { Download, LoaderCircle, Play, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { TASK_STATUS } from '@/features/usage-logs/constants'
import type { TaskLog } from '@/features/usage-logs/types'

import { deleteVideoTask, getVideoTasks, getVideoUrl, submitVideo } from '../api'
import { newId, readAsDataUrl, useStudioModels } from '../lib/options'
import {
  CostLine,
  FieldLabel,
  ModelSelect,
  NumberPicker,
  ReferencePicker,
  SizePicker,
  type ReferenceImage,
} from './form-parts'
import { IconAction } from './image-panel'

export type VideoMode = 'text' | 'image'

const RATIOS = [
  { value: '', label: 'Auto' },
  { value: '1280x720', label: '16:9' },
  { value: '720x1280', label: '9:16' },
  { value: '1024x1024', label: '1:1' },
]
const DURATIONS = [5, 10]
const MAX_SECONDS = 10
const POLL_MS = 5000

const RUNNING = new Set<string>([
  TASK_STATUS.NOT_START,
  TASK_STATUS.SUBMITTED,
  TASK_STATUS.QUEUED,
  TASK_STATUS.IN_PROGRESS,
])

export function VideoPanel(props: {
  group: string
  mode: VideoMode
  references: ReferenceImage[]
  onReferencesChange: (images: ReferenceImage[]) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const models = useStudioModels('video', props.group)
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState('')
  const [seconds, setSeconds] = useState(5)
  const [submitting, setSubmitting] = useState(false)

  const tasks = useQuery({
    queryKey: ['studio-video-tasks'],
    queryFn: getVideoTasks,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((task) => RUNNING.has(task.status))
        ? POLL_MS
        : false,
  })

  const needsImage = props.mode === 'image'
  const canSubmit =
    !submitting &&
    prompt.trim() !== '' &&
    models.modelName !== '' &&
    (!needsImage || props.references.length > 0)

  const submit = async () => {
    setSubmitting(true)
    try {
      const images = needsImage
        ? await Promise.all(props.references.map((image) => readAsDataUrl(image.file)))
        : []
      await submitVideo({
        group: props.group,
        model: models.modelName,
        prompt: prompt.trim(),
        size: ratio,
        seconds,
        images,
      })
      toast.success(t('Video task submitted'))
      await queryClient.invalidateQueries({ queryKey: ['studio-video-tasks'] })
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Video submission failed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[320px_minmax(0,1fr)]'>
      <section className='bg-card grid gap-3.5 rounded-[10px] border p-[18px]'>
        <ModelSelect
          id={`studio-video-model-${props.mode}`}
          models={models.models}
          value={models.modelName}
          onChange={models.setModelName}
        />
        {needsImage && (
          <ReferencePicker
            label={t('First frame / reference images')}
            hint={t('Required. Upload, paste, or send an image from the image tab. Up to 4, 10 MB each.')}
            images={props.references}
            onAdd={(files) =>
              props.onReferencesChange([
                ...props.references,
                ...files.map((file) => ({
                  id: newId(),
                  file,
                  url: URL.createObjectURL(file),
                })),
              ])
            }
            onRemove={(id) => {
              const removed = props.references.find((image) => image.id === id)
              if (removed) URL.revokeObjectURL(removed.url)
              props.onReferencesChange(
                props.references.filter((image) => image.id !== id)
              )
            }}
            disabled={submitting}
          />
        )}
        <div>
          <FieldLabel htmlFor={`studio-video-prompt-${props.mode}`}>
            {needsImage ? t('Motion description') : t('Prompt')}
          </FieldLabel>
          <Textarea
            id={`studio-video-prompt-${props.mode}`}
            className='min-h-28'
            value={prompt}
            placeholder={
              needsImage
                ? t('Describe how the image should move')
                : t('Describe the video you want')
            }
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        <SizePicker
          label={t('Aspect ratio')}
          presets={RATIOS.map((option) => ({
            value: option.value,
            label: option.value ? option.label : t(needsImage ? 'Match image' : 'Auto'),
          }))}
          value={ratio}
          onChange={setRatio}
        />
        <NumberPicker
          label={t('Duration')}
          presets={DURATIONS}
          format={(value) => t('{{count}} s', { count: value })}
          min={1}
          max={MAX_SECONDS}
          value={seconds}
          onChange={setSeconds}
        />
        <p className='text-muted-foreground -mt-1.5 text-xs'>
          {t('Some models treat ratio and duration as hints only. A single video is at most 10 seconds.')}
        </p>
        <CostLine label={t('Estimated cost')} value={models.estimate(1)} />
        <Button disabled={!canSubmit} onClick={() => void submit()}>
          {submitting && <LoaderCircle className='animate-spin' />}
          {t('Submit video task')}
        </Button>
      </section>

      <section className='grid min-w-0 gap-3'>
        <div className='flex items-baseline justify-between gap-3'>
          <h2 className='text-sm font-medium'>{t('My video tasks')}</h2>
          <span className='text-muted-foreground text-xs'>
            {t('Text-to-video and image-to-video share this list')}
          </span>
        </div>
        {(tasks.data ?? []).length === 0 ? (
          <div className='text-muted-foreground rounded-[10px] border border-dashed p-10 text-center text-sm'>
            {tasks.isLoading ? t('Loading...') : t('Submitted video tasks appear here.')}
          </div>
        ) : (
          <div className='grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3'>
            {(tasks.data ?? []).map((task) => (
              <VideoTaskCard key={task.task_id} task={task} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function VideoTaskCard(props: { task: TaskLog }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const task = props.task
  const [playing, setPlaying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const done = task.status === TASK_STATUS.SUCCESS
  const failed = task.status === TASK_STATUS.FAILURE
  const running = RUNNING.has(task.status)
  const video = useQuery({
    queryKey: ['studio-video-url', task.task_id],
    queryFn: () => getVideoUrl(task.task_id),
    enabled: done,
    staleTime: Infinity,
    retry: false,
  })
  const [expired, setExpired] = useState(false)
  useEffect(() => setExpired(false), [video.data])

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteVideoTask(task.task_id)
      toast.success(t('Deleted successfully'))
      setConfirming(false)
      await queryClient.invalidateQueries({ queryKey: ['studio-video-tasks'] })
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Delete failed')))
    } finally {
      setDeleting(false)
    }
  }

  const progress = Number.parseInt(task.progress ?? '', 10)
  const prompt = (task.properties?.input ?? '').trim()

  return (
    <article className='bg-card overflow-hidden rounded-lg border'>
      <div className='bg-muted text-muted-foreground relative flex aspect-video items-center justify-center text-xs'>
        {done && video.data && !expired ? (
          <button
            type='button'
            aria-label={t('Play video')}
            onClick={() => setPlaying(true)}
            className='group relative size-full cursor-pointer bg-black'
          >
            <video
              src={video.data}
              preload='metadata'
              muted
              playsInline
              className='pointer-events-none size-full object-contain'
              onError={() => setExpired(true)}
            />
            <span className='absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/30'>
              <span className='flex size-11 items-center justify-center rounded-full bg-black/60 text-white'>
                <Play className='size-5 fill-current' />
              </span>
            </span>
          </button>
        ) : done ? (
          video.isLoading ? (
            <LoaderCircle className='size-5 animate-spin' />
          ) : (
            t('Expired')
          )
        ) : running ? (
          <div className='flex flex-col items-center gap-2'>
            <LoaderCircle className='size-5 animate-spin' />
            {Number.isFinite(progress) && progress > 0
              ? `${progress}%`
              : t('Queued')}
          </div>
        ) : (
          t('Failed')
        )}
      </div>
      <div className='grid gap-1.5 p-2.5 text-xs'>
        <div className='flex items-center justify-between gap-2'>
          <StatusBadge status={task.status} />
          <span className='text-muted-foreground font-mono'>
            {task.properties?.origin_model_name}
          </span>
        </div>
        {running && Number.isFinite(progress) && (
          <div className='bg-muted h-1 overflow-hidden rounded-full'>
            <div
              className='bg-primary h-full transition-[width]'
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
        {prompt && (
          <p className='text-muted-foreground truncate' title={prompt}>
            {prompt}
          </p>
        )}
        {failed && (
          <p className='text-destructive line-clamp-2' title={task.fail_reason}>
            {task.fail_reason || t('Generation failed')}
            {task.quota > 0 &&
              ` · ${t('Refunded {{amount}}', { amount: formatQuotaWithCurrency(task.quota) })}`}
          </p>
        )}
        {!running && (
          <div className='flex gap-1'>
            {done && video.data && !expired && (
              <IconAction label={t('Download')} href={video.data} download>
                <Download />
              </IconAction>
            )}
            <IconAction label={t('Delete')} onClick={() => setConfirming(true)}>
              <Trash2 />
            </IconAction>
          </div>
        )}
      </div>

      <Dialog open={playing} onOpenChange={setPlaying}>
        <DialogContent className='sm:max-w-4xl'>
          <DialogTitle className='pr-8 text-sm font-medium'>
            {t('Video preview')}
          </DialogTitle>
          {playing && video.data && (
            <div className='grid gap-3'>
              <video
                src={video.data}
                controls
                autoPlay
                className='mx-auto max-h-[70dvh] w-full rounded-lg bg-black object-contain'
              />
              {prompt && (
                <p className='text-muted-foreground text-xs break-words whitespace-pre-wrap'>
                  {prompt}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!deleting) setConfirming(open)
        }}
        title={t('Delete video')}
        desc={t('The video is removed from this list and its file is deleted from the server. This action cannot be undone.')}
        confirmText={t('Delete')}
        destructive
        isLoading={deleting}
        handleConfirm={() => void remove()}
      />
    </article>
  )
}

function StatusBadge(props: { status: string }) {
  const { t } = useTranslation()
  if (props.status === TASK_STATUS.SUCCESS) {
    return <Badge variant='secondary'>{t('Completed')}</Badge>
  }
  if (props.status === TASK_STATUS.FAILURE) {
    return <Badge variant='destructive'>{t('Failed')}</Badge>
  }
  if (props.status === TASK_STATUS.IN_PROGRESS) {
    return <Badge variant='outline'>{t('Generating')}</Badge>
  }
  return <Badge variant='warning'>{t('Queued')}</Badge>
}
