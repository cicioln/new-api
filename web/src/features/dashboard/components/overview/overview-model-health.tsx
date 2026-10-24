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

import { Skeleton } from '@/components/ui/skeleton'
import {
  formatUptimePct,
  getSuccessRateLevel,
} from '@/features/performance-metrics/lib/format'
import type { PerfModelSummary } from '@/features/performance-metrics/types'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

const HEALTH_HOURS = 24
const HEALTH_MODEL_LIMIT = 6
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

/** The panel shows one decimal, e.g. 99.9%. */
function formatHealthPct(rate: number): string {
  if (!Number.isFinite(rate)) return '—'
  return `${rate.toFixed(1)}%`
}

/** One cell per hour: green when healthy, amber when degraded, red when failing, muted without traffic. */
function getCellClass(rate: number | undefined): string {
  if (rate === undefined) return 'bg-muted'
  const level = getSuccessRateLevel(rate)
  if (level === 'critical') return 'bg-destructive'
  if (level === 'warning') return 'bg-warning'
  return 'bg-success opacity-85'
}

function HealthRow(props: { model: PerfModelSummary; hourStarts: number[] }) {
  const rates = new Map(
    (props.model.recent_success_series ?? []).map((point) => [
      point.ts - (point.ts % 3600),
      point.success_rate,
    ])
  )
  return (
    <li className='grid grid-cols-[110px_minmax(0,1fr)_54px] items-center gap-3 text-[13px]'>
      <span
        className='truncate font-mono text-xs'
        title={props.model.model_name}
      >
        {props.model.model_name}
      </span>
      <div className='flex h-[22px] gap-0.5' aria-hidden='true'>
        {props.hourStarts.map((hour) => {
          const rate = rates.get(hour)
          return (
            <i
              key={hour}
              className={cn('flex-1 rounded-[2px]', getCellClass(rate))}
              title={`${dayjs(hour * 1000).format('HH:00')} · ${
                rate === undefined ? '—' : formatUptimePct(rate)
              }`}
            />
          )
        })}
      </div>
      <span className='text-muted-foreground text-right font-mono text-xs'>
        {formatHealthPct(props.model.success_rate)}
      </span>
    </li>
  )
}

export function OverviewModelHealth(props: {
  models: PerfModelSummary[]
  windowEnd?: number
  loading: boolean
}) {
  const { t } = useTranslation()
  const end = props.windowEnd ?? Math.floor(Date.now() / 1000)
  const lastHour = end - (end % 3600)
  const hourStarts = Array.from(
    { length: HEALTH_HOURS },
    (_, index) => lastHour - (HEALTH_HOURS - 1 - index) * 3600
  )
  const models = props.models.slice(0, HEALTH_MODEL_LIMIT)

  return (
    <section className='bg-card min-w-0 rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4'>
        <h3 className='text-sm leading-[1.55] font-semibold'>
          {t('Channel availability')}
        </h3>
        <span className='text-subtle-foreground text-xs'>
          {t('Last 24 hours')}
        </span>
      </div>
      {props.loading && (
        <ul className='flex flex-col gap-3 px-[18px] pt-3.5 pb-[18px]'>
          {SKELETON_ROWS.map((key) => (
            <li key={key}>
              <Skeleton className='h-[22px] w-full' />
            </li>
          ))}
        </ul>
      )}
      {!props.loading && models.length === 0 && (
        <p className='text-muted-foreground px-[18px] py-10 text-center text-sm'>
          {t('No performance data available')}
        </p>
      )}
      {!props.loading && models.length > 0 && (
        <ul className='flex flex-col gap-3 px-[18px] pt-3.5 pb-[18px]'>
          {models.map((model) => (
            <HealthRow
              key={model.model_name}
              model={model}
              hourStarts={hourStarts}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
