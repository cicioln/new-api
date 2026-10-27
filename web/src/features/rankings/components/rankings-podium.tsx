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
import type { CSSProperties } from 'react'

import { VendorAvatar } from '@/features/pricing/components/market-parts'
import { getVendorAvatar } from '@/features/pricing/lib/market'
import { cn } from '@/lib/utils'

import { formatShare, formatTokens } from '../lib/format'
import type { ModelRanking } from '../types'
import { RankChangeText } from './rankings-table'

// Gold, silver and bronze badges for the top three.
const MEDAL_TONE = [
  'bg-amber-400/20 text-amber-700 dark:text-amber-300',
  'bg-slate-400/20 text-slate-600 dark:text-slate-300',
  'bg-orange-400/20 text-orange-700 dark:text-orange-300',
]

/** The top three models as large cards above the full table. */
export function RankingsPodium(props: {
  rows: ModelRanking[]
  showRankChange: boolean
}) {
  return (
    <ol className='mb-3.5 grid gap-3.5 md:grid-cols-3'>
      {props.rows.map((row, index) => {
        const color = getVendorAvatar(row.vendor).color
        return (
          <li key={row.model_name} className='min-w-0'>
            <Link
              to='/pricing/$modelId'
              params={{ modelId: row.model_name }}
              className='bg-card hover:shadow-card focus-visible:ring-ring flex h-full flex-col gap-4 rounded-xl border bg-no-repeat p-[18px] transition-[border-color,box-shadow] duration-150 outline-none hover:border-(--vendor)/45 focus-visible:ring-2'
              style={
                {
                  '--vendor': color,
                  backgroundImage: `linear-gradient(180deg, color-mix(in oklab, ${color} 10%, transparent), transparent 96px)`,
                } as CSSProperties
              }
            >
              <div className='flex items-center gap-3'>
                <VendorAvatar
                  name={row.vendor}
                  icon={row.vendor_icon}
                  className='size-10 rounded-[10px] text-[15px]'
                />
                <div className='min-w-0 flex-1'>
                  <b className='block truncate font-mono text-[14px] font-semibold'>
                    {row.model_name}
                  </b>
                  <small className='text-subtle-foreground text-xs'>
                    {row.vendor}
                  </small>
                </div>
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full font-mono text-sm font-bold',
                    MEDAL_TONE[index]
                  )}
                >
                  {row.rank}
                </span>
              </div>
              <div className='mt-auto'>
                <div className='flex items-baseline justify-between gap-2'>
                  <span className='font-mono text-[26px] leading-none font-semibold tracking-tight tabular-nums'>
                    {formatTokens(row.total_tokens)}
                  </span>
                  {props.showRankChange && <RankChangeText row={row} />}
                </div>
                <div className='mt-3 flex items-center gap-2.5'>
                  <span className='bg-muted h-1.5 flex-1 overflow-hidden rounded-full'>
                    <i
                      className='block h-full rounded-full'
                      style={{
                        width: `${Math.min(100, row.share * 100)}%`,
                        background: color,
                      }}
                    />
                  </span>
                  <small className='text-muted-foreground font-mono text-xs tabular-nums'>
                    {formatShare(row.share)}
                  </small>
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
