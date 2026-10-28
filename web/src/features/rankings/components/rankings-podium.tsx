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
import { RankingModelName } from './ranking-model-name'
import { RankChangeText } from './rankings-table'

// Gold, silver and bronze for the top three.
const MEDAL_COLORS = ['#f5b301', '#9aa4b2', '#d9793a']
// On wide screens the winner stands in the middle: 2 · 1 · 3.
const PODIUM_ORDER = ['md:order-2', 'md:order-1', 'md:order-3']

/** The top three models as a podium above the full list. */
export function RankingsPodium(props: {
  rows: ModelRanking[]
  showRankChange: boolean
}) {
  return (
    <ol className='mb-3.5 grid items-end gap-3.5 md:grid-cols-3'>
      {props.rows.map((row, index) => {
        const color = getVendorAvatar(row.vendor).color
        const first = index === 0
        return (
          <li
            key={row.model_name}
            className={cn('min-w-0', PODIUM_ORDER[index])}
          >
            <Link
              to='/pricing/$modelId'
              params={{ modelId: row.model_name }}
              className={cn(
                'bg-card focus-visible:ring-ring relative flex flex-col gap-3.5 overflow-hidden rounded-[14px] border bg-no-repeat outline-none transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-(--vendor)/45 focus-visible:ring-2',
                first
                  ? 'px-[22px] pt-[26px] pb-[22px] shadow-[0_10px_30px_-18px_var(--vendor)]'
                  : 'p-5'
              )}
              style={
                {
                  '--vendor': color,
                  backgroundImage: `radial-gradient(120% 70% at 50% -10%, color-mix(in oklab, ${color} 14%, transparent), transparent 70%)`,
                } as CSSProperties
              }
            >
              <span
                aria-hidden
                className='absolute inset-x-0 top-0 h-1'
                style={{ background: MEDAL_COLORS[index] }}
              />
              <span
                className='absolute top-4 right-4 grid size-[30px] place-items-center rounded-full font-mono text-sm font-extrabold text-white'
                style={{ background: MEDAL_COLORS[index] }}
              >
                {row.rank}
              </span>
              <div className='flex min-w-0 items-center gap-3 pr-10'>
                <VendorAvatar
                  name={row.vendor}
                  icon={row.vendor_icon}
                  className={cn(
                    'rounded-xl',
                    first ? 'size-[52px] text-[19px]' : 'size-11 text-base'
                  )}
                />
                <div className='min-w-0 flex-1'>
                  <RankingModelName
                    modelName={row.model_name}
                    className={first ? 'text-lg' : 'text-base'}
                  />
                  <small className='text-subtle-foreground mt-0.5 block truncate font-mono text-[11.5px]'>
                    {row.model_name}
                  </small>
                </div>
              </div>
              <span
                className={cn(
                  'font-mono leading-none font-semibold tracking-tight tabular-nums',
                  first ? 'text-[34px]' : 'text-[28px]'
                )}
              >
                {formatTokens(row.total_tokens)}
                <span className='text-muted-foreground ml-1 text-xs font-normal tracking-normal'>
                  tokens
                </span>
              </span>
              <div className='text-muted-foreground flex items-center gap-2.5 text-xs'>
                <span className='bg-muted h-1.5 flex-1 overflow-hidden rounded-full'>
                  <i
                    className='block h-full rounded-full'
                    style={{
                      width: `${Math.min(100, row.share * 100)}%`,
                      background: color,
                    }}
                  />
                </span>
                <span className='font-mono tabular-nums'>
                  {formatShare(row.share)}
                </span>
                {props.showRankChange && <RankChangeText row={row} />}
              </div>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
