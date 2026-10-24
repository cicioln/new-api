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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { beforeEach, expect, it, vi } from 'vitest'

import { BillingHistoryDialog } from '@/features/wallet/components/dialogs/billing-history-dialog'
import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import { RechargeFormCard } from '../components/recharge-form-card'

const i18n = createInstance()

beforeEach(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'zh',
    fallbackLng: false,
    nsSeparator: false,
    resources: { en, zh },
    interpolation: { escapeValue: false },
  })
})

it('translates billing history statuses and updates them when the language changes', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        total: 3,
        items: ['success', 'pending', 'expired'].map((status, id) => ({
          id,
          status,
          amount: 10,
          money: 10,
          trade_no: `order-${id}`,
          payment_method: 'stripe',
          create_time: 1,
        })),
      },
    },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <BillingHistoryDialog open onOpenChange={vi.fn()} />
    </I18nextProvider>
  )
  await screen.findByText('order-0')
  for (const label of ['成功', '待确认', '已过期']) {
    expect(screen.getByText(label)).toBeVisible()
  }
  await act(() => i18n.changeLanguage('en'))
  for (const label of ['Success', 'Pending', 'Expired']) {
    expect(screen.getByText(label)).toBeVisible()
  }
})

function renderRechargeCard(
  overrides: Partial<Parameters<typeof RechargeFormCard>[0]> = {}
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <RechargeFormCard
        topupInfo={{
          enable_online_topup: true,
          enable_stripe_topup: false,
          pay_methods: [
            { name: '支付宝', type: 'alipay' },
            { name: 'Stripe', type: 'stripe', min_topup: 50 },
          ],
          min_topup: 1,
          stripe_min_topup: 1,
          amount_options: [100, 20],
          discount: {},
        }}
        presetAmounts={[{ value: 100, discount: 0.8 }, { value: 20 }]}
        selectedPreset={null}
        topupAmount={20}
        paymentAmount={20}
        calculating={false}
        paymentLoading={null}
        redemptionCode=''
        redeeming={false}
        onSelectPreset={vi.fn()}
        onTopupAmountChange={vi.fn()}
        onPaymentMethodSelect={vi.fn()}
        onRedemptionCodeChange={vi.fn()}
        onRedeem={vi.fn()}
        {...overrides}
      />
    </I18nextProvider>
  )
}

it('labels presets with the credited amount or bonus and translates them', async () => {
  renderRechargeCard()
  expect(screen.getByRole('button', { name: /^\$100\.00/ })).toHaveTextContent(
    '$100.00赠送 20%'
  )
  expect(screen.getByRole('button', { name: /^\$20\.00/ })).toHaveTextContent(
    '$20.00到账 $20.00'
  )
  expect(screen.getByRole('button', { name: /^自定义/ })).toHaveTextContent(
    '自定义最低 $1.00'
  )
  await act(() => i18n.changeLanguage('en'))
  expect(screen.getByRole('button', { name: /^\$100\.00/ })).toHaveTextContent(
    '$100.00Bonus 20%'
  )
  expect(screen.getByRole('button', { name: /^\$20\.00/ })).toHaveTextContent(
    '$20.00Credited $20.00'
  )
})

it('reveals the custom amount input only after choosing the custom tile', async () => {
  renderRechargeCard()
  expect(screen.queryByPlaceholderText('最低 1')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^自定义/ }))
  expect(screen.getByRole('button', { name: /^自定义/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(screen.getByPlaceholderText('最低 1')).toBeVisible()
})

it('selects a payment method first and pays with it via the pay button', async () => {
  const onPaymentMethodSelect = vi.fn()
  renderRechargeCard({ onPaymentMethodSelect, topupAmount: 60 })
  const alipay = screen.getByRole('button', { name: '支付宝' })
  const stripe = screen.getByRole('button', { name: 'Stripe' })
  expect(alipay).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(stripe)
  expect(onPaymentMethodSelect).not.toHaveBeenCalled()
  expect(stripe).toHaveAttribute('aria-pressed', 'true')
  expect(alipay).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(screen.getByRole('button', { name: '去支付' }))
  expect(onPaymentMethodSelect).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'stripe' })
  )
})

it('disables methods below their minimum and keeps the pay button in sync', () => {
  renderRechargeCard({ topupAmount: 20 })
  expect(screen.getByRole('button', { name: /^Stripe\. / })).toBeDisabled()
  expect(screen.getByRole('button', { name: '去支付' })).toBeEnabled()
})
