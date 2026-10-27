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
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import {
  formatSuccessRate,
  getStatusBars,
  getStatusLevel,
  type MarketPerf,
  type MarketStatus,
  type MarketStatusFilter,
} from '../lib/market'

const STATUS_TEXT: Record<MarketStatus, string> = {
  ok: 'text-success',
  warn: 'text-warning',
  bad: 'text-destructive',
}

const STATUS_BG: Record<MarketStatus, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  bad: 'bg-destructive',
}

function getStatusTextClass(status: MarketStatus | null): string {
  return status ? STATUS_TEXT[status] : 'text-subtle-foreground'
}

export function MarketStatusDot(props: { status: MarketStatusFilter }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        props.status === 'none' ? 'bg-border' : STATUS_BG[props.status]
      )}
    />
  )
}

export function MarketSuccessRate(props: {
  perf?: MarketPerf
  className?: string
}) {
  const rate = props.perf?.successRate
  return (
    <em
      className={cn(
        'font-mono not-italic',
        getStatusTextClass(getStatusLevel(rate)),
        props.className
      )}
    >
      {formatSuccessRate(rate)}
    </em>
  )
}

// Bar height encodes severity so a 95% hour and a 40% hour no longer look
// alike at a glance.
const STATUS_HEIGHT: Record<MarketStatus, string> = {
  ok: 'h-full',
  warn: 'h-[65%]',
  bad: 'h-[35%]',
}

/**
 * Last 24 hourly success bars. Each bar's color and height follow its
 * success rate, and hovering shows the hour and the exact rate; slots
 * without traffic stay muted.
 */
export function MarketStatusBars(props: {
  perf?: MarketPerf
  className?: string
}) {
  const { t } = useTranslation()
  const bars = getStatusBars(props.perf?.series)
  const hasData = bars.some(Boolean)
  const label = hasData ? t('Success rate') : t('No performance data available')
  return (
    <div
      role='img'
      aria-label={label}
      title={hasData ? undefined : label}
      className={cn('flex h-3.5 items-end gap-0.5', props.className)}
    >
      {bars.map((bar, index) =>
        bar ? (
          <Tooltip key={bar.ts}>
            <TooltipTrigger
              delay={0}
              render={
                <i
                  aria-hidden
                  className='flex h-full flex-1 items-end transition-opacity hover:opacity-75'
                />
              }
            >
              <span
                className={cn(
                  'block w-full rounded-[1.5px]',
                  STATUS_BG[bar.status],
                  STATUS_HEIGHT[bar.status]
                )}
              />
            </TooltipTrigger>
            <TooltipContent className='flex-col items-start gap-0.5 font-mono'>
              <span>
                {dayjs(bar.ts * 1000).format('MM-DD HH:00')} –{' '}
                {dayjs((bar.ts + 3600) * 1000).format('HH:00')}
              </span>
              <span>
                {t('Success rate')} {formatSuccessRate(bar.rate)}
              </span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <i
            // Empty slots are positional padding before the first sample.
            // eslint-disable-next-line react/no-array-index-key
            key={`empty-${index}`}
            aria-hidden
            className='bg-border h-full flex-1 rounded-[1.5px]'
          />
        )
      )}
    </div>
  )
}
