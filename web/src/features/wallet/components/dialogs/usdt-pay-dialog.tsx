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
import i18next from 'i18next'
import { CheckCircle2, Clock, Loader2, TriangleAlert } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { getUsdtOrder, isApiSuccess, requestUsdtPayment } from '../../api'
import type { UsdtChainInfo, UsdtOrder } from '../../types'

const POLL_INTERVAL_MS = 5000

/**
 * USDT checkout: pick a receiving address, then transfer the exact amount to the shown
 * address. The dialog polls the order until the backend sees the transfer.
 */
export function UsdtPayDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  topupAmount: number
  chains: UsdtChainInfo[]
  onPaid: () => void
}) {
  const { t } = useTranslation()
  const [pickedAddress, setAddress] = useState<string>()
  // Top-up info may load after mount, so fall back to the first address lazily.
  const address = pickedAddress ?? props.chains[0]?.address
  const [order, setOrder] = useState<UsdtOrder | null>(null)
  const [creating, setCreating] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const orderQuery = useQuery({
    queryKey: ['usdt-order', order?.trade_no],
    queryFn: async () => {
      const res = await getUsdtOrder(order?.trade_no ?? '')
      const next = isApiSuccess(res) ? res.data : undefined
      // Polling stops once the order leaves pending, so onPaid fires once.
      if (next && next.status !== 'pending') {
        setOrder(next)
        if (next.status === 'paid') props.onPaid()
      }
      return next ?? null
    },
    enabled: props.open && order?.status === 'pending',
    refetchInterval: POLL_INTERVAL_MS,
    meta: { errorToast: false },
  })
  const current =
    order?.status === 'pending' ? (orderQuery.data ?? order) : order
  const status = current?.status

  useEffect(() => {
    if (!props.open || status !== 'pending') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [props.open, status])

  const handleOpenChange = (open: boolean) => {
    props.onOpenChange(open)
    if (!open) setOrder(null)
  }

  const handleCreate = async () => {
    if (!address) return
    setCreating(true)
    try {
      const res = await requestUsdtPayment({
        amount: Math.floor(props.topupAmount),
        address,
      })
      if (!isApiSuccess(res) || !res.data) {
        handleServerError(res, i18next.t('Payment request failed'))
        return
      }
      setNow(Date.now())
      setOrder(res.data)
    } catch (error) {
      handleServerError(error, i18next.t('Payment request failed'))
    } finally {
      setCreating(false)
    }
  }

  const receiver = props.chains.find((c) => c.address === current?.address)
  const secondsLeft = current
    ? Math.max(0, current.expire_at - Math.floor(now / 1000))
    : 0
  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`

  let body: React.ReactNode
  if (!current) {
    body = (
      <div className='grid gap-4'>
        <div
          role='radiogroup'
          aria-label={t('Network')}
          className='grid gap-2 sm:grid-cols-2'
        >
          {props.chains.map((option) => {
            const selected = option.address === address
            return (
              <button
                key={option.address}
                type='button'
                role='radio'
                aria-checked={selected}
                onClick={() => setAddress(option.address)}
                className={cn(
                  'rounded-lg border px-4 py-3 text-left transition-colors',
                  selected
                    ? 'border-foreground bg-muted/60'
                    : 'hover:bg-muted/40'
                )}
              >
                <b className='block text-sm font-semibold'>{option.name}</b>
                <small className='text-muted-foreground block truncate font-mono text-xs'>
                  {option.address.slice(0, 8)}…{option.address.slice(-6)}
                </small>
              </button>
            )
          })}
        </div>
        <p className='text-muted-foreground text-[13px]'>
          {t(
            'After creating the order you will get an exact USDT amount and a receiving address. Transfer within the time limit and the balance is credited automatically.'
          )}
        </p>
      </div>
    )
  } else if (status === 'paid') {
    body = (
      <div className='grid justify-items-center gap-2 py-8 text-center'>
        <CheckCircle2 aria-hidden className='text-success size-12' />
        <b className='text-lg'>{t('Payment received')}</b>
        <p className='text-muted-foreground text-sm'>
          {t('Your balance has been credited.')}
        </p>
      </div>
    )
  } else if (status === 'expired' || secondsLeft === 0) {
    body = (
      <div className='grid justify-items-center gap-2 py-8 text-center'>
        <Clock aria-hidden className='text-muted-foreground size-12' />
        <b className='text-lg'>{t('Order expired')}</b>
        <p className='text-muted-foreground text-sm'>
          {t(
            'If you already transferred, contact the administrator with the transaction hash.'
          )}
        </p>
      </div>
    )
  } else {
    body = (
      <div className='grid gap-4'>
        <div className='grid justify-items-center gap-3'>
          <div className='rounded-xl border bg-white p-3'>
            <QRCodeSVG value={current.address} size={176} />
          </div>
          <span className='text-muted-foreground inline-flex items-center gap-1.5 text-[13px]'>
            <Loader2 aria-hidden className='size-3.5 animate-spin' />
            {t('Waiting for payment')} · {countdown}
          </span>
        </div>
        <dl className='grid gap-3 text-sm'>
          <div className='bg-muted/50 rounded-lg px-3.5 py-2.5'>
            <dt className='text-muted-foreground text-xs'>{t('Network')}</dt>
            <dd className='mt-0.5 font-medium'>
              {receiver?.name ?? current.chain}
            </dd>
          </div>
          <div className='bg-muted/50 flex items-center gap-2 rounded-lg px-3.5 py-2.5'>
            <div className='min-w-0 flex-1'>
              <dt className='text-muted-foreground text-xs'>
                {t('Transfer amount')}
              </dt>
              <dd className='mt-0.5 font-mono text-xl font-semibold tabular-nums'>
                {current.pay_amount}{' '}
                <span className='text-muted-foreground text-sm'>USDT</span>
              </dd>
            </div>
            <CopyButton
              value={current.pay_amount}
              aria-label={t('Copy amount')}
            />
          </div>
          <div className='bg-muted/50 flex items-center gap-2 rounded-lg px-3.5 py-2.5'>
            <div className='min-w-0 flex-1'>
              <dt className='text-muted-foreground text-xs'>
                {t('Receiving address')}
              </dt>
              <dd className='mt-0.5 font-mono text-[13px] break-all'>
                {current.address}
              </dd>
            </div>
            <CopyButton
              value={current.address}
              aria-label={t('Copy address')}
            />
          </div>
        </dl>
        <Alert variant='destructive'>
          <TriangleAlert aria-hidden />
          <AlertDescription>
            {t(
              'Transfer exactly {{amount}} USDT on {{network}}. A different amount or network cannot be credited automatically.',
              {
                amount: current.pay_amount,
                network: receiver?.name ?? current.chain,
              }
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('Pay with USDT')}
      contentClassName='sm:max-w-md'
      footer={
        current ? (
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            {t('Close')}
          </Button>
        ) : (
          <Button disabled={!address || creating} onClick={handleCreate}>
            {creating && <Loader2 className='size-4 animate-spin' />}
            {t('Create order')}
          </Button>
        )
      }
    >
      {body}
    </Dialog>
  )
}
