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
import { ShieldCheck } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { PasswordInput } from '@/components/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import type { SetupFormValues } from '../types'

interface AdminStepProps {
  form: UseFormReturn<SetupFormValues>
  rootInitialized?: boolean
}

export function AdminStep(props: AdminStepProps) {
  const { t } = useTranslation()
  const form = props.form

  return (
    <section>
      <h2 className='text-base font-semibold'>
        {t('Create administrator account')}
      </h2>
      <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
        {t(
          'This super administrator can manage system settings and all users.'
        )}
      </p>
      {props.rootInitialized ? (
        <Alert>
          <ShieldCheck aria-hidden='true' className='text-success' />
          <AlertDescription>
            {t(
              'The administrator account is already initialized. You can keep your existing credentials and continue to the next step.'
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <div className='grid gap-x-3.5 gap-y-4 sm:grid-cols-2'>
          <FormField
            control={form.control}
            name='username'
            render={({ field }) => (
              <FormItem className='sm:col-span-2'>
                <FormLabel>{t('Administrator username')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('Choose a username')}
                    autoComplete='username'
                    onChange={(event) => {
                      form.clearErrors('username')
                      field.onChange(event)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Password')}</FormLabel>
                <FormControl>
                  <PasswordInput
                    {...field}
                    placeholder={t('Set a secure password (min. 8 characters)')}
                    autoComplete='new-password'
                    onChange={(event) => {
                      form.clearErrors('password')
                      field.onChange(event)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Confirm password')}</FormLabel>
                <FormControl>
                  <PasswordInput
                    {...field}
                    placeholder={t('Repeat the administrator password')}
                    autoComplete='new-password'
                    onChange={(event) => {
                      form.clearErrors('confirmPassword')
                      field.onChange(event)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </section>
  )
}
