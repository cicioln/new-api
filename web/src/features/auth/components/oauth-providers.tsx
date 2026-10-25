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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  IconDiscord,
  IconGithub,
  IconLinuxDo,
  IconTelegram,
  IconWeChat,
} from '@/assets/brand-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useOAuthLogin } from '../hooks/use-oauth-login'
import type { SystemStatus } from '../types'

type OAuthProvidersProps = {
  status: SystemStatus | null
  disabled?: boolean
  className?: string
  onWeChatLogin?: () => void
  isWeChatLoading?: boolean
  redirectTo?: string
  /** Extra buttons (e.g. Passkey) appended to the provider grid. */
  extraButtons?: ProviderButton[]
}

export type ProviderButton = {
  key: string
  label: string
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
}

export function OAuthProviders(props: OAuthProvidersProps) {
  const status = props.status
  const disabled = props.disabled ?? false
  const { t } = useTranslation()
  const {
    isLoading,
    githubButtonText,
    githubButtonDisabled,
    handleGitHubLogin,
    handleDiscordLogin,
    handleOIDCLogin,
    handleLinuxDOLogin,
    handleTelegramLogin,
    handleCustomOAuthLogin,
  } = useOAuthLogin(status, props.redirectTo)

  const providerButtons: ProviderButton[] = []

  if (status?.wechat_login && props.onWeChatLogin) {
    providerButtons.push({
      key: 'wechat',
      label: t('WeChat'),
      onClick: props.onWeChatLogin,
      icon: <IconWeChat className='size-4 text-[#12a150]' />,
      disabled: props.isWeChatLoading,
    })
  }

  if (status?.github_oauth) {
    providerButtons.push({
      key: 'github',
      label: githubButtonDisabled ? githubButtonText : 'GitHub',
      onClick: handleGitHubLogin,
      icon: <IconGithub className='h-4 w-4' />,
      disabled: githubButtonDisabled,
    })
  }

  if (status?.discord_oauth) {
    providerButtons.push({
      key: 'discord',
      label: 'Discord',
      onClick: handleDiscordLogin,
      icon: <IconDiscord className='h-4 w-4' />,
    })
  }

  if (status?.oidc_enabled) {
    const oidcDisplayName = status.oidc_display_name?.trim() || 'OIDC'
    providerButtons.push({
      key: 'oidc',
      label: oidcDisplayName,
      onClick: handleOIDCLogin,
    })
  }

  if (status?.linuxdo_oauth) {
    providerButtons.push({
      key: 'linuxdo',
      label: 'LinuxDO',
      onClick: handleLinuxDOLogin,
      icon: <IconLinuxDo className='h-4 w-4' />,
    })
  }

  if (status?.telegram_oauth) {
    providerButtons.push({
      key: 'telegram',
      label: 'Telegram',
      onClick: handleTelegramLogin,
      icon: <IconTelegram className='size-4' />,
    })
  }

  // Custom OAuth providers
  const customProviders = status?.custom_oauth_providers
  if (customProviders && customProviders.length > 0) {
    for (const provider of customProviders) {
      providerButtons.push({
        key: `custom-${provider.slug}`,
        label: provider.name,
        onClick: () => handleCustomOAuthLogin(provider),
      })
    }
  }

  providerButtons.push(...(props.extraButtons ?? []))

  if (providerButtons.length === 0) return null

  return (
    <div className={cn('grid grid-cols-2 gap-2', props.className)}>
      {providerButtons.map((button) => (
        <Button
          key={button.key}
          variant='outline'
          type='button'
          disabled={disabled || isLoading || button.disabled}
          onClick={button.onClick}
          className='h-[38px] w-full justify-center gap-2 rounded-lg px-4 text-sm last:odd:col-span-2'
        >
          {button.icon}
          {button.label}
        </Button>
      ))}
    </div>
  )
}
