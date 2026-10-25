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
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useBoardUsage,
  type BoardFilters,
} from '@/features/dashboard/hooks/use-board-data'
import { usePerfSummary } from '@/features/dashboard/hooks/use-overview-data'
import {
  BOARD_PERIODS,
  getPeakHour,
  stackByModel,
  type BoardPeriod,
} from '@/features/dashboard/lib/board'
import { getPeriodChange } from '@/features/dashboard/lib/overview'
import { formatLatency } from '@/features/performance-metrics/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatNumber, formatQuota } from '@/lib/format'

import { ChangeText, KpiCard, SplitValue } from '../overview/overview-kpis'
import { BoardModelRanking } from './board-model-ranking'
import { BoardSpendTrend } from './board-spend-trend'

/** Models with their own color in the spend stack; the rest share one. */
const STACK_MODEL_LIMIT = 4
/** The performance summary covers at most the last 30 days. */
const MAX_PERF_HOURS = 24 * 30

export function BoardModels(props: {
  period: BoardPeriod
  filters: BoardFilters
  isAdmin: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const usage = useBoardUsage(props.period, props.filters, props.isAdmin)
  const { window, aggregate } = usage
  const perfHours = Math.min(
    MAX_PERF_HOURS,
    Math.max(1, Math.ceil((window.end - window.start) / 3600))
  )
  const perf = usePerfSummary(perfHours)
  const summary = perf.data?.data.summary

  const stackModels = useMemo(
    () =>
      aggregate.models
        .slice(0, STACK_MODEL_LIMIT)
        .map((model) => model.modelName),
    [aggregate.models]
  )
  const stack = useMemo(
    () => stackByModel(usage.rows, window, stackModels),
    [usage.rows, window, stackModels]
  )
  const peak = useMemo(
    () => getPeakHour(usage.rows, window),
    [usage.rows, window]
  )

  const compare = t(BOARD_PERIODS[props.period].compareKey)
  const minutes = Math.max(1, (window.end - window.start) / 60)
  const oneDecimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })

  let rpmDetail = <span>{t('No usage in this period')}</span>
  if (peak) {
    const peakDate = new Date(peak.start * 1000)
    rpmDetail = (
      <span>
        {t('Peak {{value}} · {{time}}', {
          value: formatNumber(Math.round(peak.count / 60), locale),
          time: `${weekday.format(peakDate)} ${dayjs(peakDate).format('HH:mm')}`,
        })}
      </span>
    )
  }

  let ttftValue: ReactNode = '—'
  if (summary?.avg_ttft_ms) {
    ttftValue = <SplitValue text={formatLatency(summary.avg_ttft_ms)} />
  }
  let ttftDetail = <span>{t('No performance data available')}</span>
  if (summary) {
    ttftDetail = (
      <span>
        {t('Average latency')} {formatLatency(summary.avg_latency_ms)}
      </span>
    )
  }

  return (
    <div className='flex flex-col gap-3.5'>
      <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4'>
        <KpiCard
          label={t('Total requests')}
          value={formatNumber(aggregate.current.count, locale)}
          detail={
            <ChangeText
              change={getPeriodChange(
                aggregate.current.count,
                aggregate.previous.count
              )}
              suffix={compare}
            />
          }
          loading={usage.loading}
        />
        <KpiCard
          label={t('Total spend')}
          value={<SplitValue text={formatQuota(aggregate.current.quota)} />}
          detail={
            <ChangeText
              change={getPeriodChange(
                aggregate.current.quota,
                aggregate.previous.quota
              )}
              suffix={compare}
            />
          }
          loading={usage.loading}
        />
        <KpiCard
          label={t('Average RPM')}
          value={oneDecimal.format(aggregate.current.count / minutes)}
          detail={rpmDetail}
          loading={usage.loading}
        />
        <KpiCard
          label={t('Average first token')}
          value={ttftValue}
          detail={ttftDetail}
          loading={perf.isLoading}
        />
      </div>
      <div className='grid grid-cols-1 gap-3.5 min-[1000px]:grid-cols-2'>
        <BoardSpendTrend
          bucketStarts={window.bucketStarts}
          hourly={BOARD_PERIODS[props.period].bucket === 'hour'}
          modelNames={stackModels}
          stack={stack}
          loading={usage.loading}
        />
        <BoardModelRanking models={aggregate.models} loading={usage.loading} />
      </div>
    </div>
  )
}
