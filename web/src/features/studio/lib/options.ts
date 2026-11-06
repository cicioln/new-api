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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { getUserGroups, getUserModels } from '@/features/playground/api'
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import { usePricingData } from '@/features/pricing/hooks'
import type { PricingModel } from '@/features/pricing/types'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { requireServerSuccess } from '@/lib/server-error-message'

export type StudioKind = 'image' | 'video'

const KIND_ENDPOINT: Record<StudioKind, string> = {
  image: 'image-generation',
  video: 'openai-video',
}

export const MAX_REFERENCE_IMAGES = 4
export const MAX_REFERENCE_BYTES = 10 * 1024 * 1024

/**
 * The user's groups that offer at least one model of this kind, and the
 * selected one. A group qualifies when a model with the kind's endpoint is
 * enabled in it; "auto" qualifies when any other listed group does.
 */
export function useStudioGroups(kind: StudioKind) {
  const pricing = usePricingData()
  const { data: userGroups = [], isLoading } = useQuery({
    queryKey: ['playground-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
  })
  const groups = useMemo(() => {
    const enabled = new Set<string>()
    for (const model of pricing.models) {
      if (!(model.supported_endpoint_types ?? []).includes(KIND_ENDPOINT[kind]))
        continue
      for (const group of model.enable_groups ?? []) enabled.add(group)
    }
    const direct = userGroups.filter((item) => enabled.has(item.value))
    return userGroups.filter(
      (item) =>
        enabled.has(item.value) || (item.value === 'auto' && direct.length > 0)
    )
  }, [pricing.models, userGroups, kind])

  const [group, setGroup] = useState('')
  useEffect(() => {
    if (groups.some((item) => item.value === group)) return
    setGroup(
      groups.find((item) => item.value === 'default')?.value ??
        groups[0]?.value ??
        ''
    )
  }, [groups, group])
  return {
    groups,
    group,
    setGroup,
    isLoading: isLoading || pricing.isLoading,
  }
}

/** Models of one kind the user can call in the group, with their pricing. */
export function useStudioModels(kind: StudioKind, group: string) {
  const pricing = usePricingData()
  const { data: userModels = [], isLoading } = useQuery({
    queryKey: ['playground-models', group],
    queryFn: async () => requireServerSuccess(await getUserModels(group)),
    enabled: group !== '',
  })
  const models = useMemo(() => {
    const byName = new Map(pricing.models.map((m) => [m.model_name, m]))
    return userModels
      .map((option) => byName.get(option.value))
      .filter(
        (model): model is PricingModel =>
          model != null &&
          (model.supported_endpoint_types ?? []).includes(KIND_ENDPOINT[kind])
      )
  }, [pricing.models, userModels, kind])

  const [modelName, setModelName] = useState('')
  useEffect(() => {
    if (models.length === 0 || models.some((m) => m.model_name === modelName))
      return
    setModelName(models[0].model_name)
  }, [models, modelName])

  const model = models.find((m) => m.model_name === modelName)
  const groupRatio = pricing.groupRatio[group] ?? 1
  return {
    models,
    model,
    modelName,
    setModelName,
    isLoading: isLoading || pricing.isLoading,
    /** Formatted estimate for `count` calls, or undefined for usage billing. */
    estimate: (count: number) =>
      model && model.quota_type === QUOTA_TYPE_VALUES.REQUEST
        ? formatBillingCurrencyFromUSD(
            (model.model_price ?? 0) * groupRatio * count,
            { digitsLarge: 4, digitsSmall: 4, abbreviate: false }
          )
        : undefined,
  }
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
