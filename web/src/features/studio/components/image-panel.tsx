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
import { useQueryClient } from '@tanstack/react-query'
import { Copy, Frame, Layers } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getServerErrorMessage } from '@/lib/server-error-message'

import { submitImages } from '../api'
import { loadImages, type StoredImage } from '../lib/image-history'
import { useStudioModels } from '../lib/options'
import { IMAGE_JOBS_KEY, useImageJobs } from '../lib/queries'
import { Composer } from './composer'
import {
  isValidSize,
  ModelPicker,
  NumberOptions,
  PanelSection,
  SizeOptions,
  ToolbarPopover,
  type ReferenceImage,
  type SizePreset,
} from './form-parts'
import { ImageTile, MediaViewer, type MediaItem } from './media'
import {
  ElapsedSeconds,
  FailedTile,
  JobHeader,
  PendingTile,
  sizeAspect,
  StudioHero,
  Tag,
  DurationTag,
} from './shared'

const SIZES: SizePreset[] = [
  { value: '1024x1024', label: '1:1', w: 1, h: 1 },
  { value: '1024x1536', label: '2:3', w: 2, h: 3 },
  { value: '1536x1024', label: '3:2', w: 3, h: 2 },
]
const COUNTS = [1, 2, 4]
const MAX_COUNT = 10

function sizeLabel(size: string) {
  const preset = SIZES.find((item) => item.value === size)
  const text = size.replace('x', '×')
  return preset ? `${preset.label} · ${text}` : text
}

export function ImagePanel(props: {
  group: string
  references: ReferenceImage[]
  onReferencesChange: (images: ReferenceImage[]) => void
  onToVideo: (src: string) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const models = useStudioModels('image', props.group)
  const jobs = useImageJobs()
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState(SIZES[0].value)
  const [count, setCount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [legacy, setLegacy] = useState<StoredImage[]>([])
  const [viewing, setViewing] = useState<MediaItem | null>(null)

  // Images generated before server storage existed stay in this browser.
  useEffect(() => {
    void loadImages().then(setLegacy)
  }, [])

  const canSubmit =
    !submitting &&
    prompt.trim() !== '' &&
    models.modelName !== '' &&
    isValidSize(size)

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await submitImages({
        group: props.group,
        model: models.modelName,
        prompt: prompt.trim(),
        size,
        n: count,
        references: props.references.map((image) => image.file),
      })
      toast.success(t('Image task submitted'))
      setPrompt('')
      await queryClient.invalidateQueries({ queryKey: IMAGE_JOBS_KEY })
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Image generation failed')))
    } finally {
      setSubmitting(false)
    }
  }

  const jobList = jobs.data ?? []
  const empty = jobList.length === 0 && legacy.length === 0

  return (
    <>
      <div className='min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-3 md:px-7'>
        {empty ? (
          jobs.isLoading ? (
            <p className='text-muted-foreground py-24 text-center text-sm'>
              {t('Loading...')}
            </p>
          ) : (
            <StudioHero
              title={t('Image')}
              suggestions={[
                t('A watercolor cat by the window'),
                t('Product shot on a white background'),
                t('Cyberpunk city at night'),
                t('Minimal poster design'),
              ]}
              onPick={setPrompt}
            />
          )
        ) : (
          <div className='mx-auto grid max-w-[900px] gap-6'>
            {jobList.map((job) => {
              const aspect = sizeAspect(job.size)
              const tiles = Math.max(job.count ?? 1, 1)
              return (
                <section key={job.id} className='grid min-w-0 gap-2.5'>
                  <JobHeader prompt={job.prompt}>
                    {job.status === 'running' && (
                      <Tag tone='running'>
                        {t('Generating')} · <ElapsedSeconds since={job.created_at * 1000} />s
                      </Tag>
                    )}
                    {job.status === 'success' && <Tag tone='success'>{t('Completed')}</Tag>}
                    {job.status === 'failed' && <Tag tone='failed'>{t('Failed')}</Tag>}
                    {job.status !== 'running' && (
                      <DurationTag start={job.created_at} end={job.finished_at} />
                    )}
                    <Tag>{job.model}</Tag>
                    {job.size && <Tag>{job.size.replace('x', '×')}</Tag>}
                    <button
                      type='button'
                      aria-label={t('Copy prompt')}
                      title={t('Copy prompt')}
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(job.prompt)
                          .then(() => toast.success(t('Copied')))
                          .catch(() => toast.error(t('Copy failed')))
                      }
                      className='text-muted-foreground hover:text-foreground px-1'
                    >
                      <Copy className='size-3.5' />
                    </button>
                  </JobHeader>
                  <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]'>
                    {job.status === 'running' &&
                      Array.from({ length: Math.min(tiles, MAX_COUNT) }, (_, index) => (
                        <div key={index} style={{ aspectRatio: aspect }}>
                          <PendingTile label={t('Generating')} className='size-full' />
                        </div>
                      ))}
                    {job.status === 'failed' && (
                      <div style={{ aspectRatio: aspect }}>
                        <FailedTile
                          message={job.error ? t(job.error) : t('Generation failed')}
                          className='size-full'
                        />
                      </div>
                    )}
                    {job.status === 'success' &&
                      job.images.map((src) => (
                        <ImageTile
                          key={src}
                          item={{
                            kind: 'image',
                            src,
                            prompt: job.prompt,
                            model: job.model,
                            meta: job.size?.replace('x', '×'),
                            jobId: job.id,
                            jobImages: job.images.length,
                          }}
                          aspect={aspect}
                          onOpen={setViewing}
                          onToVideo={props.onToVideo}
                        />
                      ))}
                  </div>
                </section>
              )
            })}
            {legacy.length > 0 && (
              <section className='grid gap-2.5'>
                <JobHeader prompt={t('Earlier images')}>
                  <Tag>{legacy.length}</Tag>
                </JobHeader>
                <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]'>
                  {legacy.map((image) => (
                    <ImageTile
                      key={image.id}
                      item={{
                        kind: 'image',
                        src: image.src,
                        prompt: image.prompt,
                        model: image.model,
                        localId: image.id,
                      }}
                      aspect='1 / 1'
                      onOpen={setViewing}
                      onToVideo={props.onToVideo}
                      onLocalDeleted={(id) =>
                        setLegacy((list) => list.filter((item) => item.id !== id))
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <div className='shrink-0 px-3 pt-1 pb-4 md:px-7'>
        <Composer
          id='studio-image-prompt'
          prompt={prompt}
          onPromptChange={setPrompt}
          placeholder={t('Describe the image: style, composition, subject. Add a reference image to edit it.')}
          references={props.references}
          onReferencesChange={props.onReferencesChange}
          estimate={models.estimate(count)}
          canSubmit={canSubmit}
          submitting={submitting}
          onSubmit={() => void submit()}
          toolbar={
            <>
              <ModelPicker
                models={models.models}
                value={models.modelName}
                onChange={models.setModelName}
              />
              <ToolbarPopover
                label={t('Size')}
                icon={<Frame />}
                summary={sizeLabel(size)}
              >
                <PanelSection title={t('Size')}>
                  <SizeOptions presets={SIZES} value={size} onChange={setSize} />
                </PanelSection>
              </ToolbarPopover>
              <ToolbarPopover
                label={t('Count')}
                icon={<Layers />}
                summary={t('{{count}} images', { count })}
              >
                <PanelSection title={t('Count')}>
                  <NumberOptions
                    presets={COUNTS}
                    format={String}
                    min={1}
                    max={MAX_COUNT}
                    value={count}
                    onChange={setCount}
                  />
                </PanelSection>
              </ToolbarPopover>
            </>
          }
        />
      </div>

      <MediaViewer
        item={viewing}
        onClose={() => setViewing(null)}
        onToVideo={props.onToVideo}
      />
    </>
  )
}
