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
import { Frame, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { TASK_STATUS } from '@/features/usage-logs/constants'

import { retryVideoTask, submitVideo } from '../api'
import { readAsDataUrl, useStudioModels } from '../lib/options'
import { RUNNING_VIDEO, useVideoTasks, VIDEO_TASKS_KEY } from '../lib/queries'
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
import { MediaViewer, useDeleteMedia, VideoTile, type MediaItem } from './media'
import {
  DurationTag,
  ElapsedSeconds,
  FailedTile,
  JobHeader,
  PendingTile,
  StudioHero,
  Tag,
} from './shared'

const RATIOS: SizePreset[] = [
  { value: '', label: 'Auto', w: 0, h: 0 },
  { value: '1280x720', label: '16:9', w: 16, h: 9 },
  { value: '720x1280', label: '9:16', w: 9, h: 16 },
  { value: '1024x1024', label: '1:1', w: 1, h: 1 },
]
const DURATIONS = [5, 10]
const MAX_SECONDS = 10

export function VideoPanel(props: {
  group: string
  references: ReferenceImage[]
  onReferencesChange: (images: ReferenceImage[]) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const models = useStudioModels('video', props.group)
  const tasks = useVideoTasks()
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState('')
  const [seconds, setSeconds] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [viewing, setViewing] = useState<MediaItem | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const remove = useDeleteMedia()

  const ratioLabel =
    RATIOS.find((item) => item.value === ratio)?.label ?? ratio.replace('x', '×')
  const canSubmit =
    !submitting &&
    prompt.trim() !== '' &&
    models.modelName !== '' &&
    isValidSize(ratio)

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const images = await Promise.all(
        props.references.map((image) => readAsDataUrl(image.file))
      )
      await submitVideo({
        group: props.group,
        model: models.modelName,
        prompt: prompt.trim(),
        size: ratio,
        seconds,
        images,
      })
      toast.success(t('Video task submitted'))
      setPrompt('')
      await queryClient.invalidateQueries({ queryKey: VIDEO_TASKS_KEY })
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Video submission failed')))
    } finally {
      setSubmitting(false)
    }
  }

  const retry = async (taskId: string) => {
    setRetrying(taskId)
    try {
      await retryVideoTask(taskId)
      toast.success(t('Video task submitted'))
      await queryClient.invalidateQueries({ queryKey: VIDEO_TASKS_KEY })
    } catch (error) {
      toast.error(getServerErrorMessage(error, t('Video submission failed')))
    } finally {
      setRetrying(null)
    }
  }

  const list = tasks.data ?? []

  return (
    <>
      <div className='min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-3 md:px-7'>
        {list.length === 0 ? (
          tasks.isLoading ? (
            <p className='text-muted-foreground py-24 text-center text-sm'>
              {t('Loading...')}
            </p>
          ) : (
            <StudioHero
              title={t('Video')}
              suggestions={[
                t('Hot air balloons rising out of a valley'),
                t('City time-lapse from day to night'),
                t('Waves on rocks in slow motion at sunset'),
              ]}
              onPick={setPrompt}
            />
          )
        ) : (
          <div className='mx-auto grid max-w-[900px] gap-6'>
            {list.map((task) => {
              const running = RUNNING_VIDEO.has(task.status)
              const failed = task.status === TASK_STATUS.FAILURE
              const done = task.status === TASK_STATUS.SUCCESS
              const progress = Number.parseInt(task.progress ?? '', 10)
              const aspect = '16 / 9'
              const text = (task.studio?.prompt || task.properties?.input || '').trim()
              const model = task.properties?.origin_model_name ?? ''
              return (
                <section key={task.task_id} className='grid min-w-0 gap-2.5'>
                  <JobHeader prompt={text || t('Video')}>
                    {running && (
                      <Tag tone='running'>
                        {Number.isFinite(progress) && progress > 0
                          ? `${t('Generating')} · ${progress}%`
                          : t('Queued')}
                      </Tag>
                    )}
                    {running && task.submit_time > 0 && (
                      <Tag tone='running'>
                        <ElapsedSeconds since={task.submit_time * 1000} />s
                      </Tag>
                    )}
                    {done && <Tag tone='success'>{t('Completed')}</Tag>}
                    {failed && <Tag tone='failed'>{t('Failed')}</Tag>}
                    {!running && (
                      <DurationTag start={task.submit_time} end={task.finish_time} />
                    )}
                    {model && <Tag>{model}</Tag>}
                    {task.studio?.size && <Tag>{task.studio.size.replace('x', '×')}</Tag>}
                    {task.studio?.seconds && (
                      <Tag>{t('{{count}} s', { count: Number(task.studio.seconds) })}</Tag>
                    )}
                    {task.action === 'image_to_video' && <Tag>{t('Image to video')}</Tag>}
                    {failed && task.quota > 0 && (
                      <Tag>{t('Refunded {{amount}}', { amount: formatQuotaWithCurrency(task.quota) })}</Tag>
                    )}
                  </JobHeader>
                  <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'>
                    {running && (
                      <div style={{ aspectRatio: aspect }}>
                        <PendingTile
                          label={
                            Number.isFinite(progress) && progress > 0
                              ? `${progress}%`
                              : t('Queued')
                          }
                          progress={Number.isFinite(progress) ? progress : 0}
                          className='size-full'
                        />
                      </div>
                    )}
                    {failed && (
                      <div style={{ aspectRatio: aspect }}>
                        <FailedTile
                          message={task.fail_reason || t('Generation failed')}
                          className='size-full'
                          actions={
                            <>
                              {task.studio && (
                                <Button
                                  size='xs'
                                  variant='outline'
                                  disabled={retrying !== null}
                                  onClick={() => void retry(task.task_id)}
                                >
                                  <RotateCcw className={retrying === task.task_id ? 'animate-spin' : undefined} />
                                  {t('Retry')}
                                </Button>
                              )}
                              <Button
                                size='xs'
                                variant='outline'
                                onClick={() =>
                                  remove.ask({
                                    kind: 'video',
                                    src: '',
                                    prompt: text,
                                    model,
                                    taskId: task.task_id,
                                  })
                                }
                              >
                                <Trash2 />
                                {t('Delete')}
                              </Button>
                            </>
                          }
                        />
                      </div>
                    )}
                    {done && (
                      <VideoTile
                        item={{
                          kind: 'video',
                          prompt: text,
                          model,
                          taskId: task.task_id,
                        }}
                        aspect={aspect}
                        onOpen={setViewing}
                      />
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <div className='shrink-0 px-3 pt-1 pb-4 md:px-7'>
        <Composer
          id='studio-video-prompt'
          prompt={prompt}
          onPromptChange={setPrompt}
          placeholder={t('Describe the video: camera, motion, pace and style. Add a reference image to animate it.')}
          references={props.references}
          onReferencesChange={props.onReferencesChange}
          estimate={models.estimate(1)}
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
                label={t('Aspect ratio')}
                icon={<Frame />}
                summary={`${ratio === '' ? t('Auto') : ratioLabel} · ${t('{{count}} s', { count: seconds })}`}
              >
                <PanelSection title={t('Aspect ratio')}>
                  <SizeOptions
                    presets={RATIOS.map((item) =>
                      item.value === ''
                        ? { ...item, label: props.references.length > 0 ? t('Match image') : t('Auto') }
                        : item
                    )}
                    value={ratio}
                    onChange={setRatio}
                  />
                </PanelSection>
                <PanelSection title={t('Duration')}>
                  <NumberOptions
                    presets={DURATIONS}
                    format={(value) => t('{{count}} s', { count: value })}
                    min={1}
                    max={MAX_SECONDS}
                    value={seconds}
                    onChange={setSeconds}
                  />
                </PanelSection>
                <p className='text-muted-foreground text-xs'>
                  {t('Some models treat ratio and duration as hints only. A single video is at most 10 seconds.')}
                </p>
              </ToolbarPopover>
            </>
          }
        />
      </div>

      <MediaViewer item={viewing} onClose={() => setViewing(null)} />
      {remove.dialog}
    </>
  )
}
