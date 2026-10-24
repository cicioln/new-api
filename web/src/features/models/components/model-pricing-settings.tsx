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
/* eslint-disable react-refresh/only-export-components */
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { getEnabledModels } from '@/features/channels/api'
import { SettingsPageProvider } from '@/features/system-settings/components/settings-page-context'
import {
  getOptionValue,
  useSystemOptions,
} from '@/features/system-settings/hooks/use-system-options'
import {
  buildModelSnapshots,
  isBasePricingUnset,
} from '@/features/system-settings/models/model-pricing-snapshots'
import { RatioSettingsCard } from '@/features/system-settings/models/ratio-settings-card'
import { requireServerSuccess } from '@/lib/server-error-message'

const PRICING_DEFAULTS = {
  ModelPrice: '',
  ModelRatio: '',
  CacheRatio: '',
  CreateCacheRatio: '',
  CompletionRatio: '',
  ImageRatio: '',
  AudioRatio: '',
  AudioCompletionRatio: '',
  ExposeRatioEnabled: false,
  'billing_setting.billing_mode': '{}',
  'billing_setting.billing_expr': '{}',
  'billing_setting.plugin_billing_expr': '{}',
  'tool_price_setting.prices': '{}',
  TopupGroupRatio: '',
  GroupRatio: '',
  UserUsableGroups: '',
  GroupGroupRatio: '',
  AutoGroups: '',
  MaxTokenAutoGroups: 5,
  DefaultUseAutoGroup: false,
  'group_ratio_setting.group_special_usable_group': '{}',
}

function usePricingSettings() {
  const query = useSystemOptions()
  const settings = useMemo(
    () => getOptionValue(query.data?.data, PRICING_DEFAULTS),
    [query.data?.data]
  )
  return { ...query, settings }
}

/** Number of enabled channel models without a configured base price. */
export function useUnpricedModelCount() {
  const { settings, data } = usePricingSettings()
  const enabled = useQuery({
    queryKey: ['enabled-models'],
    queryFn: async () => requireServerSuccess(await getEnabledModels()),
  })
  return useMemo(() => {
    if (!data || !enabled.data?.data) return undefined
    const snapshots = new Map(
      buildModelSnapshots({
        modelPrice: settings.ModelPrice,
        modelRatio: settings.ModelRatio,
        cacheRatio: settings.CacheRatio,
        createCacheRatio: settings.CreateCacheRatio,
        completionRatio: settings.CompletionRatio,
        imageRatio: settings.ImageRatio,
        audioRatio: settings.AudioRatio,
        audioCompletionRatio: settings.AudioCompletionRatio,
        billingMode: settings['billing_setting.billing_mode'],
        billingExpr: settings['billing_setting.billing_expr'],
        pluginBillingExpr: settings['billing_setting.plugin_billing_expr'],
      }).map((row) => [row.name, row])
    )
    return enabled.data.data.filter((name) =>
      isBasePricingUnset(snapshots.get(name))
    ).length
  }, [data, enabled.data?.data, settings])
}

export function ModelPricingSettings(props: { variant: 'all' | 'unset' }) {
  const { t } = useTranslation()
  const { settings, isLoading, isError, refetch } = usePricingSettings()
  const [actionsContainer, setActionsContainer] =
    useState<HTMLDivElement | null>(null)

  if (isLoading) return <LoadingState />
  if (isError) {
    return (
      <ErrorState
        title={t('Failed to load settings')}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <SettingsPageProvider actionsContainer={actionsContainer}>
      <div className='flex h-full min-h-0 flex-col gap-4'>
        <div ref={setActionsContainer} className='empty:hidden' />
        <RatioSettingsCard
          modelDefaults={{
            ModelPrice: settings.ModelPrice,
            ModelRatio: settings.ModelRatio,
            CacheRatio: settings.CacheRatio,
            CreateCacheRatio: settings.CreateCacheRatio,
            CompletionRatio: settings.CompletionRatio,
            ImageRatio: settings.ImageRatio,
            AudioRatio: settings.AudioRatio,
            AudioCompletionRatio: settings.AudioCompletionRatio,
            ExposeRatioEnabled: settings.ExposeRatioEnabled,
            BillingMode: settings['billing_setting.billing_mode'],
            BillingExpr: settings['billing_setting.billing_expr'],
            PluginBillingExpr: settings['billing_setting.plugin_billing_expr'],
          }}
          groupDefaults={{
            TopupGroupRatio: settings.TopupGroupRatio,
            GroupRatio: settings.GroupRatio,
            UserUsableGroups: settings.UserUsableGroups,
            GroupGroupRatio: settings.GroupGroupRatio,
            AutoGroups: settings.AutoGroups,
            MaxTokenAutoGroups: settings.MaxTokenAutoGroups,
            DefaultUseAutoGroup: settings.DefaultUseAutoGroup,
            GroupSpecialUsableGroup:
              settings['group_ratio_setting.group_special_usable_group'],
          }}
          toolPricesDefault={settings['tool_price_setting.prices']}
          visibleTabs={
            props.variant === 'unset' ? ['unset-models'] : ['models']
          }
        />
      </div>
    </SettingsPageProvider>
  )
}
