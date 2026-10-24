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
import { useQueries } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { TASK_STATUS_TABS, type TaskStatusTab } from '../constants'
import { fetchLogsByCategory } from '../lib/utils'
import { useLogsViewScope } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

/** Status tabs above the task table; counted tabs show their task total. */
export function TaskStatusTabs() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { isAdminView: isAdmin, viewAccess } = useLogsViewScope()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const active: TaskStatusTab = search.status ?? 'all'
  const counts = useQueries({
    queries: TASK_STATUS_TABS.map((tab) => ({
      queryKey: ['logs', 'task-count', viewAccess, tab.value],
      enabled: tab.showCount,
      queryFn: async () => {
        const result = await fetchLogsByCategory({
          logCategory: 'task',
          isAdmin,
          page: 1,
          pageSize: 1,
          searchParams: {},
          columnFilters: [],
          taskStatuses: tab.statuses,
        })
        return result?.success ? (result.data?.total ?? 0) : 0
      },
      meta: { errorToast: false },
    })),
  })

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        void navigate({
          search: (prev) => ({
            ...prev,
            status: value === 'all' ? undefined : (value as TaskStatusTab),
            page: 1,
          }),
        })
      }}
    >
      <div className='overflow-x-auto border-b'>
        <TabsList
          variant='line'
          className='min-w-max justify-start gap-0.5 p-0 group-data-horizontal/tabs:h-auto'
        >
          {TASK_STATUS_TABS.map((tab, index) => {
            const count = counts[index]?.data
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className='text-muted-foreground data-active:text-foreground flex-none gap-1 px-3 py-[9px] text-[13.5px] font-normal group-data-horizontal/tabs:after:bottom-[-1px] data-active:font-medium'
              >
                {t(tab.label)}
                {tab.showCount && count != null && count > 0 && (
                  <span className='text-muted-foreground font-mono text-[11.5px]'>
                    {formatNumber(count, locale)}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>
    </Tabs>
  )
}
