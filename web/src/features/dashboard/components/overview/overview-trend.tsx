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
  OVERVIEW_PERIODS,
  type OverviewPeriod,
} from '@/features/dashboard/lib/overview'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

const GRID_LINES = [0, 25, 50, 75, 100]

/** Number of axis labels kept readable for each period length. */
function getLabelStep(bucketCount: number): number {
  if (bucketCount <= 7) return 1
  if (bucketCount <= 14) return 2
  if (bucketCount <= 24) return 4
  return 5
}

export function OverviewTrend(props: {
  period: OverviewPeriod
  bucketStarts: number[]
  counts: number[]
  quotas: number[]
  loading: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const max = Math.max(1, ...props.counts)
  const step = getLabelStep(props.bucketStarts.length)
  const hourly = OVERVIEW_PERIODS[props.period].bucket === 'hour'
  const lastIndex = props.counts.length - 1

  return (
    <section className='bg-card min-w-0 rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4'>
        <h3 className='text-sm font-semibold'>{t('Request trend')}</h3>
        <div className='text-muted-foreground flex gap-3.5 text-xs'>
          <span className='flex items-center gap-1.5'>
            <i className='bg-primary size-2 rounded-[2px]' aria-hidden='true' />
            {t('Requests')}
          </span>
        </div>
      </div>
      <div className='px-[18px] pt-2.5 pb-4'>
        {props.loading ? (
          <Skeleton className='h-60 w-full 2xl:h-70' />
        ) : (
          <div className='relative h-60 2xl:h-70'>
            <div
              className='pointer-events-none absolute inset-x-0 top-0 bottom-[22px]'
              aria-hidden='true'
            >
              {GRID_LINES.map((line) => (
                <span
                  key={line}
                  className={cn(
                    'border-border absolute inset-x-0 border-t',
                    line > 0 && 'border-dashed'
                  )}
                  style={{ bottom: `${line}%` }}
                />
              ))}
            </div>
            <ol
              className='absolute inset-0 flex items-stretch gap-[clamp(3px,1.2%,12px)]'
              aria-label={t('Request trend')}
            >
              {props.counts.map((count, index) => {
                const start = props.bucketStarts[index]
                const label = dayjs(start * 1000).format(
                  hourly ? 'HH:00' : 'MM/DD'
                )
                const height = (count / max) * 100
                return (
                  <li
                    key={start}
                    className='group relative flex min-w-0 flex-1 flex-col'
                    title={`${label} · ${formatNumber(count, locale)} · ${formatQuota(props.quotas[index] ?? 0)}`}
                  >
                    <span className='sr-only'>
                      {label}: {formatNumber(count, locale)}
                    </span>
                    <div className='relative flex-1 pb-[22px]'>
                      <span
                        className={cn(
                          'bg-primary absolute inset-x-0 bottom-[22px] rounded-[3px] transition-opacity group-hover:opacity-100',
                          index === lastIndex ? 'opacity-100' : 'opacity-80'
                        )}
                        style={{
                          height: `calc((100% - 22px) * ${height / 100})`,
                          minHeight: count > 0 ? 3 : 0,
                        }}
                      />
                    </div>
                    {index % step === 0 && (
                      <span
                        className='text-muted-foreground absolute bottom-0 left-1/2 -translate-x-1/2 font-mono text-[11px] whitespace-nowrap'
                        aria-hidden='true'
                      >
                        {label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}
