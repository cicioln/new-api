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
  MODEL_BAR_CLASSES,
  OTHER_BAR_CLASS,
} from '@/features/dashboard/lib/overview'
import dayjs from '@/lib/dayjs'
import { formatQuota } from '@/lib/format'

/** Number of axis labels kept readable for each period length. */
function getLabelStep(bucketCount: number): number {
  if (bucketCount <= 7) return 1
  if (bucketCount <= 14) return 2
  if (bucketCount <= 24) return 4
  return 5
}

/** Spend per bucket, stacked from the largest model at the bottom. */
export function BoardSpendTrend(props: {
  bucketStarts: number[]
  hourly: boolean
  modelNames: string[]
  stack: number[][]
  loading: boolean
}) {
  const { t } = useTranslation()
  const totals = props.stack.map((values) =>
    values.reduce((total, value) => total + value, 0)
  )
  const max = Math.max(1, ...totals)
  const step = getLabelStep(props.bucketStarts.length)
  const names = [...props.modelNames, t('Other')]

  return (
    <section className='bg-card min-w-0 rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4'>
        <h3 className='text-sm leading-[1.55] font-semibold'>
          {t('Spend trend')}
        </h3>
        <span className='text-subtle-foreground text-xs'>
          {t('Stacked by model')}
        </span>
      </div>
      <div className='px-[18px] pt-2.5 pb-4'>
        {props.loading ? (
          <Skeleton className='h-60 w-full min-[1800px]:h-70' />
        ) : (
          <ol
            className='flex h-60 items-stretch gap-[clamp(6px,5%,36px)] min-[1800px]:h-70'
            aria-label={t('Spend trend')}
          >
            {props.stack.map((values, index) => {
              const start = props.bucketStarts[index]
              const label = dayjs(start * 1000).format(
                props.hourly ? 'HH:00' : 'MM/DD'
              )
              const detail = values
                .map((value, column) =>
                  value > 0 ? `${names[column]} ${formatQuota(value)}` : null
                )
                .filter(Boolean)
                .join(' · ')
              return (
                <li
                  key={start}
                  className='relative flex min-w-0 flex-1 flex-col'
                  title={`${label} · ${formatQuota(totals[index])}${detail ? ` · ${detail}` : ''}`}
                >
                  <span className='sr-only'>
                    {label}: {formatQuota(totals[index])}
                  </span>
                  <div
                    className='absolute inset-x-0 top-0 bottom-5 flex flex-col-reverse'
                    aria-hidden='true'
                  >
                    {values.map((value, column) => (
                      <span
                        key={names[column]}
                        className={`block shrink-0 opacity-85 ${column < props.modelNames.length ? MODEL_BAR_CLASSES[column] : OTHER_BAR_CLASS}`}
                        style={{ height: `${(value / max) * 100}%` }}
                      />
                    ))}
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
        )}
      </div>
    </section>
  )
}
