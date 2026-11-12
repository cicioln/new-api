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
import i18next from 'i18next'
import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'

import {
  calculateAmount,
  calculateStripeAmount,
  calculateWaffoAmount,
  calculateWaffoPancakeAmount,
  requestPayment,
  requestStripePayment,
  isApiSuccess,
} from '../api'
import {
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
  submitPaymentForm,
} from '../lib'
import type { AmountDetail, AmountRequest, AmountResponse } from '../types'

// ============================================================================
// Payment Hook
// ============================================================================

type AmountCalculator = (request: AmountRequest) => Promise<AmountResponse>

export interface PaymentAmountCalculators {
  regular: AmountCalculator
  stripe: AmountCalculator
  waffo: AmountCalculator
  waffoPancake: AmountCalculator
}

const defaultPaymentAmountCalculators: PaymentAmountCalculators = {
  regular: calculateAmount,
  stripe: calculateStripeAmount,
  waffo: calculateWaffoAmount,
  waffoPancake: calculateWaffoPancakeAmount,
}

export async function requestPaymentQuote(
  topupAmount: number,
  paymentType: string,
  calculators: PaymentAmountCalculators = defaultPaymentAmountCalculators
): Promise<{ amount: number; detail: AmountDetail | null }> {
  let request: AmountRequest = { amount: topupAmount }
  let calculator = calculators.regular
  if (isStripePayment(paymentType)) {
    calculator = calculators.stripe
  } else if (isWaffoPayment(paymentType)) {
    calculator = calculators.waffo
  } else if (isWaffoPancakePayment(paymentType)) {
    calculator = calculators.waffoPancake
  } else {
    // The regular endpoint applies the method's bonus and fee rates
    request = { amount: topupAmount, payment_method: paymentType }
  }

  const response = await calculator(request)
  if (!isApiSuccess(response) || !response.data) {
    return { amount: 0, detail: null }
  }

  return {
    amount: Number.parseFloat(response.data),
    detail: response.detail ?? null,
  }
}

export async function requestPaymentAmount(
  topupAmount: number,
  paymentType: string,
  calculators: PaymentAmountCalculators = defaultPaymentAmountCalculators
): Promise<number> {
  const quote = await requestPaymentQuote(topupAmount, paymentType, calculators)
  return quote.amount
}

export function usePayment() {
  const [amount, setAmount] = useState<number>(0)
  const [detail, setDetail] = useState<AmountDetail | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const requestIdRef = useRef(0)

  // Calculate payment amount
  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      // Ignore stale responses when amount or method changes quickly
      const requestId = ++requestIdRef.current
      try {
        setCalculating(true)
        const quote = await requestPaymentQuote(topupAmount, paymentType)
        if (requestId === requestIdRef.current) {
          setAmount(quote.amount)
          setDetail(quote.detail)
        }
        return quote.amount
      } catch {
        if (requestId === requestIdRef.current) {
          setAmount(0)
          setDetail(null)
        }
        return 0
      } finally {
        if (requestId === requestIdRef.current) {
          setCalculating(false)
        }
      }
    },
    []
  )

  // Process payment
  const processPayment = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setProcessing(true)

        const isStripe = isStripePayment(paymentType)

        // Stripe charges whole units; the regular gateways accept two decimals
        const response = isStripe
          ? await requestStripePayment({
              amount: Math.floor(topupAmount),
              payment_method: 'stripe',
            })
          : await requestPayment({
              amount: topupAmount,
              payment_method: paymentType,
            })

        if (!isApiSuccess(response)) {
          handleServerError(response, i18next.t('Payment request failed'))
          return false
        }

        // Handle hosted links (Stripe, and HTTP-only gateways such as Xingye
        // whose form POST from an HTTPS page triggers a browser warning)
        if (response.data?.pay_link) {
          window.open(response.data.pay_link as string, '_blank')
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        // Handle non-Stripe payment
        if (!isStripe && response.data) {
          const url = (response as unknown as { url?: string }).url
          if (url) {
            submitPaymentForm(url, response.data)
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        return false
      } catch (error) {
        handleServerError(error, i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  return {
    amount,
    detail,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
    setAmount,
  }
}
