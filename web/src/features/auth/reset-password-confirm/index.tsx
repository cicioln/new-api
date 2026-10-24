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
import { useNavigate } from '@tanstack/react-router'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCountdown } from '@/hooks/use-countdown'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'

import { AuthLayout } from '../auth-layout'

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
          toast.success(
            t('Password reset and copied to clipboard: {{password}}', {
              password,
            })
          )
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

  if (!isValidResetLink) {
    return (
      <AuthLayout>
        <div className='w-full space-y-6'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {t('Reset password')}
          </h2>
          <Alert className='border-warning/40 bg-warning/10'>
            <TriangleAlert aria-hidden='true' className='text-warning' />
            <AlertTitle>{t('Link invalid or expired')}</AlertTitle>
            <AlertDescription>
              {t(
                'Reset links expire after a short time and can only be used once. Please request a new one.'
              )}
            </AlertDescription>
          </Alert>
          <Button
            className='w-full'
            onClick={() => navigate({ to: '/forgot-password', replace: true })}
          >
            {t('Request again')}
          </Button>
          <Button
            variant='link'
            className='w-full'
            onClick={() => navigate({ to: '/sign-in', replace: true })}
          >
            {t('Back to login')}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className='w-full space-y-6'>
        <div className='space-y-2'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {t('Reset password')}
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {t('auth.resetPasswordConfirm.description')}
          </p>
        </div>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='email'>{t('Email')}</Label>
            <Input id='email' type='email' value={email} disabled />
          </div>

          {newPassword && (
            <>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='password'>{t('New password')}</Label>
                  <span className='text-primary text-xs'>
                    {t('Password has been copied to clipboard')}
                  </span>
                </div>
                <div className='flex gap-2'>
                  <Input
                    id='password'
                    value={newPassword}
                    readOnly
                    className='font-mono'
                  />
                  <CopyButton
                    value={newPassword}
                    variant='outline'
                    size='icon'
                    aria-label={t('Copy password')}
                  />
                </div>
              </div>
              <Alert>
                <CircleCheck aria-hidden='true' className='text-success' />
                <AlertDescription>
                  {t('auth.resetPasswordConfirm.success')}
                </AlertDescription>
              </Alert>
            </>
          )}

          <Button
            className='w-full'
            onClick={
              newPassword
                ? () => navigate({ to: '/sign-in', replace: true })
                : handleSubmit
            }
            disabled={newPassword ? false : loading || isActive}
          >
            {newPassword && t('auth.resetPasswordConfirm.backToLogin')}
            {!newPassword &&
              isActive &&
              t('auth.resetPasswordConfirm.retry', {
                seconds: secondsLeft,
              })}
            {!newPassword &&
              !isActive &&
              t('auth.resetPasswordConfirm.confirm')}
          </Button>

          {!newPassword && (
            <Button
              variant='link'
              className='w-full'
              onClick={() => navigate({ to: '/sign-in', replace: true })}
            >
              {t('Back to login')}
            </Button>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
