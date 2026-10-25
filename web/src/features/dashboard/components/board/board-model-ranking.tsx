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
import { rankModelsByCount } from '@/features/dashboard/lib/board'
import {
  MODEL_BAR_CLASSES,
  OTHER_BAR_CLASS,
  type OverviewModelUsage,
} from '@/features/dashboard/lib/overview'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

const RANKING_LIMIT = 5
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

function RankingRow(props: {
  name: string
  count: number
  max: number
  barClassName: string
  locale?: string
}) {
  const { t } = useTranslation()
  const percent =
    props.max > 0 ? Math.min(100, (props.count / props.max) * 100) : 0
  return (
    <li>
      <div className='mb-1.5 flex justify-between gap-3 text-[13px]'>
        <b className='min-w-0 truncate font-mono text-[12.5px] font-medium'>
          {props.name}
        </b>
        <span className='text-subtle-foreground shrink-0 font-mono text-xs'>
          {t('{{value}} calls', {
            value: formatNumber(props.count, props.locale),
          })}
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

/** Models of the period ordered by calls; bars are relative to the top model. */
export function BoardModelRanking(props: {
  models: OverviewModelUsage[]
  loading: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const ranking = rankModelsByCount(props.models, RANKING_LIMIT)
  const max = ranking.items[0]?.count ?? 0

  return (
    <section className='bg-card min-w-0 rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4'>
        <h3 className='text-sm leading-[1.55] font-semibold'>
          {t('Model call ranking')}
        </h3>
        <span className='text-subtle-foreground text-xs'>{t('By count')}</span>
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
      {!props.loading && ranking.items.length === 0 && (
        <p className='text-muted-foreground px-[18px] py-10 text-center text-sm'>
          {t('No usage in this period')}
        </p>
      )}
      {!props.loading && ranking.items.length > 0 && (
        <ul className='flex flex-col gap-3.5 px-[18px] pt-3.5 pb-[18px]'>
          {ranking.items.map((model, index) => (
            <RankingRow
              key={model.modelName}
              name={model.modelName}
              count={model.count}
              max={max}
              barClassName={MODEL_BAR_CLASSES[index] ?? OTHER_BAR_CLASS}
              locale={locale}
            />
          ))}
          {ranking.otherCount > 0 && (
            <RankingRow
              name={t('{{count}} other models', {
                count: ranking.otherCount,
              })}
              count={ranking.other}
              max={max}
              barClassName={OTHER_BAR_CLASS}
              locale={locale}
            />
          )}
        </ul>
      )}
    </section>
  )
}
