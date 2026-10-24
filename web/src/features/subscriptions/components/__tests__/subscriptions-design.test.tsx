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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'

import type {
  AdminUserSubscription,
  PlanRecord,
  SubscriptionPlan,
} from '../../types'
import { SubscribersTable } from '../subscribers-table'
import { SubscriptionPlanCards } from '../subscription-plan-cards'
import { SubscriptionsProvider } from '../subscriptions-provider'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

const now = Math.floor(Date.now() / 1000)

function plan(overrides: Partial<SubscriptionPlan>): SubscriptionPlan {
  return {
    id: 1,
    title: 'Basic',
    price_amount: 9,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    quota_reset_period: 'never',
    enabled: true,
    sort_order: 0,
    allow_balance_pay: true,
    allow_wallet_overflow: true,
    max_purchase_per_user: 0,
    total_amount: 0,
    ...overrides,
  }
}

function subscription(
  overrides: Partial<AdminUserSubscription>
): AdminUserSubscription {
  return {
    id: 1,
    user_id: 1,
    plan_id: 1,
    status: 'active',
    start_time: now - 86400,
    end_time: now + 86400,
    amount_total: 1000,
    amount_used: 250,
    username: 'lin_w',
    plan_title: 'Pro',
    ...overrides,
  }
}

function mockApi(responses: Record<string, unknown>) {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    const path = String(url).split('?')[0]
    return { data: { success: true, data: responses[path] ?? [] } }
  })
}

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <SubscriptionsProvider>{ui}</SubscriptionsProvider>
        </TooltipProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('highlights the most subscribed enabled plan as recommended', async () => {
  const records: PlanRecord[] = [
    { plan: plan({ id: 1, title: 'Basic' }), subscriber_count: 3 },
    {
      plan: plan({ id: 2, title: 'Pro', total_amount: 500000 }),
      subscriber_count: 12,
    },
    {
      plan: plan({ id: 3, title: 'Team', enabled: false }),
      subscriber_count: 40,
    },
  ]
  mockApi({ '/api/subscription/admin/plans': records })

  renderWithProviders(<SubscriptionPlanCards />)

  const pro = (await screen.findByText('Pro')).closest('article') as HTMLElement
  expect(pro).toHaveClass('border-primary')
  expect(within(pro).getByText('Recommended')).toBeInTheDocument()
  expect(within(pro).getByText('12 subscribers')).toBeInTheDocument()
  const basic = screen.getByText('Basic').closest('article') as HTMLElement
  expect(within(basic).getByText('Billed monthly')).toBeInTheDocument()
  expect(within(basic).getByText('Unlimited quota')).toBeInTheDocument()
  const team = screen.getByText('Team').closest('article') as HTMLElement
  expect(within(team).getByText('Disabled')).toBeInTheDocument()
})

it('shows the create action when there are no plans', async () => {
  mockApi({ '/api/subscription/admin/plans': [] })

  renderWithProviders(<SubscriptionPlanCards />)

  expect(
    await screen.findByText('No subscription plans yet')
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create Plan' })).toBeVisible()
})

it('lists subscribers with quota usage and status tags', async () => {
  mockApi({
    '/api/subscription/admin/user_subscriptions': {
      items: [
        subscription({ id: 3 }),
        subscription({
          id: 2,
          username: '',
          user_id: 9,
          amount_total: 0,
          end_time: now - 60,
        }),
        subscription({ id: 1, username: 'ada', status: 'cancelled' }),
      ],
      total: 3,
    },
  })

  renderWithProviders(<SubscribersTable />)

  expect(await screen.findByText('lin_w', {}, { timeout: 3000 })).toBeVisible()
  expect(screen.getByText('User 9')).toBeInTheDocument()
  expect(
    screen.getAllByRole('progressbar', { name: 'Used percentage' })[0]
  ).toHaveAttribute('aria-valuenow', '25')
  expect(screen.getByText('Unlimited')).toBeInTheDocument()
  expect(screen.getByText('Active')).toHaveClass('text-success')
  expect(screen.getByText('Expired')).toBeInTheDocument()
  expect(screen.getByText('Cancelled')).toBeInTheDocument()
})
