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
  getSuccessRate,
  OVERVIEW_PERIODS,
  type OverviewAggregate,
  type OverviewPeriod,
} from '@/features/dashboard/lib/overview'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Token amounts always use K/M/B units, e.g. 14.6M, in every language. */
const TOKEN_LOCALE = 'en-US'
const SPARK_WIDTH = 200
const SPARK_HEIGHT = 34
/** Splits "¥86.72" or "14.6M" into sign, number and unit. */
const SPLIT_VALUE = /^([^\d-]*)(-?[\d.,\s]*\d)(\D*)$/

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

/** A formatted value whose currency sign and unit use the small, muted style. */
export function SplitValue(props: { text: string }) {
  const match = SPLIT_VALUE.exec(props.text)
  if (!match) return props.text
  const sign = match[1].trim()
  const unit = match[3].trim()
  return (
    <>
      {sign && (
        <small className='text-subtle-foreground me-1 text-sm font-medium'>
          {sign}
        </small>
      )}
      {match[2].trim()}
      {unit && (
        <small className='text-subtle-foreground text-sm font-medium'>
          {unit}
        </small>
      )}
    </>
  )
}

export function ChangeText(props: {
  change: number | null
  suffix: ReactNode
  /** Show a rise in the bad color, e.g. for latency. */
  inverse?: boolean
}) {
  const { i18n } = useTranslation()
  if (props.change === null) {
    return <span>{props.suffix}</span>
  }
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const up = props.change >= 0
  // Changes always keep one decimal, e.g. 12.4% or 0.3%.
  const percent = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(props.change))
  return (
    <>
      <span
        className={cn(
          'font-medium',
          up === !props.inverse ? 'text-success' : 'text-destructive'
        )}
      >
        {up ? '↑' : '↓'} {percent}%
      </span>
      {props.suffix}
    </>
  )
}

export function KpiCard(props: {
  label: string
  tag?: string
  value: ReactNode
  detail: ReactNode
  spark?: number[]
  sparkClassName?: string
  loading: boolean
}) {
  return (
    <div className='bg-card rounded-lg border px-[18px] pt-[18px] pb-3.5'>
      <div className='text-subtle-foreground flex items-center justify-between text-[12.5px]'>
        <span>{props.label}</span>
        {props.tag != null && (
          <span className='bg-primary/12 text-primary inline-flex h-[22px] items-center rounded-md px-2 text-xs font-medium'>
            {props.tag}
          </span>
        )}
      </div>
      {props.loading ? (
        <Skeleton className='mt-[11px] mb-[9px] h-8 w-28' />
      ) : (
        <div className='mt-1.5 mb-1 truncate text-[28px] leading-[1.55] font-semibold tracking-[-.03em] tabular-nums'>
          {props.value}
        </div>
      )}
      <div className='text-subtle-foreground flex min-h-[18px] items-center gap-1.5 text-xs'>
        {props.detail}
      </div>
      {props.spark != null && (
        <Sparkline
          values={props.spark}
          className={props.sparkClassName ?? ''}
        />
      )}
    </div>
  )
}

export function OverviewKpis(props: {
  period: OverviewPeriod
  aggregate: OverviewAggregate
  loading: boolean
  failures: { current: number; previous: number; series: number[] }
  failuresLoading: boolean
  tokenSplit?: { input: number; output: number } | null
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const current = props.aggregate.current
  const previous = props.aggregate.previous
  const compare = t(OVERVIEW_PERIODS[props.period].compareKey)
  const successRate = getSuccessRate(current.count, props.failures.current)
  const previousRate = getSuccessRate(previous.count, props.failures.previous)
  const rateChange =
    successRate === null || previousRate === null
      ? null
      : successRate - previousRate
  // Buckets without traffic count as healthy so the line only dips on failures.
  const rateSeries = props.aggregate.series.count.map(
    (count, index) =>
      getSuccessRate(count, props.failures.series[index] ?? 0) ?? 100
  )

  let tokenDetail: ReactNode = (
    <ChangeText
      change={getPeriodChange(current.tokens, previous.tokens)}
      suffix={compare}
    />
  )
  if (props.tokenSplit) {
    tokenDetail = (
      <span>
        {t('Input')} {formatCompactNumber(props.tokenSplit.input, TOKEN_LOCALE)}{' '}
        · {t('Output')}{' '}
        {formatCompactNumber(props.tokenSplit.output, TOKEN_LOCALE)}
      </span>
    )
  }

  return (
    <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4'>
      <KpiCard
        label={t('Request count')}
        tag={t(OVERVIEW_PERIODS[props.period].labelKey)}
        value={formatNumber(current.count, locale)}
        detail={
          <ChangeText
            change={getPeriodChange(current.count, previous.count)}
            suffix={compare}
          />
        }
        spark={props.aggregate.series.count}
        sparkClassName='text-primary'
        loading={props.loading}
      />
      <KpiCard
        label={t('Spend')}
        value={<SplitValue text={formatQuota(current.quota)} />}
        detail={
          <ChangeText
            change={getPeriodChange(current.quota, previous.quota)}
            suffix={compare}
          />
        }
        spark={props.aggregate.series.quota}
        sparkClassName='text-foreground'
        loading={props.loading}
      />
      <KpiCard
        label={t('Token usage')}
        value={
          <SplitValue
            text={formatCompactNumber(current.tokens, TOKEN_LOCALE)}
          />
        }
        detail={tokenDetail}
        spark={props.aggregate.series.tokens}
        sparkClassName='text-foreground'
        loading={props.loading}
      />
      <KpiCard
        label={t('Success rate')}
        value={
          successRate === null ? (
            '—'
          ) : (
            <>
              {formatNumber(successRate, locale)}
              <small className='text-subtle-foreground text-sm font-medium'>
                %
              </small>
            </>
          )
        }
        detail={
          <ChangeText
            change={rateChange}
            suffix={t('{{count}} failures retried automatically', {
              count: props.failures.current,
            })}
          />
        }
        spark={rateSeries}
        sparkClassName='text-success'
        loading={props.loading || props.failuresLoading}
      />
    </div>
  )
}
