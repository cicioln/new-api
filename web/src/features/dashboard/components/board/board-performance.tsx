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

import { usePerfSummary } from '@/features/dashboard/hooks/use-overview-data'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'

import { KpiCard, SplitValue } from '../overview/overview-kpis'
import { OverviewModelHealth } from '../overview/overview-model-health'

const PERFORMANCE_WINDOW_HOURS = 24

function valueOrDash(text: string) {
  return text === '—' ? text : <SplitValue text={text} />
}

/** Request performance of the last 24 hours across every model. */
export function BoardPerformance() {
  const { t } = useTranslation()
  const perf = usePerfSummary(PERFORMANCE_WINDOW_HOURS)
  const summary = perf.data?.data.summary
  const window = t('Last 24 hours')

  return (
    <div className='flex flex-col gap-3.5'>
      <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4'>
        <KpiCard
          label={t('Success rate')}
          value={valueOrDash(
            formatUptimePct(summary?.success_rate ?? Number.NaN)
          )}
          detail={<span>{window}</span>}
          loading={perf.isLoading}
        />
        <KpiCard
          label={t('Average first token')}
          value={valueOrDash(formatLatency(summary?.avg_ttft_ms ?? 0))}
          detail={<span>{window}</span>}
          loading={perf.isLoading}
        />
        <KpiCard
          label={t('Average latency')}
          value={valueOrDash(formatLatency(summary?.avg_latency_ms ?? 0))}
          detail={<span>{window}</span>}
          loading={perf.isLoading}
        />
        <KpiCard
          label={t('Throughput')}
          value={formatThroughput(summary?.avg_tps ?? 0)}
          detail={<span>{window}</span>}
          loading={perf.isLoading}
        />
      </div>
      <OverviewModelHealth
        models={perf.data?.data.models ?? []}
        windowEnd={perf.data?.data.window_end}
        loading={perf.isLoading}
      />
    </div>
  )
}
