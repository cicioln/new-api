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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfigStore } from '@/stores/system-config-store'

import {
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
} from '../lib/dynamic-price'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import { taskPriceLabel, taskUsageUnitLabel } from '../lib/task-price-display'
import type { PricingModel, TokenUnit } from '../types'
import { useBillingTime } from './use-billing-time'

// Market cards always show cents, e.g. 2.50 instead of 2.5.
const MARKET_PRICE_FRACTION_DIGITS = 2

export type MarketPriceOptions = {
  tokenUnit: TokenUnit
  showRechargePrice: boolean
  priceRate: number
  usdExchangeRate: number
  group?: string
}

export type MarketPriceCell = {
  key: string
  label: string
  value: string
  /** Unit suffix rendered muted after the value, e.g. "/ request". */
  unit?: string
}

/**
 * The two price cells shown for a model in the market: input and output per
 * token unit for token models, or the billing mode and unit price otherwise.
 */
export function useMarketPrice(
  model: PricingModel,
  options: MarketPriceOptions
): MarketPriceCell[] {
  const { t, i18n } = useTranslation()
  const billingTime = useBillingTime(model.billing_expr)
  const currency = useSystemConfigStore((state) => state.config.currency)
  const unitLabel = options.tokenUnit === 'K' ? '1K' : '1M'

  return useMemo(() => {
    const summary = getDynamicPricingSummary(model, {
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit: options.tokenUnit,
      showRechargePrice: options.showRechargePrice,
      priceRate: options.priceRate,
      usdExchangeRate: options.usdExchangeRate,
      groupRatioMultiplier: getDynamicDisplayGroupRatio(model, options.group),
    })

    if (summary) {
      if (summary.isSpecialExpression || summary.primaryEntries.length === 0) {
        let value = t('Dynamic Pricing')
        if (summary.isSpecialExpression) {
          value = t('Special billing expression')
        } else if (summary.hasUnconfiguredProviders) {
          value = t('Price not configured')
        }
        return [{ key: 'billing', label: t('Billing'), value }]
      }
      return summary.primaryEntries.slice(0, 2).map((entry) => {
        const labelKey = getDynamicPriceUnitLabelKey(entry)
        // Chat token prices carry a billing variable; task token fields do not.
        const isChatToken = entry.unit === 'token' && Boolean(entry.variable)
        const label =
          entry.labelKind === 'schema'
            ? taskPriceLabel(entry.description, entry.shortLabel, i18n.language)
            : t(entry.shortLabel)
        if (isChatToken) {
          return {
            key: entry.key,
            label: `${label} / ${unitLabel}`,
            value: entry.formattedRange ?? entry.formatted,
          }
        }
        const unit = taskUsageUnitLabel(
          entry,
          i18n.language,
          labelKey ? t(labelKey) : unitLabel
        )
        return {
          key: entry.key,
          label,
          value: entry.formattedRange ?? entry.formatted,
          unit: `/ ${unit}`,
        }
      })
    }

    if (isUnconfiguredTaskUsageModel(model)) {
      return [
        {
          key: 'billing',
          label: t('Billing'),
          value: t('Price not configured'),
        },
      ]
    }

    if (isTokenBasedModel(model)) {
      return (['input', 'output'] as const).map((type) => ({
        key: type,
        label: `${type === 'input' ? t('Input') : t('Output')} / ${unitLabel}`,
        value: formatPrice(
          model,
          type,
          options.tokenUnit,
          options.showRechargePrice,
          options.priceRate,
          options.usdExchangeRate,
          options.group,
          true,
          MARKET_PRICE_FRACTION_DIGITS
        ),
      }))
    }

    return [
      { key: 'billing', label: t('Billing'), value: t('Per request') },
      {
        key: 'price',
        label: t('Unit price'),
        value: formatRequestPrice(
          model,
          options.showRechargePrice,
          options.priceRate,
          options.usdExchangeRate,
          options.group,
          true,
          MARKET_PRICE_FRACTION_DIGITS
        ),
        unit: `/ ${t('request')}`,
      },
    ]
    // Currency is read indirectly by the price formatters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    model,
    billingTime,
    options.tokenUnit,
    options.showRechargePrice,
    options.priceRate,
    options.usdExchangeRate,
    options.group,
    unitLabel,
    currency,
    t,
    i18n.language,
  ])
}
