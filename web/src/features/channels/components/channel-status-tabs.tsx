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
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { CHANNEL_STATUS_TABS, getChannelStatusTab } from '../lib'

const route = getRouteApi('/_authenticated/channels/')

export function ChannelStatusTabs(props: { counts?: Record<string, number> }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const navigate = route.useNavigate()
  const active = getChannelStatusTab(route.useSearch().status)
  const counts = props.counts ?? {}
  const countOf = (statuses: readonly number[] | null) =>
    statuses === null
      ? Object.values(counts).reduce((sum, count) => sum + count, 0)
      : statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0)

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        void navigate({
          search: (prev) => ({
            ...prev,
            status: value === 'all' ? undefined : [value as string],
            page: undefined,
          }),
        })
      }}
    >
      <div className='overflow-x-auto border-b'>
        <TabsList
          variant='line'
          className='min-w-max justify-start gap-0.5 p-0 group-data-horizontal/tabs:h-auto'
        >
          {CHANNEL_STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className='text-muted-foreground data-active:text-foreground flex-none gap-1 px-3 py-[9px] text-[13.5px] font-normal group-data-horizontal/tabs:after:bottom-[-1px] data-active:font-medium'
            >
              {t(tab.label)}
              {props.counts && (
                <span className='text-muted-foreground font-mono text-[11.5px]'>
                  {formatNumber(countOf(tab.statuses), locale)}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  )
}
