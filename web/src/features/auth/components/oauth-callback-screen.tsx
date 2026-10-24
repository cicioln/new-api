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
import { useTranslation } from 'react-i18next'

import { StatusScreen } from '@/components/status-screen'

type OAuthCallbackScreenProps = {
  provider: string
  mode: 'login' | 'bind' | 'verify'
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

  let headline = t('Signing you in with {{provider}}', {
    provider: providerLabel,
  })
  let description = t('Hang tight while we finish connecting your account.')
  if (props.mode === 'bind') {
    headline = t('Binding your {{provider}} account', {
      provider: providerLabel,
    })
    description = t(
      'Hang tight while we securely link this account to your profile.'
    )
  }
  if (props.mode === 'verify') {
    headline = t('Verifying your {{provider}} account', {
      provider: providerLabel,
    })
    description = t('Confirming the account linked to your profile.')
  }
  if (props.mode !== 'login') {
    description = `${description} ${t('Return to the original window to continue.')}`
  }

  return (
    <StatusScreen tone='pending' title={headline} description={description} />
  )
}
