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
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MarketSeg } from '@/features/pricing/components/market-seg'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { RankingsPodium } from './components/rankings-podium'
import { TopRisersCard, VendorShareCard } from './components/rankings-side'
import { RankingsTable } from './components/rankings-table'
import { useRankings } from './hooks/use-rankings'
import { formatTokens } from './lib/format'
import { RANKING_PERIODS, getTopRisers } from './lib/rankings'
import type { RankingPeriod } from './types'

export function Rankings() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const search = useSearch({ from: '/rankings/' })
  const navigate = useNavigate()

  const period: RankingPeriod = search.period ?? 'week'
  const rankingsQuery = useRankings(period)
  const snapshot = rankingsQuery.data?.data

  const handlePeriodChange = (next: RankingPeriod) => {
    navigate({
      to: '/rankings',
      search: (prev) => ({ ...prev, period: next }),
    })
  }

  let content: React.ReactNode
  if (rankingsQuery.isLoading) {
    content = (
      <div aria-busy='true' className='grid gap-3.5'>
        <Skeleton className='h-[74px] rounded-xl' />
        <div className='grid gap-3.5 md:grid-cols-3'>
          <Skeleton className='h-[150px] rounded-xl' />
          <Skeleton className='h-[150px] rounded-xl' />
          <Skeleton className='h-[150px] rounded-xl' />
        </div>
        <div className={GRID}>
          <Skeleton className='h-[420px] rounded-xl' />
          <Skeleton className='h-[200px] rounded-xl' />
        </div>
      </div>
    )
  } else if (!snapshot) {
    content = (
      <div className='bg-card text-subtle-foreground rounded-xl border px-5 py-16 text-center text-[13px]'>
        <b className='text-destructive mb-1 block text-[15px]'>
          {t('Unable to load rankings')}
        </b>
        {rankingsQuery.error instanceof Error
          ? rankingsQuery.error.message
          : t('Unable to load rankings data')}
        <br />
        <Button
          size='sm'
          variant='outline'
          className='mt-3.5'
          onClick={() => void rankingsQuery.refetch()}
        >
          {t('Retry')}
        </Button>
      </div>
    )
  } else {
    const models = snapshot.models
    // Trend columns are noise until a previous period exists for any model.
    const showTrend = models.some((row) => row.previous_rank != null)
    const hasRisers = getTopRisers(snapshot.top_movers).length > 0
    const totalTokens = models.reduce((sum, row) => sum + row.total_tokens, 0)
    const stats = [
      { label: t('Total tokens'), value: formatTokens(totalTokens) },
      { label: t('Active models'), value: formatNumber(models.length, locale) },
      {
        label: t('Vendors'),
        value: formatNumber(snapshot.vendors.length, locale),
      },
    ]
    content =
      models.length === 0 ? (
        <div className='bg-card text-subtle-foreground rounded-xl border px-5 py-16 text-center text-[13px]'>
          {t('No data')}
        </div>
      ) : (
        <>
          <dl className='bg-card mb-3.5 grid grid-cols-3 divide-x rounded-xl border'>
            {stats.map((stat) => (
              <div key={stat.label} className='px-[18px] py-3.5'>
                <dt className='text-subtle-foreground text-xs'>{stat.label}</dt>
                <dd className='mt-1 font-mono text-xl font-semibold tabular-nums'>
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
          <RankingsPodium
            rows={models.slice(0, 3)}
            showRankChange={showTrend}
          />
          <div className={GRID}>
            {models.length > 3 ? (
              <RankingsTable rows={models.slice(3)} showTrend={showTrend} />
            ) : (
              <div />
            )}
            <div className='grid gap-3.5'>
              <VendorShareCard vendors={snapshot.vendors} />
              {hasRisers && <TopRisersCard movers={snapshot.top_movers} />}
            </div>
          </div>
        </>
      )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-[1600px] px-4 pb-16 md:px-7'>
        <div className='flex flex-wrap items-end justify-between gap-4 pt-10 pb-5'>
          <div>
            <h1 className='text-[30px] font-[650] tracking-[-0.02em]'>
              {t('Model rankings')}
            </h1>
            <p className='text-subtle-foreground mt-1'>
              {t(
                'Ranked by tokens actually routed through this site, from /api/rankings.'
              )}
            </p>
          </div>
          <MarketSeg
            value={period}
            options={RANKING_PERIODS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            onChange={handlePeriodChange}
            aria-label={t('Period')}
          />
        </div>
        {content}
      </div>
    </PublicLayout>
  )
}

const GRID =
  'grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] items-start gap-3.5 max-[1000px]:grid-cols-[minmax(0,1fr)]'
