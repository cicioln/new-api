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
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useMarketPrice } from '../hooks/use-market-price'
import {
  formatMarketLatency,
  formatMarketTps,
  getVendorAvatarIcon,
  getVendorAvatarName,
  type MarketPerf,
} from '../lib/market'
import type { PricingModel, TokenUnit } from '../types'
import {
  MarketGroupTags,
  MarketModelName,
  PelicanButton,
  VendorAvatar,
} from './market-parts'
import { MarketStatusBars, MarketSuccessRate } from './market-status'

export interface PricingTableProps {
  models: PricingModel[]
  perf: Map<string, MarketPerf>
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  onModelClick: (modelName: string) => void
  onTest?: (modelName: string) => void
}

const TH =
  'text-subtle-foreground bg-background border-b px-2.5 py-2.5 text-left text-xs font-medium whitespace-nowrap first:pl-[18px] last:pr-[18px]'
const TD =
  'border-b px-2.5 py-[11px] whitespace-nowrap first:pl-[18px] last:pr-[18px] group-last/market:border-b-0'
const NUM = 'text-right font-mono text-[12.5px] tabular-nums'

type RowProps = Omit<PricingTableProps, 'models' | 'perf'> & {
  model: PricingModel
  perf?: MarketPerf
}

const PricingTableRow = memo(function PricingTableRow(props: RowProps) {
  const prices = useMarketPrice(props.model, {
    tokenUnit: props.tokenUnit ?? DEFAULT_TOKEN_UNIT,
    showRechargePrice: props.showRechargePrice ?? false,
    priceRate: props.priceRate ?? 1,
    usdExchangeRate: props.usdExchangeRate ?? 1,
    group: props.selectedGroup,
  })
  const open = () => props.onModelClick(props.model.model_name)

  return (
    <tr
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && event.key === 'Enter') {
          open()
        }
      }}
      className='group/market hover:[&>td]:bg-muted/50 cursor-pointer'
    >
      <td className={TD}>
        <div className='flex items-center gap-2.5'>
          <VendorAvatar
            name={getVendorAvatarName(props.model)}
            icon={getVendorAvatarIcon(props.model)}
            className='size-7 rounded-[7px] text-xs'
          />
          <div className='min-w-0'>
            <MarketModelName
              name={props.model.model_name}
              className='text-[13px]'
            />
            <small className='text-subtle-foreground text-[11.5px]'>
              {props.model.vendor_name || '—'}
            </small>
          </div>
        </div>
      </td>
      <td className={TD}>
        <div className='flex gap-1'>
          <MarketGroupTags
            groups={props.model.enable_groups || []}
            max={2}
            className='text-[11px]'
          />
        </div>
      </td>
      <td className={TD}>
        <div className='flex items-center gap-2'>
          <MarketStatusBars perf={props.perf} className='w-[72px]' />
          <MarketSuccessRate perf={props.perf} className='text-xs' />
        </div>
      </td>
      <td className={cn(TD, NUM)}>
        {formatMarketLatency(props.perf?.latencyMs)}
      </td>
      <td className={cn(TD, NUM, 'max-[1280px]:hidden')}>
        {formatMarketTps(props.perf?.tps)}
        {props.perf?.tps != null && (
          <span className='text-subtle-foreground text-[11px]'> t/s</span>
        )}
      </td>
      {[0, 1].map((index) => {
        const price = prices[index]
        return (
          <td key={index} className={cn(TD, NUM)}>
            {price ? price.value : '—'}
            {price?.unit && (
              <span className='text-subtle-foreground text-[11px]'>
                {' '}
                {price.unit}
              </span>
            )}
          </td>
        )
      })}
      <td className={cn(TD, 'w-[1%] text-right')}>
        {props.onTest && (
          <PelicanButton model={props.model} onTest={props.onTest} />
        )}
      </td>
    </tr>
  )
})

export function PricingTable(props: PricingTableProps) {
  const { t } = useTranslation()
  const unit = (props.tokenUnit ?? DEFAULT_TOKEN_UNIT) === 'K' ? '1K' : '1M'

  return (
    <div className='bg-card overflow-x-auto rounded-xl border'>
      <table className='w-full min-w-full border-collapse text-[13px]'>
        <thead>
          <tr>
            <th className={TH}>{t('Model')}</th>
            <th className={TH}>{t('Group')}</th>
            <th className={TH}>{t('Status · 24h')}</th>
            <th className={cn(TH, 'text-right')}>{t('Latency')}</th>
            <th className={cn(TH, 'text-right max-[1280px]:hidden')}>
              {t('Throughput short')}
            </th>
            <th className={cn(TH, 'text-right')}>
              {t('Input')} / {unit}
            </th>
            <th className={cn(TH, 'text-right')}>
              {t('Output')} / {unit}
            </th>
            <th className={TH}>
              <span className='sr-only'>{t('Actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {props.models.map((model) => (
            <PricingTableRow
              key={model.id ?? model.model_name}
              model={model}
              perf={props.perf.get(model.model_name)}
              priceRate={props.priceRate}
              usdExchangeRate={props.usdExchangeRate}
              tokenUnit={props.tokenUnit}
              showRechargePrice={props.showRechargePrice}
              selectedGroup={props.selectedGroup}
              onModelClick={props.onModelClick}
              onTest={props.onTest}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
