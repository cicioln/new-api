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
import type { TFunction } from 'i18next'
import { Power, PowerOff, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { formatQuota } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getAdminPlans } from '../api'
import { formatDuration, formatResetPeriod } from '../lib'
import type {
  PlanRecord,
  SubscriptionPlan,
  SubscriptionsDialogType,
} from '../types'
import { useSubscriptions } from './subscriptions-provider'

const tagClass =
  'inline-flex h-[22px] items-center rounded-md px-2 text-[12px] font-medium whitespace-nowrap'

const PERIOD_SUFFIX_KEYS: Record<string, string> = {
  year: '/ year',
  month: '/ month',
  day: '/ day',
  hour: '/ hour',
}

function getPeriodSuffix(plan: SubscriptionPlan, t: TFunction) {
  const key = PERIOD_SUFFIX_KEYS[plan.duration_unit]
  if (key && plan.duration_value === 1) return t(key)
  return `/ ${formatDuration(plan, t)}`
}

function getBillingLabel(plan: SubscriptionPlan, t: TFunction) {
  if (plan.duration_value === 1 && plan.duration_unit === 'month') {
    return t('Billed monthly')
  }
  if (plan.duration_value === 1 && plan.duration_unit === 'year') {
    return t('Billed yearly')
  }
  return formatDuration(plan, t)
}

function getQuotaFeature(plan: SubscriptionPlan, t: TFunction) {
  const total = Number(plan.total_amount || 0)
  if (total <= 0) return t('Unlimited quota')
  if (plan.quota_reset_period === 'never') {
    return t('{{amount}} total quota', { amount: formatQuota(total) })
  }
  return t('{{period}} {{amount}} quota', {
    period: formatResetPeriod(plan, t),
    amount: formatQuota(total),
  })
}

function getPlanFeatures(plan: SubscriptionPlan, t: TFunction) {
  const features = [getQuotaFeature(plan, t)]
  if (plan.subtitle) features.unshift(plan.subtitle)
  if (plan.upgrade_group) {
    features.push(t('{{group}} group', { group: plan.upgrade_group }))
  }
  if (plan.max_purchase_per_user > 0) {
    features.push(
      t('Up to {{count}} per user', { count: plan.max_purchase_per_user })
    )
  }
  return features
}

/** The most subscribed enabled plan is highlighted, matching the design. */
function getHighlightedPlanId(records: PlanRecord[]) {
  if (records.length < 2) return undefined
  let best: PlanRecord | undefined
  for (const record of records) {
    if (!record.plan.enabled) continue
    if ((record.subscriber_count ?? 0) > (best?.subscriber_count ?? 0)) {
      best = record
    }
  }
  return best?.plan.id
}

function PlanTag(props: { plan: SubscriptionPlan; highlighted: boolean }) {
  const { t } = useTranslation()
  if (props.plan.enabled && props.highlighted) {
    return (
      <span className={cn(tagClass, 'bg-primary/10 text-primary')}>
        {t('Recommended')}
      </span>
    )
  }
  return (
    <span className={cn(tagClass, 'bg-muted text-muted-foreground')}>
      {props.plan.enabled ? getBillingLabel(props.plan, t) : t('Disabled')}
    </span>
  )
}

function PlanCard(props: { record: PlanRecord; highlighted: boolean }) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow, complianceConfirmed } = useSubscriptions()
  const plan = props.record.plan

  const openDialog = (dialog: SubscriptionsDialogType) => {
    setCurrentRow(props.record)
    setOpen(dialog)
  }

  return (
    <article
      data-slot='subscription-plan-card'
      className={cn(
        'bg-card flex flex-col gap-3 rounded-lg border p-5',
        props.highlighted && 'border-primary ring-primary/15 ring-[3px]',
        !plan.enabled && 'opacity-70'
      )}
    >
      <h3 className='flex items-center justify-between gap-2 text-[15px] font-semibold'>
        <span className='truncate'>{plan.title}</span>
        <PlanTag plan={plan} highlighted={props.highlighted} />
      </h3>
      <div className='text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] tabular-nums'>
        {formatBillingCurrencyFromUSD(Number(plan.price_amount || 0))}
        <small className='text-subtle-foreground ml-1 text-[15px] font-medium'>
          {getPeriodSuffix(plan, t)}
        </small>
      </div>
      <ul className='text-muted-foreground grid gap-1.5 text-[13px]'>
        {getPlanFeatures(plan, t).map((feature) => (
          <li key={feature} className='flex gap-2'>
            <span className='text-success' aria-hidden='true'>
              ✓
            </span>
            <span className='min-w-0'>{feature}</span>
          </li>
        ))}
      </ul>
      <div className='text-subtle-foreground mt-auto flex items-center justify-between border-t pt-3 text-[12.5px]'>
        <span>
          {t('{{count}} subscribers', {
            count: props.record.subscriber_count ?? 0,
          })}
        </span>
        <div className='flex items-center gap-1'>
          <Button
            size='sm'
            variant='outline'
            disabled={!complianceConfirmed}
            onClick={() => openDialog('update')}
          >
            {t('Edit')}
          </Button>
          <DataTableRowActionMenu ariaLabel={t('More actions')} modal={false}>
            <DropdownMenuItem
              disabled={!complianceConfirmed}
              onClick={() => openDialog('reset-subscriptions')}
            >
              {t('Reset subscription quota')}
              <DropdownMenuShortcut>
                <RotateCcw size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!complianceConfirmed}
              onClick={() => openDialog('toggle-status')}
              className={cn(plan.enabled && 'text-destructive')}
            >
              {t(plan.enabled ? 'Disable' : 'Enable')}
              <DropdownMenuShortcut>
                {plan.enabled ? <PowerOff size={16} /> : <Power size={16} />}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </DataTableRowActionMenu>
        </div>
      </div>
    </article>
  )
}

export function SubscriptionPlanCards() {
  const { t } = useTranslation()
  const { refreshTrigger, setOpen, complianceConfirmed } = useSubscriptions()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscription-plans', refreshTrigger],
    queryFn: async () => {
      const result = requireServerSuccess(await getAdminPlans())
      return result.data || []
    },
    placeholderData: (prev) => prev,
  })

  if (isLoading) {
    return (
      <div className='grid gap-3.5 md:grid-cols-2 xl:grid-cols-3'>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className='h-[244px] rounded-lg' />
        ))}
      </div>
    )
  }

  const records = data ?? []
  if (records.length === 0) {
    return (
      <div className='bg-card flex flex-col items-center gap-2 rounded-lg border px-6 py-10 text-center'>
        <p className='font-medium'>{t('No subscription plans yet')}</p>
        <p className='text-muted-foreground text-sm'>
          {t('Click "Create Plan" to create your first subscription plan')}
        </p>
        <Button
          size='sm'
          className='mt-2'
          disabled={!complianceConfirmed}
          onClick={() => setOpen('create')}
        >
          {t('Create Plan')}
        </Button>
      </div>
    )
  }

  const highlightedId = getHighlightedPlanId(records)
  return (
    <div className='grid gap-3.5 md:grid-cols-2 xl:grid-cols-3'>
      {records.map((record) => (
        <PlanCard
          key={record.plan.id}
          record={record}
          highlighted={record.plan.id === highlightedId}
        />
      ))}
    </div>
  )
}
