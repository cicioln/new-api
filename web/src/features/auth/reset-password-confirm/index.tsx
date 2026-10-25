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
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCountdown } from '@/hooks/use-countdown'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { AuthLayout } from '../auth-layout'
import {
  AUTH_FIELD_CLASS,
  AUTH_FORM_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LABEL_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
  AuthAlt,
  AuthHeader,
  AuthNotice,
} from '../components/auth-ui'

export type ResetPasswordSearchParams = {
  email?: string
  token?: string
}

type ResetPasswordConfirmProps = ResetPasswordSearchParams

export function ResetPasswordConfirm(props: ResetPasswordConfirmProps) {
  const { t } = useTranslation()
  const email = props.email
  const token = props.token
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
  } = useCountdown({ initialSeconds: 30 })

  const isValidResetLink = Boolean(email && token)

  async function handleSubmit() {
    if (!isValidResetLink || !email || !token) {
      toast.error(t('Invalid reset link, please request a new password reset'))
      return
    }

    startCountdown()
    setLoading(true)
    try {
      const res = await api.post('/api/user/reset', { email, token }, {
        skipBusinessError: true,
      } as Record<string, unknown>)

      if (res?.data?.success) {
        const password = res.data.data
        setNewPassword(password)
        const copySuccess = await copyToClipboard(password)
        if (copySuccess) {
          toast.success(t('New password copied to clipboard'))
        } else {
          toast.success(t('Password reset: {{password}}', { password }))
        }
      } else {
        handleServerError(createServerError(res.data, t('Request failed')))
      }
    } catch (error) {
      handleServerError(AuthOperationError.from(error))
    } finally {
      setLoading(false)
    }
  }

  const backToLogin = (
    <AuthAlt>
      <Link to='/sign-in' replace>
        {t('Back to login')}
      </Link>
    </AuthAlt>
  )

  if (!isValidResetLink) {
    return (
      <AuthLayout>
        <AuthNotice warn>
          <b>{t('Link invalid or expired')}</b>
          <br />
          {t(
            'Reset links are valid for 10 minutes and can only be used once. Please request a new one.'
          )}
        </AuthNotice>
        <Button
          className={cn(AUTH_SUBMIT_CLASS, 'mt-0')}
          onClick={() => navigate({ to: '/forgot-password', replace: true })}
        >
          {t('Request again')}
        </Button>
        {backToLogin}
      </AuthLayout>
    )
  }

  let submitLabel = t('Reset password')
  if (newPassword) {
    submitLabel = t('Go to sign in')
  } else if (isActive) {
    submitLabel = t('auth.resetPasswordConfirm.retry', {
      seconds: secondsLeft,
    })
  }

  return (
    <AuthLayout>
      <AuthHeader
        title={t('Reset password')}
        description={t(
          'A new password will be generated for this account, and the old one stops working immediately.'
        )}
      />

      <div className={AUTH_FORM_CLASS}>
        <div className={cn('grid', AUTH_FIELD_CLASS)}>
          <Label htmlFor='email' className={AUTH_LABEL_CLASS}>
            {t('Email')}
          </Label>
          <Input
            id='email'
            type='email'
            value={email}
            disabled
            className={AUTH_INPUT_CLASS}
          />
        </div>

        {newPassword && (
          <>
            <div className={cn('grid', AUTH_FIELD_CLASS)}>
              <Label htmlFor='password' className={AUTH_LABEL_CLASS}>
                {t('New password')}
                <span className={AUTH_LABEL_LINK_CLASS}>
                  {t('Copied to clipboard')}
                </span>
              </Label>
              <div className='flex gap-2'>
                <Input
                  id='password'
                  value={newPassword}
                  readOnly
                  className={cn(AUTH_INPUT_CLASS, 'font-mono')}
                />
                <CopyButton
                  value={newPassword}
                  variant='outline'
                  size='default'
                  hideIcon
                  className='h-10 rounded-lg px-4'
                  aria-label={t('Copy password')}
                >
                  {t('Copy')}
                </CopyButton>
              </div>
            </div>
            <AuthNotice>
              {t(
                'Password reset. Sign in with the new password, then change it in Security & Access.'
              )}
            </AuthNotice>
          </>
        )}

        <Button
          className={cn(AUTH_SUBMIT_CLASS, newPassword && 'mt-0')}
          onClick={
            newPassword
              ? () => navigate({ to: '/sign-in', replace: true })
              : handleSubmit
          }
          disabled={newPassword ? false : loading || isActive}
        >
          {submitLabel}
        </Button>
      </div>
      {backToLogin}
    </AuthLayout>
  )
}
