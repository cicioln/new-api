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
import { Image as ImageIcon, Sparkles, Wrench } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT, QUOTA_TYPE_VALUES } from '../constants'
import { useMarketPrice } from '../hooks/use-market-price'
import {
  formatMarketLatency,
  formatMarketTps,
  getVendorAvatarIcon,
  getVendorAvatarName,
  type MarketPerf,
} from '../lib/market'
import { formatRequestPricePerUnit } from '../lib/price'
import {
  formatExactSeconds,
  getModalityLabelKey,
  getModelModality,
  parseVideoDurationSeconds,
  type MarketModality,
} from '../lib/video-market'
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
  onOpenStudio?: (modelName: string, kind: 'video' | 'image') => void
}

const TH =
  'text-subtle-foreground bg-background border-b px-2.5 py-2.5 text-left text-xs font-medium whitespace-nowrap first:pl-[18px] last:pr-[18px]'
const TD =
  'border-b px-2.5 py-[11px] whitespace-nowrap first:pl-[18px] last:pr-[18px] group-last/market:border-b-0'
const NUM = 'text-right font-mono text-[12.5px] tabular-nums'

const MODALITY_BADGE_CLASS: Record<MarketModality, string> = {
  chat: 'bg-muted text-muted-foreground',
  video: 'bg-[#ff5a1f]/12 text-[#ff5a1f] dark:text-[#ff7847]',
  image: 'bg-purple-500/12 text-purple-600 dark:text-purple-400',
}

type RowProps = Omit<PricingTableProps, 'models' | 'perf'> & {
  model: PricingModel
  perf?: MarketPerf
}

const PricingTableRow = memo(function PricingTableRow(props: RowProps) {
  const { t } = useTranslation()
  const modality = getModelModality(props.model)
  const isMedia = modality === 'video' || modality === 'image'
  const isFixedMedia =
    isMedia && props.model.quota_type === QUOTA_TYPE_VALUES.REQUEST
  const durationSec =
    modality === 'video'
      ? parseVideoDurationSeconds(props.model.model_name)
      : undefined

  const prices = useMarketPrice(props.model, {
    tokenUnit: props.tokenUnit ?? DEFAULT_TOKEN_UNIT,
    showRechargePrice: props.showRechargePrice ?? false,
    priceRate: props.priceRate ?? 1,
    usdExchangeRate: props.usdExchangeRate ?? 1,
    group: props.selectedGroup,
  })
  const fixedPriceCell = isFixedMedia
    ? (prices.find((p) => p.key === 'price') ?? prices[0])
    : undefined
  const perSecondPrice =
    isFixedMedia && durationSec
      ? formatRequestPricePerUnit(
          props.model,
          durationSec,
          props.showRechargePrice ?? false,
          props.priceRate ?? 1,
          props.usdExchangeRate ?? 1,
          props.selectedGroup,
          true,
          2
        )
      : undefined
  const groups = (props.model.enable_groups || []).filter(
    (group) =>
      !props.model.group_ratio || Object.hasOwn(props.model.group_ratio, group)
  )
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
        <span
          className={cn(
            'inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-medium',
            MODALITY_BADGE_CLASS[modality]
          )}
        >
          {t(getModalityLabelKey(modality))}
        </span>
      </td>
      <td className={TD}>
        <div className='flex gap-1'>
          <MarketGroupTags groups={groups} max={2} className='text-[11px]' />
        </div>
      </td>
      <td className={TD}>
        <div className='flex items-center gap-2'>
          {!isMedia && (
            <MarketStatusBars perf={props.perf} className='w-[72px]' />
          )}
          <MarketSuccessRate
            perf={props.perf}
            className={cn('text-xs', isMedia && 'font-semibold')}
          />
        </div>
      </td>
      <td className={cn(TD, NUM)}>
        {isMedia
          ? formatExactSeconds(props.perf?.latencyMs)
          : formatMarketLatency(props.perf?.latencyMs)}
      </td>
      <td className={cn(TD, NUM, 'max-[1280px]:hidden')}>
        {isMedia ? (
          <span className='text-subtle-foreground'>—</span>
        ) : (
          <>
            {formatMarketTps(props.perf?.tps)}
            {props.perf?.tps != null && (
              <span className='text-subtle-foreground text-[11px]'> t/s</span>
            )}
          </>
        )}
      </td>
      {isFixedMedia ? (
        <>
          <td className={cn(TD, NUM)}>
            <span className='font-semibold'>
              {fixedPriceCell ? fixedPriceCell.value : '—'}
            </span>
            <span className='text-subtle-foreground text-[11px]'>
              {' '}
              /{' '}
              {modality === 'image' ? t('image unit') : t('request')}
            </span>
          </td>
          <td className={cn(TD, NUM)}>
            {perSecondPrice ? (
              <span className='text-muted-foreground text-xs'>
                ≈ {perSecondPrice}/{t('sec short')}
              </span>
            ) : (
              <span className='text-subtle-foreground font-sans text-xs'>
                {t('Per request')}
              </span>
            )}
          </td>
        </>
      ) : (
        [0, 1].map((index) => {
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
        })
      )}
      <td className={cn(TD, 'w-[1%] text-right')}>
        {props.model.maintenance ? (
          <button
            type='button'
            disabled
            className='bg-card text-subtle-foreground inline-flex h-7 cursor-not-allowed items-center gap-[5px] rounded-[7px] border px-2.5 text-[12px] whitespace-nowrap opacity-50'
          >
            <Wrench aria-hidden className='size-3.5' strokeWidth={1.8} />
            {t('Under maintenance')}
          </button>
        ) : modality === 'video' && props.onOpenStudio ? (
          <button
            type='button'
            onClick={(event) => {
              event.stopPropagation()
              props.onOpenStudio?.(props.model.model_name, 'video')
            }}
            className='inline-flex h-7 cursor-pointer items-center gap-1 rounded-[7px] bg-[#ff5a1f] px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90'
          >
            <Sparkles aria-hidden className='size-3' strokeWidth={2.1} />
            {t('Create video')}
          </button>
        ) : modality === 'image' && props.onOpenStudio ? (
          <button
            type='button'
            onClick={(event) => {
              event.stopPropagation()
              props.onOpenStudio?.(props.model.model_name, 'image')
            }}
            className='inline-flex h-7 cursor-pointer items-center gap-1 rounded-[7px] bg-[#a855f7] px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90'
          >
            <ImageIcon aria-hidden className='size-3' strokeWidth={2} />
            {t('Create image')}
          </button>
        ) : (
          props.onTest && (
            <PelicanButton model={props.model} onTest={props.onTest} />
          )
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
            <th className={TH}>{t('Model type')}</th>
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
              onOpenStudio={props.onOpenStudio}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
