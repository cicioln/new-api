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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { PasswordInput } from '@/components/password-input'
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
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const optionalAddress = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || pattern.test(value), { message })

const schema = z.object({
  enabled: z.boolean(),
  bscAddress: optionalAddress(/^0x[0-9a-fA-F]{40}$/, 'Invalid BSC address'),
  aptosAddress: optionalAddress(
    /^0x[0-9a-fA-F]{1,64}$/,
    'Invalid Aptos address'
  ),
  rate: z.coerce.number().positive(),
  timeoutMinutes: z.coerce.number().int().min(5).max(1440),
  bscRpc: z.string().trim().url(),
  bscConfirmations: z.coerce.number().int().min(0).max(100),
  aptosIndexer: z.string().trim().url(),
  aptosAsset: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{1,64}$/),
  aptosApiKey: z.string().trim(),
})

type Values = z.infer<typeof schema>

const OPTION_KEYS: Record<Exclude<keyof Values, 'aptosApiKey'>, string> = {
  enabled: 'payment_setting.usdt_enabled',
  bscAddress: 'payment_setting.usdt_bsc_address',
  aptosAddress: 'payment_setting.usdt_aptos_address',
  rate: 'payment_setting.usdt_rate',
  timeoutMinutes: 'payment_setting.usdt_order_timeout_minutes',
  bscRpc: 'payment_setting.usdt_bsc_rpc',
  bscConfirmations: 'payment_setting.usdt_bsc_confirmations',
  aptosIndexer: 'payment_setting.usdt_aptos_indexer',
  aptosAsset: 'payment_setting.usdt_aptos_asset',
}

export function UsdtSettingsSection(props: {
  defaultValues: Omit<Values, 'aptosApiKey'>
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: { ...props.defaultValues, aptosApiKey: '' },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const saving = updateOption.isPending || isSubmitting

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []
    for (const field of Object.keys(OPTION_KEYS) as Array<
      keyof typeof OPTION_KEYS
    >) {
      if (values[field] !== props.defaultValues[field]) {
        updates.push({ key: OPTION_KEYS[field], value: String(values[field]) })
      }
    }
    // The API key is never sent back to the browser; only save a new one.
    if (values.aptosApiKey) {
      updates.push({
        key: 'payment_setting.usdt_aptos_api_key',
        value: values.aptosApiKey,
      })
    }
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    form.reset({ ...values, aptosApiKey: '' })
  }

  const textField = (
    name: Exclude<keyof Values, 'enabled'>,
    label: string,
    description: string,
    placeholder?: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={String(field.value ?? '')}
              placeholder={placeholder}
              className='font-mono'
            />
          </FormControl>
          <FormDescription>{t(description)}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <SettingsSection title={t('USDT Payments')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={saving}
            isSaveDisabled={!isDirty}
            saveLabel='Save USDT settings'
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable USDT payments')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Users transfer a unique USDT amount to your address; transfers are confirmed on-chain and credited automatically.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={saving}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <>
              <div className='grid gap-6 sm:grid-cols-2'>
                {textField(
                  'bscAddress',
                  'BSC receiving address',
                  'BEP20 USDT is sent here. Leave empty to hide BSC.',
                  '0x…'
                )}
                {textField(
                  'aptosAddress',
                  'Aptos receiving address',
                  'Aptos USDt is sent here. Leave empty to hide Aptos.',
                  '0x…'
                )}
                {textField(
                  'rate',
                  'USDT exchange rate',
                  'How much of the top-up price currency one USDT is worth, e.g. 7.2 when prices are in CNY.'
                )}
                {textField(
                  'timeoutMinutes',
                  'Order timeout (minutes)',
                  'Unpaid orders close after this time.'
                )}
              </div>
              <div className='grid gap-6 sm:grid-cols-2'>
                {textField(
                  'bscRpc',
                  'BSC RPC endpoint',
                  'A paid or self-hosted node avoids public rate limits.'
                )}
                {textField(
                  'bscConfirmations',
                  'BSC confirmations',
                  'Blocks to wait before a transfer counts as paid.'
                )}
                {textField(
                  'aptosIndexer',
                  'Aptos indexer GraphQL endpoint',
                  'Used to look up incoming USDt transfers.'
                )}
                {textField(
                  'aptosAsset',
                  'Aptos USDt asset address',
                  'Fungible asset metadata address of USDt on Aptos.'
                )}
                <FormField
                  control={form.control}
                  name='aptosApiKey'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Aptos API key')}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          {...field}
                          placeholder={t('Leave empty to keep the current key')}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Optional. Raises the indexer rate limit for Aptos Build keys.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
