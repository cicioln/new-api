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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLatency } from '@/features/performance-metrics/lib/format'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { useHomeFlow, type HomeFlowGroup } from '../../hooks/use-home-flow'
import {
  getGroupHealth,
  GROUP_HEALTH_DOT,
  GROUP_HEALTH_TEXT,
  type GroupHealth,
} from './health'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const HEALTH_STROKE: Record<GroupHealth, string> = {
  ok: 'stroke-success',
  degraded: 'stroke-warning',
  failing: 'stroke-destructive',
  idle: 'stroke-subtle-foreground/50',
}

type FlowPath = { id: string; d: string; health?: GroupHealth; speed: number }

/** Smooth horizontal S-curve between two points. */
function curve(x1: number, y1: number, x2: number, y2: number) {
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { systemName, logo, loading: brandLoading } = useSystemConfig()
  const flow = useHomeFlow()

  const origin =
    (typeof status?.server_address === 'string' &&
      status.server_address.trim().replace(/\/+$/, '')) ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const baseUrl = `${origin}/v1`

  const sources = [
    { label: t('Chat clients'), hint: 'Cherry Studio · LobeChat' },
    { label: t('IDE plugins'), hint: 'Cursor · Claude Code' },
    { label: t('SDK calls'), hint: 'OpenAI SDK · Dify · n8n' },
  ]

  // Anchors used to measure the SVG flow lines
  const stageRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)
  const sourceRefs = useRef<(HTMLSpanElement | null)[]>([])
  const groupRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [paths, setPaths] = useState<FlowPath[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  const groups = flow.groups

  useLayoutEffect(() => {
    const stage = stageRef.current
    const hub = hubRef.current
    if (!stage || !hub) return

    const measure = () => {
      const box = stage.getBoundingClientRect()
      const hubBox = hub.getBoundingClientRect()
      const center = (el: Element) => {
        const r = el.getBoundingClientRect()
        return {
          x: r.left + r.width / 2 - box.left,
          y: r.top + r.height / 2 - box.top,
        }
      }
      const hubY = hubBox.top + hubBox.height / 2 - box.top
      const hubLeft = hubBox.left - box.left
      const hubRight = hubBox.right - box.left
      const next: FlowPath[] = []

      sourceRefs.current.forEach((el, i) => {
        if (!el) return
        const p = center(el)
        next.push({
          id: `source-${i}`,
          d: curve(p.x + 6, p.y, hubLeft, hubY + (i - 1) * 14),
          speed: 1.4 + i * 0.25,
        })
      })
      groupRefs.current.slice(0, groups.length).forEach((el, i) => {
        if (!el) return
        const p = center(el)
        const spread = groups.length > 1 ? i / (groups.length - 1) : 0.5
        next.push({
          id: `group-${groups[i].group}`,
          d: curve(hubRight, hubY + (spread - 0.5) * 36, p.x - 6, p.y),
          health: getGroupHealth(groups[i].successRate),
          speed: 1.2 + (i % 4) * 0.3,
        })
      })
      setSize({ w: box.width, h: box.height })
      setPaths(next)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [groups])

  let stageNote = ''
  if (flow.status === 'loading') stageNote = t('Loading...')
  else if (flow.status === 'error') stageNote = t('Failed to load groups')
  else if (flow.status === 'empty') stageNote = t('No groups available')

  return (
    <section
      className={cn(
        'relative z-10 overflow-hidden px-4 pt-24 pb-4 md:px-6 md:pt-28 lg:pb-6',
        props.className
      )}
    >
      <div
        aria-hidden
        className='line-grid pointer-events-none absolute inset-0 -z-10'
      />

      <div className='mx-auto max-w-[1360px]'>
        {/* Topology stage */}
        <div
          ref={stageRef}
          className='landing-animate-fade-up relative grid items-center gap-10 opacity-0 lg:min-h-[400px] lg:grid-cols-[12rem_minmax(0,1fr)_minmax(0,24rem)] lg:gap-6'
        >
          {size.w > 0 && (
            <svg
              aria-hidden
              className='pointer-events-none absolute inset-0 hidden lg:block'
              width={size.w}
              height={size.h}
              viewBox={`0 0 ${size.w} ${size.h}`}
              fill='none'
            >
              {paths.map((p) => (
                <g key={p.id}>
                  <path d={p.d} className='stroke-border' strokeWidth={1.25} />
                  <path
                    d={p.d}
                    className={cn(
                      'flow-dash',
                      p.health ? HEALTH_STROKE[p.health] : 'stroke-primary'
                    )}
                    strokeWidth={1.75}
                    strokeLinecap='round'
                    style={
                      { '--flow-speed': `${p.speed}s` } as React.CSSProperties
                    }
                  />
                </g>
              ))}
            </svg>
          )}

          {/* Sources */}
          <ul className='relative hidden flex-col gap-16 lg:flex'>
            {sources.map((source, i) => (
              <li
                key={source.label}
                className='flex items-center justify-end gap-3 text-right'
              >
                <div className='min-w-0'>
                  <p className='text-sm font-semibold whitespace-nowrap'>
                    {source.label}
                  </p>
                  <p className='text-subtle-foreground text-[11px] whitespace-nowrap'>
                    {source.hint}
                  </p>
                </div>
                <span
                  ref={(el) => {
                    sourceRefs.current[i] = el
                  }}
                  className='bg-background border-border size-3 shrink-0 rounded-full border-[1.5px]'
                />
              </li>
            ))}
          </ul>

          {/* Hub */}
          <div className='relative flex flex-col items-center text-center'>
            <div ref={hubRef} className='relative'>
              <span
                aria-hidden
                className='hub-pulse border-primary/40 absolute -inset-4 rounded-[1.75rem] border'
              />
              <div className='bg-foreground relative flex size-[72px] items-center justify-center overflow-hidden rounded-[18px]'>
                {brandLoading ? (
                  <Skeleton className='size-full' />
                ) : (
                  <img
                    src={logo}
                    alt={t('Logo')}
                    className='size-12 rounded-xl object-contain'
                  />
                )}
              </div>
              <span
                aria-hidden
                className='bg-primary border-background absolute -right-2 -bottom-2 size-[22px] rounded-[7px] border-4'
              />
            </div>
            <h1 className='mt-7 text-3xl font-semibold tracking-tight md:text-4xl'>
              {brandLoading ? <Skeleton className='h-9 w-40' /> : systemName}
            </h1>
            <p className='text-subtle-foreground mt-2 text-sm'>
              {t('Unified AI Gateway')}
            </p>
            {stageNote && (
              <p
                className={cn(
                  'mt-4 text-sm',
                  flow.status === 'error'
                    ? 'text-destructive'
                    : 'text-subtle-foreground'
                )}
              >
                {stageNote}
              </p>
            )}
          </div>

          {/* Groups */}
          <ul className='relative flex flex-col gap-3 lg:gap-2'>
            {groups.map((g, i) => (
              <GroupNode
                key={g.group}
                group={g}
                noPerf={flow.noPerf}
                dotRef={(el) => {
                  groupRefs.current[i] = el
                }}
              />
            ))}
          </ul>
        </div>

        {/* Base URL + CTAs */}
        <div
          className='landing-animate-fade-up mt-8 flex flex-col items-center gap-5 opacity-0'
          style={{ animationDelay: '120ms' }}
        >
          <div className='bg-card inline-flex max-w-full items-center gap-2.5 rounded-full border p-1.5 pr-2'>
            <span className='bg-foreground text-background rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap'>
              {t('OpenAI Compatible')}
            </span>
            <code className='truncate font-mono text-sm'>{baseUrl}</code>
            <CopyButton
              value={baseUrl}
              size='icon'
              className='size-7 rounded-full'
              tooltip={t('Copy')}
            />
          </div>

          <div className='flex flex-wrap items-center justify-center gap-3'>
            <Button
              className='group bg-foreground text-background hover:bg-foreground/90 h-10 px-5'
              render={
                <Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />
              }
            >
              {props.isAuthenticated ? t('Go to Dashboard') : t('Get Started')}
              <ArrowRight className='ml-1 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='bg-card h-10 px-5'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function GroupNode(props: {
  group: HomeFlowGroup
  noPerf: boolean
  dotRef: (el: HTMLSpanElement | null) => void
}) {
  const g = props.group
  const health = getGroupHealth(g.successRate)
  const extra = g.modelTotal - g.models.length

  return (
    <li>
      <Link
        to='/pricing'
        search={{ group: g.group }}
        className='bg-card/80 hover:bg-muted flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors lg:border-transparent lg:bg-transparent lg:px-2 lg:py-1'
      >
        <span
          ref={props.dotRef}
          className={cn(
            'status-halo mt-1.5 size-2.5 shrink-0 rounded-full',
            GROUP_HEALTH_DOT[health]
          )}
        />
        <div className='min-w-0 flex-1'>
          <p className='flex items-baseline gap-1.5 text-[13px] font-semibold'>
            <span className='truncate' title={g.group}>
              {g.group}
            </span>
            <span
              className={cn(
                'font-mono text-[11px] font-normal',
                g.ratio < 1 ? 'text-primary' : 'text-subtle-foreground'
              )}
            >
              ×{g.ratio.toFixed(1)}
            </span>
          </p>
          {g.models.length > 0 && (
            <p className='text-muted-foreground truncate font-mono text-[11px]'>
              {g.models.join(' · ')}
              {extra > 0 && ` +${extra}`}
            </p>
          )}
          <p className='text-subtle-foreground truncate font-mono text-[10.5px] tabular-nums'>
            <GroupStats group={g} noPerf={props.noPerf} health={health} />
          </p>
        </div>
      </Link>
    </li>
  )
}

function GroupStats(props: {
  group: HomeFlowGroup
  noPerf: boolean
  health: GroupHealth
}) {
  const { t } = useTranslation()
  const g = props.group
  if (props.noPerf || g.successRate === null) return <>{t('No data')}</>
  return (
    <>
      <span
        className={props.health === 'ok' ? '' : GROUP_HEALTH_TEXT[props.health]}
      >
        1h {g.successRate.toFixed(1)}%
      </span>
      {g.avgLatencyMs !== null && ` · ${formatLatency(g.avgLatencyMs)}`}
    </>
  )
}
