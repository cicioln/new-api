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
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const GRID_LINES = [0, 25, 50, 75, 100]
/** Room above the tallest bar for its failure segment. */
const HEADROOM = 1.06
/** Failures are rare, so their segment is exaggerated to stay visible. */
const FAILURE_SCALE = 8

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
  failures: number[]
  loading: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const max = Math.max(1, ...props.counts) * HEADROOM
  const step = getLabelStep(props.bucketStarts.length)
  const config = OVERVIEW_PERIODS[props.period]
  const hourly = config.bucket === 'hour' && config.bucketSize === 1
  const halfDay = config.bucketSize > 1
  const lastIndex = props.counts.length - 1

  return (
    <section className='bg-card min-w-0 rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4'>
        <h3 className='text-sm leading-[1.55] font-semibold'>
          {t('Request trend')}
        </h3>
        <div className='text-subtle-foreground flex gap-3.5 text-xs'>
          <span className='flex items-center gap-1.5'>
            <i className='bg-primary size-2 rounded-[2px]' aria-hidden='true' />
            {t('Success')}
          </span>
          <span className='flex items-center gap-1.5'>
            <i className='bg-input size-2 rounded-[2px]' aria-hidden='true' />
            {t('Failed')}
          </span>
        </div>
      </div>
      <div className='px-[18px] pt-2.5 pb-4'>
        {props.loading ? (
          <Skeleton className='h-60 w-full min-[1800px]:h-70' />
        ) : (
          <div className='relative h-60 min-[1800px]:h-70'>
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
              className='absolute inset-0 flex items-stretch gap-[clamp(10px,1.4%,16px)]'
              aria-label={t('Request trend')}
            >
              {props.counts.map((count, index) => {
                const start = props.bucketStarts[index]
                const failed = props.failures[index] ?? 0
                const date = dayjs(start * 1000)
                const label = date.format(hourly ? 'HH:00' : 'MM/DD')
                const fullLabel = halfDay ? date.format('MM/DD HH:00') : label
                const ratio = count / max
                const failedRatio = Math.min(
                  1 - ratio,
                  (failed / max) * FAILURE_SCALE
                )
                return (
                  <li
                    key={start}
                    className='group relative flex min-w-0 flex-1 flex-col'
                    title={`${fullLabel} · ${t('Success')} ${formatNumber(count, locale)} · ${t('Failed')} ${formatNumber(failed, locale)}`}
                  >
                    <span className='sr-only'>
                      {fullLabel}: {t('Success')} {formatNumber(count, locale)},{' '}
                      {t('Failed')} {formatNumber(failed, locale)}
                    </span>
                    <div
                      className='absolute inset-x-0 top-0 bottom-[22px] flex flex-col justify-end'
                      aria-hidden='true'
                    >
                      <span
                        className='bg-input mb-0.5 block rounded-[2px]'
                        style={{
                          height: `${failedRatio * 100}%`,
                          minHeight: 3,
                        }}
                      />
                      <span
                        className={cn(
                          'bg-primary block rounded-[3px] transition-opacity group-hover:opacity-100',
                          index === lastIndex ? 'opacity-100' : 'opacity-78'
                        )}
                        style={{ height: `${ratio * 100}%` }}
                      />
                    </div>
                    {index % step === 0 && (
                      <span
                        className='text-subtle-foreground absolute bottom-0 left-1/2 -translate-x-1/2 font-mono text-[11px] whitespace-nowrap'
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
