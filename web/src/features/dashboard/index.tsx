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
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { useState, useCallback, useMemo, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { BoardFilter } from './components/board/board-filter'
import { ModelsFilter } from './components/models/models-filter-dialog'
import { OverviewDashboard } from './components/overview/overview-dashboard'
import { EMPTY_BOARD_FILTERS, type BoardFilters } from './hooks/use-board-data'
import {
  buildDefaultDashboardFilters,
  getDefaultDays,
  getSavedChartPreferences,
  getSavedGranularity,
} from './lib'
import { BOARD_PERIOD_IDS, BOARD_PERIODS, type BoardPeriod } from './lib/board'
import {
  type DashboardSectionId,
  DASHBOARD_DEFAULT_SECTION,
  DASHBOARD_SECTION_IDS,
} from './section-registry'
import type {
  DashboardChartPreferences,
  DashboardFilters,
  UserChartsFilters,
} from './types'

const route = getRouteApi('/_authenticated/dashboard/$section')

const BOARD_PERIOD_STORAGE_KEY = 'dashboard_board_period'

const LazyBoardModels = lazy(() =>
  import('./components/board/board-models').then((m) => ({
    default: m.BoardModels,
  }))
)

const LazyBoardPerformance = lazy(() =>
  import('./components/board/board-performance').then((m) => ({
    default: m.BoardPerformance,
  }))
)

const LazyUserCharts = lazy(() =>
  import('./components/users/user-charts').then((m) => ({
    default: m.UserCharts,
  }))
)

const LazyFlowCharts = lazy(() =>
  import('./components/flow/flow-charts').then((m) => ({
    default: m.FlowCharts,
  }))
)

function ChartsFallback() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center justify-between border-b px-4 py-3 sm:px-5'>
        <Skeleton className='h-5 w-32' />
        <Skeleton className='h-8 w-72' />
      </div>
      <div className='h-96 p-2'>
        <Skeleton className='h-full w-full' />
      </div>
    </div>
  )
}

/** Tab labels of the board. */
const SECTION_TAB_KEYS: Record<DashboardSectionId, string> = {
  overview: 'Overview',
  models: 'Models',
  users: 'Users',
  flow: 'Traffic',
  performance: 'Performance',
}

function getSavedBoardPeriod(): BoardPeriod {
  try {
    const saved = window.localStorage.getItem(BOARD_PERIOD_STORAGE_KEY)
    if (saved && saved in BOARD_PERIODS) return saved as BoardPeriod
  } catch {
    // Storage can be unavailable in private windows; fall back to the default.
  }
  return '7d'
}

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = route.useParams()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const activeSection = (params.section ??
    DASHBOARD_DEFAULT_SECTION) as DashboardSectionId

  const [period, setPeriod] = useState<BoardPeriod>(() => getSavedBoardPeriod())
  const [boardFilters, setBoardFilters] =
    useState<BoardFilters>(EMPTY_BOARD_FILTERS)
  const [chartPreferences] = useState<DashboardChartPreferences>(() =>
    getSavedChartPreferences()
  )
  const [flowFilters, setFlowFilters] = useState<DashboardFilters>(() =>
    buildDefaultDashboardFilters(getSavedChartPreferences())
  )
  const [userChartsFilters, setUserChartsFilters] = useState<UserChartsFilters>(
    () => {
      const granularity = getSavedGranularity()
      return {
        timeGranularity: granularity,
        selectedRange: getDefaultDays(granularity),
        topUserLimit: 10,
      }
    }
  )
  const [flowSensitiveVisible, setFlowSensitiveVisible] = useState(true)

  const handleResetFlowFilters = useCallback(() => {
    setFlowFilters(buildDefaultDashboardFilters(chartPreferences))
  }, [chartPreferences])

  const handlePeriodChange = (values: unknown[]) => {
    const next = values[0]
    if (typeof next !== 'string' || !(next in BOARD_PERIODS)) return
    setPeriod(next as BoardPeriod)
    try {
      window.localStorage.setItem(BOARD_PERIOD_STORAGE_KEY, next)
    } catch {
      // Remembering the period is a convenience only.
    }
  }

  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)
  const visibleSections = useMemo(
    () =>
      DASHBOARD_SECTION_IDS.filter(
        (section) => section !== 'overview' && (section !== 'users' || isAdmin)
      ),
    [isAdmin]
  )
  const handleSectionChange = useCallback(
    (section: string) => {
      void navigate({
        to: '/dashboard/$section',
        params: { section: section as DashboardSectionId },
      })
    },
    [navigate]
  )

  if (activeSection === 'overview') {
    return <OverviewDashboard />
  }

  const modelActions =
    activeSection === 'models' ? (
      <>
        <ToggleGroup
          value={[period]}
          onValueChange={handlePeriodChange}
          spacing={0.5}
          aria-label={t('Time range')}
          className='bg-card gap-0 rounded-lg border p-[3px]'
        >
          {BOARD_PERIOD_IDS.map((id) => (
            <ToggleGroupItem
              key={id}
              value={id}
              className='text-subtle-foreground hover:text-foreground aria-pressed:text-foreground h-[26px] min-w-0 rounded-md px-2.5 text-[12.5px] font-normal hover:bg-transparent aria-pressed:font-medium'
            >
              {t(BOARD_PERIODS[id].labelKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <BoardFilter
          value={boardFilters}
          onChange={setBoardFilters}
          isAdmin={isAdmin}
        />
      </>
    ) : null
  const flowActions =
    activeSection === 'flow' ? (
      <>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setFlowSensitiveVisible((prev) => !prev)}
                aria-label={
                  flowSensitiveVisible
                    ? t('Hide sensitive data')
                    : t('Show sensitive data')
                }
                className='text-muted-foreground hover:text-foreground size-8'
              />
            }
          >
            {flowSensitiveVisible ? <Eye /> : <EyeOff />}
          </TooltipTrigger>
          <TooltipContent>
            {flowSensitiveVisible
              ? t('Hide sensitive data')
              : t('Show sensitive data')}
          </TooltipContent>
        </Tooltip>
        <ModelsFilter
          preferences={chartPreferences}
          currentFilters={flowFilters}
          onFilterChange={setFlowFilters}
          onReset={handleResetFlowFilters}
          titleKey='Flow Filters'
          descriptionKey='Filter the traffic flow view by time range and user.'
        />
      </>
    ) : null
  const sectionActions = modelActions ?? flowActions

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Dashboard')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t(
          'Calls and spend by model, user and channel, with data from /api/data.'
        )}
      </SectionPageLayout.Description>
      {sectionActions != null && (
        <SectionPageLayout.Actions>{sectionActions}</SectionPageLayout.Actions>
      )}
      <SectionPageLayout.Content>
        <Tabs value={activeSection} onValueChange={handleSectionChange}>
          <div className='mb-[18px] overflow-x-auto border-b'>
            <TabsList
              variant='line'
              className='min-w-max justify-start gap-0.5 p-0 group-data-horizontal/tabs:h-auto'
            >
              {visibleSections.map((section) => (
                <TabsTrigger
                  key={section}
                  value={section}
                  className='text-muted-foreground data-active:text-foreground flex-none px-3 py-[9px] text-[13.5px] font-normal group-data-horizontal/tabs:after:bottom-[-1px] data-active:font-medium'
                >
                  {t(SECTION_TAB_KEYS[section])}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
        {activeSection === 'models' && (
          <FadeIn>
            <Suspense fallback={<ChartsFallback />}>
              <LazyBoardModels
                period={period}
                filters={boardFilters}
                isAdmin={isAdmin}
              />
            </Suspense>
          </FadeIn>
        )}
        {activeSection === 'users' && (
          <FadeIn>
            <Suspense fallback={<ChartsFallback />}>
              <LazyUserCharts
                filters={userChartsFilters}
                onFiltersChange={setUserChartsFilters}
              />
            </Suspense>
          </FadeIn>
        )}
        {activeSection === 'flow' && (
          <FadeIn>
            <Suspense fallback={<ChartsFallback />}>
              <LazyFlowCharts
                filters={flowFilters}
                sensitiveVisible={flowSensitiveVisible}
              />
            </Suspense>
          </FadeIn>
        )}
        {activeSection === 'performance' && (
          <FadeIn>
            <Suspense fallback={<ChartsFallback />}>
              <LazyBoardPerformance />
            </Suspense>
          </FadeIn>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
