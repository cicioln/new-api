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
import { Clock, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { getSaveLocally, setSaveLocally } from '../lib/image-history'
import { SAVED_IMAGES_KEY } from '../lib/local-copies'
import { useStudioSettings } from '../lib/queries'

export function IconAction(props: {
  label: string
  children: ReactNode
  onClick?: () => void
  href?: string
  download?: boolean
  /** White icon on a dark chip, for use over media. */
  overlay?: boolean
}) {
  const className = cn(
    'inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3.5',
    props.overlay
      ? 'bg-black/55 text-white hover:bg-black/75'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  )
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
        onClick={(event) => event.stopPropagation()}
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
      onClick={(event) => {
        event.stopPropagation()
        props.onClick?.()
      }}
      className={className}
    >
      {props.children}
    </button>
  )
}

/** Empty state: what this view makes, with prompts to start from. */
export function StudioHero(props: {
  title: string
  suggestions: string[]
  onPick: (text: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='grid justify-items-center gap-2.5 py-16 text-center md:py-24'>
      <div className='from-primary flex size-14 items-center justify-center rounded-2xl bg-linear-to-br to-violet-500 text-white shadow-lg'>
        <Sparkles className='size-7' />
      </div>
      <h2 className='from-primary mt-1 bg-linear-to-r to-violet-500 bg-clip-text text-3xl font-extrabold text-transparent'>
        {props.title}
      </h2>
      <p className='text-muted-foreground text-sm'>
        {t('Describe what you want to create below')}
      </p>
      <div className='mt-3 flex max-w-xl flex-wrap justify-center gap-2'>
        {props.suggestions.map((text) => (
          <button
            key={text}
            type='button'
            onClick={() => props.onPick(text)}
            className='bg-card text-muted-foreground hover:text-foreground rounded-full border px-3 py-1 text-xs'
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * How long the server keeps this kind of media. For images it also holds the
 * switch that copies finished images into this browser.
 */
export function RetentionNotice(props: { kind: 'image' | 'video' }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const settings = useStudioSettings()
  const [saveLocally, setSaveLocallyState] = useState(getSaveLocally)
  const days =
    props.kind === 'video'
      ? settings.data?.video_retention_days
      : settings.data?.image_retention_days
  const limited = (days ?? 0) > 0
  if (props.kind === 'video' && !limited) return null
  return (
    <div className='bg-muted/40 text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2 text-xs'>
      {limited && (
        <span className='flex min-w-0 flex-1 items-center gap-1.5'>
          <Clock className='size-3.5 shrink-0' />
          {props.kind === 'video'
            ? t(
                'Videos are kept on the server for {{count}} days. Download the ones you want to keep.',
                { count: days }
              )
            : t('Images are kept on the server for {{count}} days.', {
                count: days,
              })}
        </span>
      )}
      {props.kind === 'image' && (
        <label className='ml-auto flex cursor-pointer items-center gap-2'>
          <Switch
            size='sm'
            checked={saveLocally}
            onCheckedChange={(checked) => {
              setSaveLocally(checked)
              setSaveLocallyState(checked)
              // Refreshing the saved list re-runs the copier.
              if (checked)
                void queryClient.invalidateQueries({
                  queryKey: SAVED_IMAGES_KEY,
                })
            }}
          />
          {t('Keep a copy in this browser')}
        </label>
      )}
    </div>
  )
}

export type TagTone = 'neutral' | 'running' | 'success' | 'failed'

export function Tag(props: { tone?: TagTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'bg-card rounded-md border px-1.5 py-px font-mono text-[11.5px] whitespace-nowrap',
        props.tone === 'running' && 'text-primary',
        props.tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
        props.tone === 'failed' && 'text-destructive',
        (!props.tone || props.tone === 'neutral') && 'text-muted-foreground'
      )}
    >
      {props.children}
    </span>
  )
}

/** Prompt and facts above one generation's results. A long prompt is
 * clamped to two lines and expands on click. */
export function JobHeader(props: { prompt: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5'>
      <p
        className={cn(
          'min-w-0 flex-[1_1_280px] cursor-pointer text-[13.5px] font-medium whitespace-pre-wrap [overflow-wrap:anywhere]',
          !expanded && 'line-clamp-2'
        )}
        title={expanded ? undefined : props.prompt}
        onClick={() => setExpanded((value) => !value)}
      >
        {props.prompt}
      </p>
      <div className='flex flex-wrap gap-1.5'>{props.children}</div>
    </div>
  )
}

export function ElapsedSeconds(props: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <>{Math.max(0, Math.round((now - props.since) / 1000))}</>
}

/** "45s" or "2m 05s" for a span of seconds. */
export function formatSpan(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  return `${minutes}m ${String(total % 60).padStart(2, '0')}s`
}

/** Time a finished generation took, from unix-second timestamps. */
export function DurationTag(props: { start?: number; end?: number }) {
  const { t } = useTranslation()
  if (!props.start || !props.end || props.end < props.start) return null
  return (
    <Tag>
      {t('Duration')} {formatSpan(props.end - props.start)}
    </Tag>
  )
}

/** Placeholder tile while a result is being generated. */
export function PendingTile(props: {
  label: ReactNode
  progress?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-muted/60 text-muted-foreground relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border text-xs',
        props.className
      )}
    >
      <LoaderCircle className='text-primary size-5 animate-spin' />
      {props.label}
      {props.progress !== undefined && (
        <div className='bg-border absolute inset-x-2.5 bottom-2.5 h-[3px] overflow-hidden rounded-full'>
          <div
            className='from-primary h-full bg-linear-to-r to-violet-500 transition-[width]'
            style={{ width: `${Math.min(Math.max(props.progress, 4), 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function FailedTile(props: {
  message: string
  className?: string
  /** Buttons such as retry and delete, shown under the message. */
  actions?: ReactNode
}) {
  return (
    <div
      className={cn(
        'bg-muted/60 text-destructive flex flex-col items-center justify-center gap-2.5 rounded-xl border p-3 text-center text-xs',
        props.className
      )}
    >
      <span className='line-clamp-4' title={props.message}>
        {props.message}
      </span>
      {props.actions && (
        <div className='flex items-center gap-1.5'>{props.actions}</div>
      )}
    </div>
  )
}

/** CSS aspect-ratio for a "WxH" size, falling back to square. */
export function sizeAspect(size?: string): string {
  const match = /^(\d+)x(\d+)$/.exec(size ?? '')
  return match ? `${match[1]} / ${match[2]}` : '1 / 1'
}
