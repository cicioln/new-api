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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { StatusScreen } from '@/components/status-screen'
import { Button } from '@/components/ui/button'

export type OAuthCallbackResult =
  | { tone: 'success' }
  | { tone: 'error'; message: string }

type OAuthCallbackScreenProps = {
  provider: string
  mode: 'login' | 'bind' | 'verify'
  /** Final outcome; while unset the screen shows a spinner. */
  result?: OAuthCallbackResult | null
}

const providerLabels: Record<string, string> = {
  github: 'GitHub',
  oidc: 'OIDC',
  linuxdo: 'LinuxDO',
  telegram: 'Telegram',
  wechat: 'WeChat',
}

export function OAuthCallbackScreen(props: OAuthCallbackScreenProps) {
  const { t } = useTranslation()
  const providerLabel = t(
    providerLabels[props.provider?.toLowerCase() ?? ''] ?? 'account'
  )

  if (props.result?.tone === 'success') {
    return (
      <StatusScreen
        tone='success'
        title={t('Authorization complete')}
        description={t(
          'Return to the original window to continue. You can close this window.'
        )}
      />
    )
  }

  if (props.result?.tone === 'error') {
    let title = t('{{provider}} sign-in failed', { provider: providerLabel })
    if (props.mode !== 'login') {
      title = t('{{provider}} authorization failed', {
        provider: providerLabel,
      })
    }
    return (
      <StatusScreen
        tone='error'
        title={title}
        description={props.result.message}
        action={
          props.mode === 'login' && (
            <Button size='sm' render={<Link to='/sign-in' replace />}>
              {t('Back to login')}
            </Button>
          )
        }
      />
    )
  }

  let headline = t('Finishing {{provider}} sign-in', {
    provider: providerLabel,
  })
  let description = t(
    'Checking the authorization result. This will only take a moment.'
  )
  if (props.mode === 'bind') {
    headline = t('Binding {{provider}} account', { provider: providerLabel })
    description = t('Confirming the account to link to your profile.')
  }
  if (props.mode === 'verify') {
    headline = t('Verifying your {{provider}} account', {
      provider: providerLabel,
    })
    description = t('Confirming the account linked to your profile.')
  }

  return (
    <StatusScreen tone='pending' title={headline} description={description} />
  )
}
