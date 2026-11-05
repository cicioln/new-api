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
import { Clapperboard, Copy, Download, LoaderCircle, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { generateImages } from '../api'
import {
  deleteImage,
  loadImages,
  MAX_STORED_IMAGES,
  saveImages,
  type StoredImage,
} from '../lib/image-history'
import { newId, useStudioModels } from '../lib/options'
import {
  ChipGroup,
  CostLine,
  FieldLabel,
  ModelSelect,
  ReferencePicker,
  type ReferenceImage,
} from './form-parts'

const SIZES = ['1024x1024', '1024x1536', '1536x1024']
const COUNTS = [1, 2, 4]

type Pending = { id: string; prompt: string; startedAt: number }

export function ImagePanel(props: {
  group: string
  onToVideo: (src: string) => void
}) {
  const { t } = useTranslation()
  const models = useStudioModels('image', props.group)
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState(SIZES[0])
  const [count, setCount] = useState(1)
  const [references, setReferences] = useState<ReferenceImage[]>([])
  const [history, setHistory] = useState<StoredImage[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [preview, setPreview] = useState<StoredImage | null>(null)
  const historyRef = useRef(history)
  historyRef.current = history

  useEffect(() => {
    void loadImages().then(setHistory)
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
    const job: Pending = { id: newId(), prompt: text, startedAt: Date.now() }
    setPending((list) => [job, ...list])
    try {
      const urls = await generateImages({
        group: props.group,
        model: models.modelName,
        prompt: text,
        size,
        n: count,
        references: references.map((image) => image.file),
      })
      if (urls.length === 0) throw new Error(t('The model returned no images'))
      const created = urls.map((src, index) => ({
        id: newId(),
        src,
        prompt: text,
        model: models.modelName,
        createdAt: Date.now() + index,
      }))
      const existing = historyRef.current
      setHistory([...created, ...existing].slice(0, MAX_STORED_IMAGES))
      void saveImages(created, existing)
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Image generation failed')))
    } finally {
      setPending((list) => list.filter((item) => item.id !== job.id))
    }
  }

  const estimate = models.estimate(count)

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
        <ChipGroup
          label={t('Size')}
          options={SIZES.map((value) => ({ value, label: value.replace('x', '×') }))}
          value={size}
          onChange={setSize}
        />
        <ChipGroup
          label={t('Count')}
          options={COUNTS.map((value) => ({ value, label: String(value) }))}
          value={count}
          onChange={setCount}
        />
        <CostLine label={t('Estimated cost')} value={estimate} />
        <Button
          disabled={!prompt.trim() || !models.modelName}
          onClick={() => void submit()}
        >
          {t('Generate images')}
        </Button>
      </section>

      <section className='grid min-w-0 gap-3'>
        <div className='flex items-baseline justify-between gap-3'>
          <h2 className='text-sm font-medium'>{t('Results')}</h2>
          <span className='text-muted-foreground text-xs'>
            {t('Saved in this browser, latest {{count}}', {
              count: MAX_STORED_IMAGES,
            })}
          </span>
        </div>
        {pending.length === 0 && history.length === 0 ? (
          <div className='text-muted-foreground rounded-[10px] border border-dashed p-10 text-center text-sm'>
            {t('Generated images appear here.')}
          </div>
        ) : (
          <div className='grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3'>
            {pending.map((job) => (
              <PendingCard key={job.id} job={job} />
            ))}
            {history.map((image) => (
              <figure
                key={image.id}
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
                      onClick={() => {
                        setHistory((list) => list.filter((item) => item.id !== image.id))
                        void deleteImage(image.id)
                      }}
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
    </div>
  )
}

function PendingCard(props: { job: Pending }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.round((now - props.job.startedAt) / 1000))
  return (
    <div className='bg-card overflow-hidden rounded-lg border'>
      <div className='bg-muted text-muted-foreground flex aspect-square flex-col items-center justify-center gap-2 text-xs'>
        <LoaderCircle className='size-5 animate-spin' />
        {t('Generating · {{seconds}}s', { seconds })}
      </div>
      <p className='text-muted-foreground truncate p-2 text-xs'>{props.job.prompt}</p>
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
