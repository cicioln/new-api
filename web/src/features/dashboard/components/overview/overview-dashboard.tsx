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
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import {
  useOverviewFailures,
  useOverviewTokenSplit,
  useOverviewUsage,
  usePerfSummary,
} from '../../hooks/use-overview-data'
import {
  getGreetingKey,
  getPeriodChange,
  OVERVIEW_PERIOD_IDS,
  OVERVIEW_PERIODS,
  type OverviewPeriod,
} from '../../lib/overview'
import { OverviewKpis } from './overview-kpis'
import { OverviewModelHealth } from './overview-model-health'
import { OverviewModelShare } from './overview-model-share'
import { OverviewNoticeDialog } from './overview-notice-dialog'
import { OverviewRecentRequests } from './overview-recent-requests'
import { OverviewTrend } from './overview-trend'

const OVERVIEW_PERIOD_STORAGE_KEY = 'dashboard_overview_period'
const HEALTH_WINDOW_HOURS = 24

function getSavedOverviewPeriod(): OverviewPeriod {
  try {
    const saved = window.localStorage.getItem(OVERVIEW_PERIOD_STORAGE_KEY)
    if (saved && saved in OVERVIEW_PERIODS) return saved as OverviewPeriod
  } catch {
    // Storage can be unavailable in private windows; fall back to the default.
  }
  return '7d'
}

export function OverviewDashboard() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const user = useAuthStore((state) => state.auth.user)
  const [period, setPeriod] = useState<OverviewPeriod>(() =>
    getSavedOverviewPeriod()
  )
  const usage = useOverviewUsage(period)
  const failures = useOverviewFailures(usage.window)
  const tokenSplit = useOverviewTokenSplit(usage.window)
  const healthPerf = usePerfSummary(HEALTH_WINDOW_HOURS)

  const handlePeriodChange = (values: unknown[]) => {
    const next = values[0]
    if (typeof next !== 'string' || !(next in OVERVIEW_PERIODS)) return
    setPeriod(next as OverviewPeriod)
    try {
      window.localStorage.setItem(OVERVIEW_PERIOD_STORAGE_KEY, next)
    } catch {
      // Remembering the period is a convenience only.
    }
  }

  const displayName = user?.display_name || user?.username || ''
  const greeting = t(getGreetingKey(new Date().getHours()), {
    name: displayName,
  })
  const current = usage.aggregate.current.count
  const change = getPeriodChange(current, usage.aggregate.previous.count)
  const summaryValues = {
    period: t(OVERVIEW_PERIODS[period].labelKey),
    previous: t(OVERVIEW_PERIODS[period].previousKey),
    count: formatNumber(current, locale),
    change: new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.abs(change ?? 0)),
  }
  let summary = t('{{count}} requests in the past {{period}}.', summaryValues)
  if (change !== null && change >= 0) {
    summary = t(
      '{{count}} requests in the past {{period}}, {{change}}% more than {{previous}}.',
      summaryValues
    )
  } else if (change !== null) {
    summary = t(
      '{{count}} requests in the past {{period}}, {{change}}% fewer than {{previous}}.',
      summaryValues
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{greeting}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {usage.loading ? ' ' : summary}
      </SectionPageLayout.Description>
      <SectionPageLayout.Actions>
        <ToggleGroup
          value={[period]}
          onValueChange={handlePeriodChange}
          spacing={0.5}
          aria-label={t('Time range')}
          className='bg-card gap-0 rounded-lg border p-[3px]'
        >
          {OVERVIEW_PERIOD_IDS.map((id) => (
            <ToggleGroupItem
              key={id}
              value={id}
              className='text-subtle-foreground hover:text-foreground aria-pressed:text-foreground h-[26px] min-w-0 rounded-md px-2.5 text-[12.5px] font-normal hover:bg-transparent aria-pressed:font-medium'
            >
              {t(OVERVIEW_PERIODS[id].labelKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button size='sm' render={<Link to='/keys' />}>
          <Plus data-icon='inline-start' className='stroke-2' />
          {t('New key')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <OverviewNoticeDialog />
        <div className='flex flex-col gap-3.5'>
          <OverviewKpis
            period={period}
            aggregate={usage.aggregate}
            loading={usage.loading}
            failures={failures}
            failuresLoading={failures.loading}
            tokenSplit={tokenSplit.data}
          />

          <div className='grid grid-cols-1 gap-3.5 min-[1000px]:grid-cols-[1.7fr_1fr]'>
            <OverviewTrend
              period={period}
              bucketStarts={usage.window.bucketStarts}
              counts={usage.aggregate.series.count}
              failures={failures.series}
              loading={usage.loading}
            />
            <OverviewModelShare
              models={usage.aggregate.models}
              totalQuota={usage.aggregate.current.quota}
              loading={usage.loading}
            />
          </div>

          <div className='grid grid-cols-1 gap-3.5 min-[1000px]:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]'>
            <OverviewRecentRequests />
            <OverviewModelHealth
              models={healthPerf.data?.data.models ?? []}
              windowEnd={healthPerf.data?.data.window_end}
              loading={healthPerf.isLoading}
            />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
