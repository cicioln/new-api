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
  Trash2,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { deleteImageJob, getImageJobs, submitImages } from '../api'
import { deleteImage, loadImages, type StoredImage } from '../lib/image-history'
import { newId, useStudioModels } from '../lib/options'
import {
  CostLine,
  FieldLabel,
  ModelSelect,
  NumberPicker,
  ReferencePicker,
  SizePicker,
  type ReferenceImage,
} from './form-parts'

const SIZES = ['1024x1024', '1024x1536', '1536x1024']
const COUNTS = [1, 2, 4]
const MAX_COUNT = 10
const POLL_MS = 3000
const JOBS_KEY = ['studio-image-jobs']

/** One card in the results grid. */
type ResultImage = {
  key: string
  src: string
  prompt: string
  model: string
  /** Server job ID; absent for images kept only in this browser. */
  jobId?: string
  localId?: string
}

export function ImagePanel(props: {
  group: string
  onToVideo: (src: string) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const models = useStudioModels('image', props.group)
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState(SIZES[0])
  const [count, setCount] = useState(1)
  const [references, setReferences] = useState<ReferenceImage[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [legacy, setLegacy] = useState<StoredImage[]>([])
  const [preview, setPreview] = useState<ResultImage | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ResultImage | null>(null)
  const [deleting, setDeleting] = useState(false)

  const jobs = useQuery({
    queryKey: JOBS_KEY,
    queryFn: getImageJobs,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((job) => job.status === 'running')
        ? POLL_MS
        : false,
  })

  // Images generated before server storage existed stay in this browser.
  useEffect(() => {
    void loadImages().then(setLegacy)
  }, [])

  useEffect(
    () => () => references.forEach((image) => URL.revokeObjectURL(image.url)),
    // Revoke on unmount only; removals revoke their own URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const submit = async () => {
    const text = prompt.trim()
    if (!text || !models.modelName) return
    setSubmitting(true)
    try {
      await submitImages({
        group: props.group,
        model: models.modelName,
        prompt: text,
        size,
        n: count,
        references: references.map((image) => image.file),
      })
      toast.success(t('Image task submitted'))
      await queryClient.invalidateQueries({ queryKey: JOBS_KEY })
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Image generation failed')))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    const target = pendingDelete
    if (!target) return
    setDeleting(true)
    try {
      if (target.jobId) {
        await deleteImageJob(target.jobId)
        await queryClient.invalidateQueries({ queryKey: JOBS_KEY })
      } else if (target.localId) {
        await deleteImage(target.localId)
        setLegacy((list) => list.filter((item) => item.id !== target.localId))
      }
      toast.success(t('Deleted successfully'))
      setPendingDelete(null)
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Delete failed')))
    } finally {
      setDeleting(false)
    }
  }

  const jobList = jobs.data ?? []
  const running = jobList.filter((job) => job.status === 'running')
  const failed = jobList.filter((job) => job.status === 'failed')
  const results: ResultImage[] = [
    ...jobList
      .filter((job) => job.status === 'success')
      .flatMap((job) =>
        job.images.map((src, index) => ({
          key: `${job.id}-${index}`,
          src,
          prompt: job.prompt,
          model: job.model,
          jobId: job.id,
        }))
      ),
    ...legacy.map((image) => ({
      key: image.id,
      src: image.src,
      prompt: image.prompt,
      model: image.model,
      localId: image.id,
    })),
  ]
  const deletingJobImages = pendingDelete?.jobId
    ? (jobList.find((job) => job.id === pendingDelete.jobId)?.images.length ?? 0)
    : 0

  return (
    <div className='grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[320px_minmax(0,1fr)]'>
      <section className='bg-card grid gap-3.5 rounded-[10px] border p-[18px]'>
        <ModelSelect
          id='studio-image-model'
          models={models.models}
          value={models.modelName}
          onChange={models.setModelName}
        />
        <div>
          <FieldLabel htmlFor='studio-image-prompt'>{t('Prompt')}</FieldLabel>
          <Textarea
            id='studio-image-prompt'
            className='min-h-28'
            value={prompt}
            placeholder={t('Describe the image you want')}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        <ReferencePicker
          label={t('Reference images (optional)')}
          hint={t('With reference images the model edits them. Up to 4, 10 MB each.')}
          images={references}
          onAdd={(files) =>
            setReferences((list) => [
              ...list,
              ...files.map((file) => ({
                id: newId(),
                file,
                url: URL.createObjectURL(file),
              })),
            ])
          }
          onRemove={(id) =>
            setReferences((list) => {
              const removed = list.find((image) => image.id === id)
              if (removed) URL.revokeObjectURL(removed.url)
              return list.filter((image) => image.id !== id)
            })
          }
        />
        <SizePicker
          label={t('Size')}
          presets={SIZES.map((value) => ({ value, label: value.replace('x', '×') }))}
          value={size}
          onChange={setSize}
        />
        <NumberPicker
          label={t('Count')}
          presets={COUNTS}
          format={String}
          min={1}
          max={MAX_COUNT}
          value={count}
          onChange={setCount}
        />
        <CostLine label={t('Estimated cost')} value={models.estimate(count)} />
        <Button
          disabled={submitting || !prompt.trim() || !models.modelName}
          onClick={() => void submit()}
        >
          {submitting && <LoaderCircle className='animate-spin' />}
          {t('Generate images')}
        </Button>
      </section>

      <section className='grid min-w-0 gap-3'>
        <h2 className='text-sm font-medium'>{t('Results')}</h2>
        {running.length === 0 && failed.length === 0 && results.length === 0 ? (
          <div className='text-muted-foreground rounded-[10px] border border-dashed p-10 text-center text-sm'>
            {jobs.isLoading ? t('Loading...') : t('Generated images appear here.')}
          </div>
        ) : (
          <div className='grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3'>
            {running.map((job) => (
              <PendingCard
                key={job.id}
                prompt={job.prompt}
                startedAt={job.created_at * 1000}
              />
            ))}
            {failed.map((job) => (
              <div key={job.id} className='bg-card overflow-hidden rounded-lg border'>
                <div className='bg-muted text-destructive flex aspect-square items-center justify-center p-3 text-center text-xs'>
                  <span className='line-clamp-4' title={job.error}>
                    {job.error ? t(job.error) : t('Generation failed')}
                  </span>
                </div>
                <div className='flex items-center gap-1 p-2 text-xs'>
                  <p className='text-muted-foreground min-w-0 flex-1 truncate' title={job.prompt}>
                    {job.prompt}
                  </p>
                  <IconAction
                    label={t('Delete')}
                    onClick={() =>
                      setPendingDelete({
                        key: job.id,
                        src: '',
                        prompt: job.prompt,
                        model: job.model,
                        jobId: job.id,
                      })
                    }
                  >
                    <Trash2 />
                  </IconAction>
                </div>
              </div>
            ))}
            {results.map((image) => (
              <figure
                key={image.key}
                className='bg-card overflow-hidden rounded-lg border'
              >
                <button
                  type='button'
                  aria-label={t('View image')}
                  onClick={() => setPreview(image)}
                  className='block w-full cursor-zoom-in'
                >
                  <img
                    src={image.src}
                    alt={image.prompt}
                    loading='lazy'
                    className='aspect-square w-full object-cover'
                  />
                </button>
                <figcaption className='grid gap-1.5 p-2 text-xs'>
                  <p className='text-muted-foreground truncate' title={image.prompt}>
                    {image.prompt}
                  </p>
                  <div className='flex gap-1'>
                    <IconAction label={t('Download')} href={image.src} download>
                      <Download />
                    </IconAction>
                    <IconAction
                      label={t('Copy prompt')}
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(image.prompt)
                          .then(() => toast.success(t('Copied')))
                          .catch(() => toast.error(t('Copy failed')))
                      }}
                    >
                      <Copy />
                    </IconAction>
                    <IconAction
                      label={t('Make video')}
                      onClick={() => props.onToVideo(image.src)}
                    >
                      <Clapperboard />
                    </IconAction>
                    <IconAction
                      label={t('Delete')}
                      onClick={() => setPendingDelete(image)}
                    >
                      <Trash2 />
                    </IconAction>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      >
        <DialogContent className='sm:max-w-4xl'>
          <DialogTitle className='pr-8 text-sm font-medium'>
            {t('Image preview')}
          </DialogTitle>
          {preview && (
            <div className='grid gap-3'>
              <img
                src={preview.src}
                alt={preview.prompt}
                className='bg-muted mx-auto max-h-[70dvh] w-auto max-w-full rounded-lg object-contain'
              />
              <p className='text-muted-foreground text-xs break-words whitespace-pre-wrap'>
                {preview.prompt}
              </p>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-muted-foreground font-mono text-xs'>
                  {preview.model}
                </span>
                <div className='flex gap-1'>
                  <IconAction label={t('Download')} href={preview.src} download>
                    <Download />
                  </IconAction>
                  <IconAction
                    label={t('Make video')}
                    onClick={() => {
                      props.onToVideo(preview.src)
                      setPreview(null)
                    }}
                  >
                    <Clapperboard />
                  </IconAction>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
        title={t('Delete image')}
        desc={
          deletingJobImages > 1
            ? t(
                'All {{count}} images from this generation will be deleted. This action cannot be undone.',
                { count: deletingJobImages }
              )
            : t('This action cannot be undone.')
        }
        confirmText={t('Delete')}
        destructive
        isLoading={deleting}
        handleConfirm={() => void confirmDelete()}
      />
    </div>
  )
}

function PendingCard(props: { prompt: string; startedAt: number }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.round((now - props.startedAt) / 1000))
  return (
    <div className='bg-card overflow-hidden rounded-lg border'>
      <div className='bg-muted text-muted-foreground flex aspect-square flex-col items-center justify-center gap-2 text-xs'>
        <LoaderCircle className='size-5 animate-spin' />
        {t('Generating · {{seconds}}s', { seconds })}
      </div>
      <p className='text-muted-foreground truncate p-2 text-xs'>{props.prompt}</p>
    </div>
  )
}

export function IconAction(props: {
  label: string
  children: ReactNode
  onClick?: () => void
  href?: string
  download?: boolean
}) {
  const className =
    'text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md [&_svg]:size-3.5'
  if (props.href) {
    return (
      <a
        href={props.href}
        download={props.download ? `studio-${Date.now()}` : undefined}
        target={props.download ? undefined : '_blank'}
        rel='noreferrer'
        aria-label={props.label}
        title={props.label}
        className={className}
      >
        {props.children}
      </a>
    )
  }
  return (
    <button
      type='button'
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className={className}
    >
      {props.children}
    </button>
  )
}
