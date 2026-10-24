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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { AffiliateRewardsCard } from '../components/affiliate-rewards-card'
import { TopupRecordsCard } from '../components/topup-records-card'
import { WalletStatsCard } from '../components/wallet-stats-card'
import type { UserWalletData } from '../types'

afterEach(() => vi.restoreAllMocks())

const user = {
  quota: 0,
  used_quota: 0,
  request_count: 12,
  aff_quota: 500000,
  aff_history_quota: 500000,
  aff_count: 3,
} as UserWalletData

it('offers a transfer link only when referral rewards are pending', async () => {
  const onTransfer = vi.fn()
  const { rerender } = render(
    <WalletStatsCard user={user} onTransfer={onTransfer} />
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Transfer to Balance' })
  )
  expect(onTransfer).toHaveBeenCalledOnce()

  rerender(
    <WalletStatsCard user={{ ...user, aff_quota: 0 }} onTransfer={onTransfer} />
  )
  expect(
    screen.queryByRole('button', { name: 'Transfer to Balance' })
  ).not.toBeInTheDocument()
})

it('redeems the entered code from the redemption card', async () => {
  const onRedeem = vi.fn()
  const onCodeChange = vi.fn()
  render(
    <AffiliateRewardsCard
      user={user}
      affiliateLink='https://example.com/register?aff=abc'
      redemption={{
        enabled: true,
        code: 'CODE',
        onCodeChange,
        onRedeem,
        redeeming: false,
      }}
    />
  )
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Redemption code' }),
    'X'
  )
  expect(onCodeChange).toHaveBeenCalledWith('CODEX')
  await userEvent.click(screen.getByRole('button', { name: 'Redeem code' }))
  expect(onRedeem).toHaveBeenCalledOnce()
  expect(screen.getByText('https://example.com/register?aff=abc')).toBeVisible()
})

it('explains why redemption is unavailable instead of showing the form', () => {
  render(
    <AffiliateRewardsCard
      user={user}
      affiliateLink='link'
      redemption={{
        enabled: false,
        code: '',
        onCodeChange: vi.fn(),
        onRedeem: vi.fn(),
        redeeming: false,
      }}
    />
  )
  expect(
    screen.queryByRole('textbox', { name: 'Redemption code' })
  ).not.toBeInTheDocument()
  expect(
    screen.getByText(
      'Redemption codes are disabled until the administrator confirms compliance terms.'
    )
  ).toBeVisible()
})

it('lists the latest own top-up orders and links to the full history', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        total: 8,
        items: [
          {
            id: 1,
            user_id: 1,
            status: 'success',
            amount: 10,
            money: 10,
            trade_no: 'order-1',
            payment_method: 'alipay',
            create_time: 1,
          },
        ],
      },
    },
  })
  const onOpenAll = vi.fn()
  render(<TopupRecordsCard onOpenAll={onOpenAll} />)

  const row = (await screen.findByText('order-1')).closest('tr')
  if (!row) throw new Error('row missing')
  expect(within(row).getByText('Top-up credited')).toBeVisible()
  expect(String(get.mock.calls[0][0])).toContain('/api/user/topup/self')
  await userEvent.click(screen.getByRole('button', { name: /View all/ }))
  expect(onOpenAll).toHaveBeenCalledOnce()
})

it('shows an empty state without top-up orders', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { total: 0, items: [] } },
  })
  render(<TopupRecordsCard onOpenAll={vi.fn()} />)
  expect(await screen.findByText('No top-up records yet')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /View all/ })
  ).not.toBeInTheDocument()
})

it('shows wallet amounts with two decimals and the invite count', () => {
  render(
    <WalletStatsCard
      user={{ ...user, quota: 64200000, used_quota: 500000 }}
      onTransfer={vi.fn()}
    />
  )
  expect(screen.getByText('$128.40')).toBeVisible()
  expect(screen.getByText('Total spent')).toBeVisible()
  expect(screen.getAllByText('$1.00')).toHaveLength(2)
  expect(screen.getByText(/Invited 3 people/)).toBeVisible()
})
