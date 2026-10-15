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
import { z } from 'zod'

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

const schema = z.object({
  passthrough: z.boolean(),
  ratio: z.coerce
    .number()
    .positive('Usage display ratio must be a finite number greater than zero'),
})

type UsageReportingSettingsProps = {
  passthrough: boolean
  ratio: number
}

export function UsageReportingSettingsCard(props: UsageReportingSettingsProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { passthrough: props.passthrough, ratio: props.ratio },
  })
  const passthrough = form.watch('passthrough')

  useEffect(() => {
    form.reset({ passthrough: props.passthrough, ratio: props.ratio })
  }, [props.passthrough, props.ratio, form])

  const onSubmit = async (values: z.output<typeof schema>) => {
    try {
      // Save the coefficient first so a subsequent mode switch uses it immediately.
      if (values.ratio !== props.ratio) {
        await updateOption.mutateAsync({
          key: 'global.usage_display_ratio',
          value: values.ratio,
        })
      }
      if (values.passthrough !== props.passthrough) {
        await updateOption.mutateAsync({
          key: 'global.usage_passthrough_enabled',
          value: values.passthrough,
        })
      }
    } catch {
      // useUpdateOption displays the server error; retain the form for retry.
    }
  }

  return (
    <SettingsSection title={t('Usage Reporting')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={form.formState.isSubmitting}
          />
          <FormField
            control={form.control}
            name='passthrough'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Report Actual Token Usage')}</FormLabel>
                  <FormDescription>
                    {t(
                      'When enabled, return token usage at 1:1 for clients that calculate context occupancy from usage. When disabled, apply the display ratio (default 0.6657).'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
          <FormField
            control={form.control}
            name='ratio'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Usage Display Ratio')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step='any'
                    {...field}
                    value={String(field.value ?? '')}
                    disabled={passthrough}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Token counts are multiplied by this positive coefficient and rounded to the nearest integer. Billing and usage logs retain the original counts.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <p className='text-muted-foreground text-sm'>
            {t(
              'This setting applies to all clients, including Codex. Clients that use usage to trigger automatic compaction may compact at a different time when scaling is enabled.'
            )}
          </p>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
