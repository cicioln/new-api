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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Dialog } from '@/components/dialog'
import { ReactIconByName } from '@/components/react-icon-by-name'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const createPaymentMethodDialogSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Payment method name is required')),
    type: z.string().min(1, t('Payment type key is required')),
    icon: z.string().optional(),
    min_topup: z.string().optional(),
    rate_kind: z.enum(['none', 'bonus', 'fee']),
    rate: z
      .string()
      .optional()
      .refine(
        (value) => {
          if (!value || value.trim() === '') return true
          const rate = Number(value)
          return (
            Number.isFinite(rate) &&
            rate >= 0 &&
            rate <= 100 &&
            /^\d+(\.\d{1,2})?$/.test(value.trim())
          )
        },
        t('Enter a percentage between 0 and 100 with up to 2 decimals')
      ),
  })

type PaymentMethodDialogFormValues = z.infer<
  ReturnType<typeof createPaymentMethodDialogSchema>
>

const PAYMENT_METHOD_FORM_ID = 'payment-method-form'

export type PaymentMethodData = {
  name: string
  type: string
  icon?: string
  min_topup?: string
  color?: string
  bonus_rate?: string
  fee_rate?: string
}

/** Payment types with their own checkout; bonus and fee do not apply to them. */
export const RATELESS_PAYMENT_TYPES = new Set([
  'stripe',
  'waffo',
  'waffo_pancake',
  'usdt',
])

type PaymentMethodDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: PaymentMethodData) => void
  editData?: PaymentMethodData | null
}

const PAYMENT_TYPE_ICON_NAMES: Record<string, string> = {
  alipay: 'SiAlipay',
  stripe: 'SiStripe',
  waffo_pancake: 'LuCreditCard',
  wxpay: 'SiWechat',
}

const getDefaultIconName = (type: string) => PAYMENT_TYPE_ICON_NAMES[type] ?? ''

export function PaymentMethodDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: PaymentMethodDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!editData
  const paymentMethodDialogSchema = createPaymentMethodDialogSchema(t)
  const paymentTypeOptions = [
    {
      iconName: 'SiAlipay',
      label: `${t('Alipay')} (Epay: alipay)`,
      name: t('Alipay'),
      value: 'alipay',
    },
    {
      iconName: 'SiWechat',
      label: `${t('WeChat Pay')} (Epay: wxpay)`,
      name: t('WeChat Pay'),
      value: 'wxpay',
    },
    {
      iconName: 'SiStripe',
      label: `${t('Stripe')} (stripe)`,
      name: t('Stripe'),
      value: 'stripe',
    },
    {
      iconName: 'LuCreditCard',
      label: 'Waffo Pancake (waffo_pancake)',
      name: 'Waffo Pancake',
      value: 'waffo_pancake',
    },
  ]
  const getPaymentTypeOption = (value: string) =>
    paymentTypeOptions.find((option) => option.value === value)

  const form = useForm<PaymentMethodDialogFormValues>({
    resolver: zodResolver(paymentMethodDialogSchema),
    defaultValues: {
      name: '',
      type: '',
      icon: '',
      min_topup: '',
      rate_kind: 'none',
      rate: '',
    },
  })

  const iconValue = form.watch('icon')
  const typeValue = form.watch('type')
  const rateKind = form.watch('rate_kind')
  const ratesSupported = !RATELESS_PAYMENT_TYPES.has(typeValue)

  useEffect(() => {
    if (editData) {
      const bonus = Number(editData.bonus_rate) > 0 ? editData.bonus_rate : ''
      const fee = Number(editData.fee_rate) > 0 ? editData.fee_rate : ''
      form.reset({
        name: editData.name,
        type: editData.type,
        icon: editData.icon ?? getDefaultIconName(editData.type),
        min_topup: editData.min_topup ?? '',
        rate_kind: bonus ? 'bonus' : fee ? 'fee' : 'none',
        rate: bonus || fee || '',
      })
    } else {
      form.reset({
        name: '',
        type: '',
        icon: '',
        min_topup: '',
        rate_kind: 'none',
        rate: '',
      })
    }
  }, [editData, form, open])

  const handleSubmit = (values: PaymentMethodDialogFormValues) => {
    // Keep keys the dialog does not edit (e.g. color)
    const data: PaymentMethodData = {
      ...editData,
      name: values.name,
      type: values.type,
    }
    delete data.icon
    delete data.min_topup
    delete data.bonus_rate
    delete data.fee_rate
    if (values.icon && values.icon.trim() !== '') {
      data.icon = values.icon.trim()
    }
    if (values.min_topup && values.min_topup.trim() !== '') {
      data.min_topup = values.min_topup
    }
    const rate = values.rate?.trim() ?? ''
    if (ratesSupported && rate !== '' && Number(rate) > 0) {
      if (values.rate_kind === 'bonus') data.bonus_rate = rate
      if (values.rate_kind === 'fee') data.fee_rate = rate
    }
    onSave(data)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? t('Edit payment method') : t('Add payment method')}
      description={t('Configure a payment method for user recharge options.')}
      contentClassName='sm:max-w-[500px]'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={PAYMENT_METHOD_FORM_ID}>
            {isEditMode ? t('Update') : t('Add')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={PAYMENT_METHOD_FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('e.g., Alipay, WeChat')} {...field} />
                </FormControl>
                <FormDescription>
                  {t('Display name for this payment method.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Payment type key')}</FormLabel>
                <FormControl>
                  <Combobox
                    options={paymentTypeOptions}
                    value={field.value}
                    onValueChange={(value) => {
                      if (value === null) return
                      const currentIcon = form.getValues('icon')?.trim()
                      const currentName = form.getValues('name')?.trim()
                      const previousOption = getPaymentTypeOption(field.value)
                      const nextOption = getPaymentTypeOption(value)

                      field.onChange(value)
                      if (
                        nextOption?.iconName &&
                        (!currentIcon ||
                          currentIcon === previousOption?.iconName)
                      ) {
                        form.setValue('icon', nextOption.iconName, {
                          shouldDirty: true,
                        })
                      }
                      if (
                        nextOption?.name &&
                        (!currentName || currentName === previousOption?.name)
                      ) {
                        form.setValue('name', nextOption.name, {
                          shouldDirty: true,
                        })
                      }
                    }}
                    placeholder={t('Select or enter payment type key')}
                    searchPlaceholder={t('Search payment type keys...')}
                    allowCustomValue
                  />
                </FormControl>
                <FormDescription className='leading-relaxed'>
                  {t(
                    'Used to decide the payment flow. Built-in keys include stripe for Stripe and waffo_pancake for Waffo Pancake; other values are sent to Epay as the type parameter.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='icon'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Icon')}</FormLabel>
                <FormControl>
                  <div className='flex items-center gap-2'>
                    <Input
                      placeholder={t('e.g., SiAlipay')}
                      {...field}
                      className='flex-1'
                    />
                    {iconValue && (
                      <ReactIconByName
                        name={iconValue}
                        className='text-muted-foreground size-5 shrink-0'
                        title={iconValue}
                      />
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  {t(
                    'Enter a react-icons component name. Invalid names show no icon.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='min_topup'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Minimum top-up (optional)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    step='0.01'
                    placeholder={t('e.g., 50')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('Optional minimum recharge amount for this method.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {ratesSupported && (
            <div className='space-y-3'>
              <FormField
                control={form.control}
                name='rate_kind'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Bonus or fee')}</FormLabel>
                    <FormControl>
                      <div className='inline-flex overflow-hidden rounded-md border text-sm'>
                        {(
                          [
                            ['none', t('None')],
                            ['bonus', t('Top-up bonus')],
                            ['fee', t('Channel fee')],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type='button'
                            aria-pressed={field.value === value}
                            onClick={() => field.onChange(value)}
                            className={
                              field.value === value
                                ? 'bg-foreground text-background px-3 py-1.5'
                                : 'hover:bg-muted px-3 py-1.5'
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              {rateKind !== 'none' && (
                <FormField
                  control={form.control}
                  name='rate'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className='relative'>
                          <Input
                            type='number'
                            step='0.01'
                            min='0'
                            max='100'
                            placeholder={t('e.g., 2')}
                            className='pr-8'
                            {...field}
                          />
                          <span className='text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm'>
                            %
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription>
                        {rateKind === 'bonus'
                          ? t(
                              'Extra quota credited on top of the top-up amount. Shown as a badge on the payment method.'
                            )
                          : t(
                              'Added to the amount the user pays; the credited amount is unchanged.'
                            )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}
        </form>
      </Form>
    </Dialog>
  )
}
