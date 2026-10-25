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
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { VendorAvatar } from '@/features/pricing/components/market-parts'
import { cn } from '@/lib/utils'

import { formatShare, formatTokens } from '../lib/format'
import { getRankChange } from '../lib/rankings'
import type { ModelRanking } from '../types'

const TH =
  'text-subtle-foreground bg-background border-b px-[18px] py-2.5 text-left text-xs font-medium whitespace-nowrap'
const TD = 'border-b px-[18px] py-[11px] whitespace-nowrap'
const NUM = 'text-right font-mono text-[12.5px] tabular-nums'
const HIDE_NARROW = 'max-[640px]:hidden'

export function RankChangeText(props: { row: ModelRanking }) {
  const change = getRankChange(props.row)
  if (change.kind === 'new') {
    return <span className='text-primary font-mono text-xs'>NEW</span>
  }
  if (change.kind === 'same') {
    return <span className='text-subtle-foreground font-mono text-xs'>—</span>
  }
  const up = change.kind === 'up'
  return (
    <span
      className={cn(
        'font-mono text-xs',
        up ? 'text-success' : 'text-destructive'
      )}
    >
      {up ? '▲' : '▼'} {change.delta}
    </span>
  )
}

function GrowthText(props: { row: ModelRanking }) {
  if (props.row.previous_rank == null) return <>—</>
  const growth = props.row.growth_pct
  return (
    <span
      className={cn(
        'font-medium',
        growth >= 0 ? 'text-success' : 'text-destructive'
      )}
    >
      {growth >= 0 ? '+' : ''}
      {growth.toFixed(1)}%
    </span>
  )
}

export function RankingsTable(props: { rows: ModelRanking[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const topShare = props.rows[0]?.share || 1
  const open = (modelName: string) =>
    navigate({ to: '/pricing/$modelId', params: { modelId: modelName } })

  return (
    <div className='bg-card overflow-x-auto rounded-xl border'>
      <table className='w-full border-collapse text-[13px]'>
        <thead>
          <tr>
            <th className={TH}>#</th>
            <th className={TH}>{t('Model')}</th>
            <th className={cn(TH, 'text-right')}>Token</th>
            <th className={TH}>{t('Token share')}</th>
            <th className={cn(TH, 'text-right', HIDE_NARROW)}>
              {t('Period over period')}
            </th>
            <th className={cn(TH, 'text-right')}>{t('Rank change')}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr
              key={row.model_name}
              tabIndex={0}
              onClick={() => open(row.model_name)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') open(row.model_name)
              }}
              className='hover:[&>td]:bg-muted/50 cursor-pointer [&:last-child>td]:border-b-0'
            >
              <td
                className={cn(
                  TD,
                  'w-9 font-mono',
                  index < 3
                    ? 'text-primary font-semibold'
                    : 'text-subtle-foreground'
                )}
              >
                {index + 1}
              </td>
              <td className={TD}>
                <div className='flex items-center gap-2.5'>
                  <VendorAvatar
                    name={row.vendor}
                    className='size-7 rounded-[7px] text-xs'
                  />
                  <div className='min-w-0'>
                    <b className='block font-mono text-[13px] font-medium'>
                      {row.model_name}
                    </b>
                    <small className='text-subtle-foreground text-[11.5px]'>
                      {row.vendor}
                    </small>
                  </div>
                </div>
              </td>
              <td className={cn(TD, NUM)}>{formatTokens(row.total_tokens)}</td>
              <td className={TD}>
                <div className='flex items-center gap-2'>
                  <span className='bg-muted h-1.5 w-[90px] overflow-hidden rounded-md'>
                    <i
                      className='bg-primary block h-full'
                      style={{
                        width: `${Math.min(100, (row.share / topShare) * 100)}%`,
                      }}
                    />
                  </span>
                  <small className='text-muted-foreground font-mono text-xs'>
                    {formatShare(row.share)}
                  </small>
                </div>
              </td>
              <td className={cn(TD, NUM, HIDE_NARROW)}>
                <GrowthText row={row} />
              </td>
              <td className={cn(TD, NUM)}>
                <RankChangeText row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
