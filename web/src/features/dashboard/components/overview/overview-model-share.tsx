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
  foldModelShare,
  type OverviewModelUsage,
} from '@/features/dashboard/lib/overview'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatQuota } from '@/lib/format'

const MODEL_SHARE_LIMIT = 5
const MODEL_BAR_CLASSES = [
  'bg-chart-1',
  'bg-foreground',
  'bg-chart-3',
  'bg-chart-2',
  'bg-chart-5',
]
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

function ShareRow(props: {
  name: string
  quota: number
  total: number
  barClassName: string
  locale?: string
}) {
  const percent = props.total > 0 ? (props.quota / props.total) * 100 : 0
  return (
    <li>
      <div className='mb-1.5 flex justify-between gap-3 text-[13px]'>
        <b className='min-w-0 truncate font-mono text-[12.5px] font-medium'>
          {props.name}
        </b>
        <span className='text-muted-foreground shrink-0 font-mono text-xs'>
          {formatQuota(props.quota)} ·{' '}
          {formatNumber(Math.round(percent), props.locale)}%
        </span>
      </div>
      <div className='bg-muted h-1.5 overflow-hidden rounded-md'>
        <i
          className={`block h-full rounded-md ${props.barClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </li>
  )
}

export function OverviewModelShare(props: {
  models: OverviewModelUsage[]
  totalQuota: number
  loading: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const share = foldModelShare(props.models, MODEL_SHARE_LIMIT)

  return (
    <section className='bg-card min-w-0 rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4'>
        <h3 className='text-sm font-semibold'>
          {t('Model usage distribution')}
        </h3>
        <span className='text-muted-foreground text-xs'>{t('By spend')}</span>
      </div>
      {props.loading && (
        <ul className='flex flex-col gap-3.5 px-[18px] pt-3.5 pb-[18px]'>
          {SKELETON_ROWS.map((key) => (
            <li key={key}>
              <Skeleton className='mb-1.5 h-4 w-full' />
              <Skeleton className='h-1.5 w-full' />
            </li>
          ))}
        </ul>
      )}
      {!props.loading && share.items.length === 0 && (
        <p className='text-muted-foreground px-[18px] py-10 text-center text-sm'>
          {t('No usage in this period')}
        </p>
      )}
      {!props.loading && share.items.length > 0 && (
        <ul className='flex flex-col gap-3.5 px-[18px] pt-3.5 pb-[18px]'>
          {share.items.map((model, index) => (
            <ShareRow
              key={model.modelName}
              name={model.modelName}
              quota={model.quota}
              total={props.totalQuota}
              barClassName={MODEL_BAR_CLASSES[index] ?? 'bg-neutral'}
              locale={locale}
            />
          ))}
          {share.otherCount > 0 && (
            <ShareRow
              name={t('{{count}} other models', { count: share.otherCount })}
              quota={share.other}
              total={props.totalQuota}
              barClassName='bg-neutral'
              locale={locale}
            />
          )}
        </ul>
      )}
    </section>
  )
}
