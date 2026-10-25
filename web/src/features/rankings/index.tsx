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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MarketSeg } from '@/features/pricing/components/market-seg'
import { cn } from '@/lib/utils'

import { TopRisersCard, VendorShareCard } from './components/rankings-side'
import { RankingsTable } from './components/rankings-table'
import { useRankings } from './hooks/use-rankings'
import {
  RANKING_CATEGORIES,
  RANKING_PERIODS,
  filterRankingCategory,
} from './lib/rankings'
import type { RankingCategoryId, RankingPeriod } from './types'

export function Rankings() {
  const { t } = useTranslation()
  const search = useSearch({ from: '/rankings/' })
  const navigate = useNavigate()
  const [category, setCategory] = useState<RankingCategoryId>('all')

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
      <div aria-busy='true' className={GRID}>
        <Skeleton className='h-[420px] rounded-xl' />
        <div className='grid gap-3.5'>
          <Skeleton className='h-[200px] rounded-xl' />
          <Skeleton className='h-[180px] rounded-xl' />
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
    const rows = filterRankingCategory(snapshot.models, category)
    content = (
      <div className={GRID}>
        {rows.length === 0 ? (
          <div className='bg-card text-subtle-foreground rounded-xl border px-5 py-16 text-center text-[13px]'>
            {t('No data')}
          </div>
        ) : (
          <RankingsTable rows={rows} />
        )}
        <div className='grid gap-3.5'>
          <VendorShareCard vendors={snapshot.vendors} />
          <TopRisersCard movers={snapshot.top_movers} />
        </div>
      </div>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-[1360px] px-6 pt-16 pb-16'>
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
        <div
          role='radiogroup'
          aria-label={t('Category')}
          className='mb-4 flex flex-wrap gap-1.5'
        >
          {RANKING_CATEGORIES.map((option) => {
            const on = option.value === category
            return (
              <button
                key={option.value}
                type='button'
                role='radio'
                aria-checked={on}
                onClick={() => setCategory(option.value)}
                className={cn(
                  'h-[30px] rounded-full border px-3 text-[13px] transition-colors',
                  on
                    ? 'border-foreground bg-foreground text-background'
                    : 'bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                {t(option.labelKey)}
              </button>
            )
          })}
        </div>
        {content}
      </div>
    </PublicLayout>
  )
}

const GRID =
  'grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] items-start gap-3.5 max-[1000px]:grid-cols-[minmax(0,1fr)]'
