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
import { LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

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

/** Prompt and facts above one generation's results. */
export function JobHeader(props: { prompt: string; children: ReactNode }) {
  return (
    <div className='flex flex-wrap items-center gap-x-2 gap-y-1.5'>
      <p
        className='min-w-0 flex-[1_1_280px] truncate text-[13.5px] font-medium'
        title={props.prompt}
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

export function FailedTile(props: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'bg-muted/60 text-destructive flex items-center justify-center rounded-xl border p-3 text-center text-xs',
        props.className
      )}
    >
      <span className='line-clamp-4' title={props.message}>
        {props.message}
      </span>
    </div>
  )
}

/** CSS aspect-ratio for a "WxH" size, falling back to square. */
export function sizeAspect(size?: string): string {
  const match = /^(\d+)x(\d+)$/.exec(size ?? '')
  return match ? `${match[1]} / ${match[2]}` : '1 / 1'
}
