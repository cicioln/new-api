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
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { sendPasswordResetEmail } from '@/features/auth/api'
import {
  AUTH_FIELD_CLASS,
  AUTH_FORM_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_SUBMIT_CLASS,
  AuthHeader,
  AuthNotice,
} from '@/features/auth/components/auth-ui'
import {
  forgotPasswordFormSchema,
  PASSWORD_RESET_COUNTDOWN,
} from '@/features/auth/constants'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { useCountdown } from '@/hooks/use-countdown'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

export function ForgotPasswordForm(props: { className?: string }) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
  } = useCountdown({ initialSeconds: PASSWORD_RESET_COUNTDOWN })

  const form = useForm<z.infer<typeof forgotPasswordFormSchema>>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: '' },
  })
  const turnstileReady = !isTurnstileEnabled || Boolean(turnstileToken)

  async function onSubmit(data: z.infer<typeof forgotPasswordFormSchema>) {
    if (!validateTurnstile()) return

    setIsLoading(true)
    try {
      const res = await sendPasswordResetEmail(data.email, turnstileToken)
      if (res?.success) {
        setSentTo(data.email)
        startCountdown()
        toast.success(t('Reset email sent, please check your inbox'))
      } else {
        handleServerError(
          createServerError(res, t('Failed to send reset email'))
        )
      }
    } catch (_error) {
      handleServerError(
        AuthOperationError.from(_error, t('Failed to send reset email'))
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (sentTo) {
    return (
      <AuthNotice>
        <b>{t('Email sent')}</b>
        <br />
        <Trans
          t={t}
          i18nKey='Check {{email}}. The link is valid for 10 minutes. If it has not arrived, check your spam folder, or <resend>resend</resend>.'
          values={{ email: sentTo }}
          components={{
            resend: (
              <button
                type='button'
                className='underline'
                onClick={() => setSentTo('')}
              />
            ),
          }}
        />
      </AuthNotice>
    )
  }

  return (
    <>
      <AuthHeader
        title={t('Recover password')}
        description={t(
          'Enter the email you registered with and we will send you a reset link.'
        )}
      />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(AUTH_FORM_CLASS, props.className)}
        >
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem className={AUTH_FIELD_CLASS}>
                <FormLabel className={AUTH_LABEL_CLASS}>{t('Email')}</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    autoComplete='email'
                    placeholder='you@example.com'
                    className={AUTH_INPUT_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isTurnstileEnabled && (
            <Turnstile
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
            />
          )}

          <Button
            type='submit'
            className={AUTH_SUBMIT_CLASS}
            disabled={isLoading || isActive || !turnstileReady}
          >
            {isLoading && <Loader2 className='animate-spin' />}
            {isActive
              ? t('Resend ({{seconds}}s)', { seconds: secondsLeft })
              : t('Send reset email')}
          </Button>
        </form>
      </Form>
    </>
  )
}
