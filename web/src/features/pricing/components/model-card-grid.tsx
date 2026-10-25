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

import { DEFAULT_TOKEN_UNIT } from '../constants'
import type { MarketPerf } from '../lib/market'
import type { PricingModel, TokenUnit } from '../types'
import { ModelCard } from './model-card'

export interface ModelCardGridProps {
  models: PricingModel[]
  perf: Map<string, MarketPerf>
  onModelClick: (modelName: string) => void
  onTest?: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
}

export const ModelCardGrid = memo(function ModelCardGrid(
  props: ModelCardGridProps
) {
  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5'>
      {props.models.map((model) => (
        <ModelCard
          key={model.id ?? model.model_name}
          model={model}
          tokenUnit={props.tokenUnit ?? DEFAULT_TOKEN_UNIT}
          priceRate={props.priceRate}
          usdExchangeRate={props.usdExchangeRate}
          showRechargePrice={props.showRechargePrice}
          selectedGroup={props.selectedGroup}
          perf={props.perf.get(model.model_name)}
          onClick={props.onModelClick}
          onTest={props.onTest}
        />
      ))}
    </div>
  )
})
