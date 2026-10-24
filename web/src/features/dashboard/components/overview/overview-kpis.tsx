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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import {
  getPeriodChange,
  OVERVIEW_PERIODS,
  type OverviewAggregate,
  type OverviewPeriod,
} from '@/features/dashboard/lib/overview'
import type { PerformanceSummary } from '@/features/performance-metrics/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

const SPARK_WIDTH = 200
const SPARK_HEIGHT = 34

/** Filled line used under each KPI value; the area keeps a faint tint of the line color. */
function Sparkline(props: { values: number[]; className: string }) {
  if (props.values.length < 2) {
    return <div className='mt-2.5 h-[34px]' aria-hidden='true' />
  }
  const min = Math.min(...props.values)
  const max = Math.max(...props.values)
  const range = max - min || 1
  const path = props.values
    .map((value, index) => {
      const x = (index / (props.values.length - 1)) * SPARK_WIDTH
      const y = SPARK_HEIGHT - 3 - ((value - min) / range) * (SPARK_HEIGHT - 6)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className={cn('mt-2.5 block h-[34px] w-full', props.className)}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio='none'
      aria-hidden='true'
    >
      <path
        d={`${path} L${SPARK_WIDTH} ${SPARK_HEIGHT} L0 ${SPARK_HEIGHT}Z`}
        fill='currentColor'
        opacity='.08'
      />
      <path
        d={path}
        fill='none'
        stroke='currentColor'
        strokeWidth='1.6'
        vectorEffect='non-scaling-stroke'
      />
    </svg>
  )
}

function ChangeText(props: { change: number | null }) {
  const { t, i18n } = useTranslation()
  if (props.change === null) {
    return <span>{t('No previous data')}</span>
  }
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const up = props.change >= 0
  return (
    <>
      <span
        className={cn('font-medium', up ? 'text-success' : 'text-destructive')}
      >
        {up ? '↑' : '↓'} {formatNumber(Math.abs(props.change), locale)}%
      </span>
      {t('vs previous period')}
    </>
  )
}

function KpiCard(props: {
  label: string
  tag?: string
  value: ReactNode
  detail: ReactNode
  spark: number[]
  sparkClassName: string
  loading: boolean
}) {
  return (
    <div className='bg-card rounded-lg border px-[18px] pt-[18px] pb-3.5'>
      <div className='text-muted-foreground flex items-center justify-between text-[12.5px]'>
        <span>{props.label}</span>
        {props.tag != null && (
          <span className='bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-medium'>
            {props.tag}
          </span>
        )}
      </div>
      {props.loading ? (
        <Skeleton className='mt-2 mb-1.5 h-8 w-28' />
      ) : (
        <div className='mt-1.5 mb-1 truncate text-[28px] leading-tight font-semibold tracking-tight tabular-nums'>
          {props.value}
        </div>
      )}
      <div className='text-muted-foreground flex min-h-[18px] items-center gap-1.5 text-xs'>
        {props.detail}
      </div>
      <Sparkline values={props.spark} className={props.sparkClassName} />
    </div>
  )
}

export function OverviewKpis(props: {
  period: OverviewPeriod
  aggregate: OverviewAggregate
  loading: boolean
  performance?: PerformanceSummary | null
  performanceLoading: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const current = props.aggregate.current
  const previous = props.aggregate.previous
  const successRate = props.performance?.success_rate

  return (
    <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4'>
      <KpiCard
        label={t('Requests')}
        tag={t(OVERVIEW_PERIODS[props.period].labelKey)}
        value={formatNumber(current.count, locale)}
        detail={
          <ChangeText change={getPeriodChange(current.count, previous.count)} />
        }
        spark={props.aggregate.series.count}
        sparkClassName='text-primary'
        loading={props.loading}
      />
      <KpiCard
        label={t('Spend')}
        value={formatQuota(current.quota)}
        detail={
          <ChangeText change={getPeriodChange(current.quota, previous.quota)} />
        }
        spark={props.aggregate.series.quota}
        sparkClassName='text-foreground'
        loading={props.loading}
      />
      <KpiCard
        label={t('Token usage')}
        value={formatCompactNumber(current.tokens, locale)}
        detail={
          <ChangeText
            change={getPeriodChange(current.tokens, previous.tokens)}
          />
        }
        spark={props.aggregate.series.tokens}
        sparkClassName='text-foreground'
        loading={props.loading}
      />
      <KpiCard
        label={t('Success rate')}
        value={
          successRate == null ? (
            '—'
          ) : (
            <>
              {formatNumber(successRate, locale)}
              <small className='text-muted-foreground text-sm font-medium'>
                %
              </small>
            </>
          )
        }
        detail={<span>{t('All gateway traffic in this period')}</span>}
        spark={[]}
        sparkClassName='text-success'
        loading={props.performanceLoading}
      />
    </div>
  )
}
