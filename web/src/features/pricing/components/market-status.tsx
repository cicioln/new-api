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

import { cn } from '@/lib/utils'

import {
  formatSuccessRate,
  getStatusBars,
  getStatusLevel,
  type MarketPerf,
  type MarketStatus,
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

export function MarketStatusDot(props: { status: MarketStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        STATUS_BG[props.status]
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

/** 24 hourly success bars; slots without traffic stay muted. */
export function MarketStatusBars(props: {
  perf?: MarketPerf
  className?: string
}) {
  const { t } = useTranslation()
  const bars = getStatusBars(props.perf?.series)
  const label = bars.some(Boolean)
    ? t('Success rate')
    : t('No performance data available')
  return (
    <div
      role='img'
      aria-label={label}
      title={label}
      className={cn('flex h-3.5 gap-0.5', props.className)}
    >
      {bars.map((status, index) => (
        <i
          // Slots are positional: index is the hour offset in the window.
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          aria-hidden
          className={cn(
            'flex-1 rounded-[1.5px]',
            status ? STATUS_BG[status] : 'bg-border'
          )}
        />
      ))}
    </div>
  )
}
