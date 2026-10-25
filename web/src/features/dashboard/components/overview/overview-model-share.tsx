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
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import {
  foldModelShare,
  MODEL_BAR_CLASSES,
  OTHER_BAR_CLASS,
  type OverviewModelUsage,
} from '@/features/dashboard/lib/overview'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatQuota } from '@/lib/format'

const MODEL_SHARE_LIMIT = 5
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

function ShareRow(props: {
  name: ReactNode
  quota: number
  total: number
  barClassName: string
  locale?: string
}) {
  const percent = props.total > 0 ? (props.quota / props.total) * 100 : 0
  return (
    <>
      <div className='mb-1.5 flex justify-between gap-3 text-[13px]'>
        <b className='flex min-w-0 items-center gap-1 truncate font-mono text-[12.5px] font-medium'>
          {props.name}
        </b>
        <span className='text-subtle-foreground shrink-0 font-mono text-xs'>
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
    </>
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
  const rest = props.models.slice(MODEL_SHARE_LIMIT)

  return (
    <section className='bg-card min-w-0 rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4'>
        <h3 className='text-sm leading-[1.55] font-semibold'>
          {t('Model usage distribution')}
        </h3>
        <span className='text-subtle-foreground text-xs'>{t('By spend')}</span>
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
            <li key={model.modelName}>
              <ShareRow
                name={model.modelName}
                quota={model.quota}
                total={props.totalQuota}
                barClassName={MODEL_BAR_CLASSES[index] ?? OTHER_BAR_CLASS}
                locale={locale}
              />
            </li>
          ))}
          {share.otherCount > 0 && (
            <Collapsible render={<li />}>
              <CollapsibleTrigger className='group/other w-full cursor-pointer text-left'>
                <ShareRow
                  name={
                    <>
                      <span className='truncate'>
                        {t('{{count}} other models', {
                          count: share.otherCount,
                        })}
                      </span>
                      <ChevronRight
                        className='text-subtle-foreground size-3.5 shrink-0 transition-transform group-data-[panel-open]/other:rotate-90'
                        aria-hidden='true'
                      />
                    </>
                  }
                  quota={share.other}
                  total={props.totalQuota}
                  barClassName={OTHER_BAR_CLASS}
                  locale={locale}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className='flex flex-col gap-1.5 pt-3'>
                  {rest.map((model) => (
                    <li
                      key={model.modelName}
                      className='flex justify-between gap-3 text-xs'
                    >
                      <span className='min-w-0 truncate font-mono'>
                        {model.modelName}
                      </span>
                      <span className='text-subtle-foreground shrink-0 font-mono'>
                        {formatQuota(model.quota)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}
        </ul>
      )}
    </section>
  )
}
