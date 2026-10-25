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
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { KeyRound, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { StatusScreen } from '@/components/status-screen'
import { Button } from '@/components/ui/button'
import { useActiveChatToken } from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl } from '@/features/chat/lib/chat-links'
import { useStatus } from '@/hooks/use-status'
import { resolveAuthentication } from '@/lib/auth-session'
import { useAuthStore } from '@/stores/auth-store'

// Lives outside the sidebar layout: it is a full-page redirect screen.
export const Route = createFileRoute('/chat2link')({
  beforeLoad: async ({ location }) => {
    await resolveAuthentication()

    const { auth } = useAuthStore.getState()

    if (!auth.user || !auth.accessToken) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
  component: Chat2LinkPage,
})

function Chat2LinkPage() {
  const { t } = useTranslation()
  const { loading: statusLoading } = useStatus()
  const { chatPresets, serverAddress } = useChatPresets()

  const firstWebPreset = useMemo(
    () => chatPresets.find((p) => p.type === 'web'),
    [chatPresets]
  )

  const { data: activeToken, error: keyError } = useActiveChatToken(
    Boolean(firstWebPreset)
  )

  useEffect(() => {
    if (!firstWebPreset || !activeToken) return

    const url = resolveChatUrl({
      template: firstWebPreset.url,
      apiKey: activeToken.key,
      serverAddress,
    })

    if (url) {
      window.location.href = url
    }
  }, [firstWebPreset, activeToken, serverAddress])

  if (!statusLoading && !firstWebPreset) {
    return (
      <StatusScreen
        tone='error'
        icon={TriangleAlert}
        title={t('No available Web chat links')}
        description={t(
          'The administrator has not configured a Web chat preset yet.'
        )}
        action={
          <Button size='sm' render={<Link to='/playground' />}>
            {t('Back to chat')}
          </Button>
        }
      />
    )
  }

  if (keyError) {
    return (
      <StatusScreen
        tone='error'
        icon={KeyRound}
        title={t('No available API keys')}
        description={t(
          'Create or enable an API key, then open the chat from here.'
        )}
        action={
          <Button size='sm' render={<Link to='/keys' />}>
            {t('Create key')}
          </Button>
        }
      />
    )
  }

  return (
    <StatusScreen
      tone='pending'
      title={
        firstWebPreset
          ? t('Opening {{name}}', { name: firstWebPreset.name })
          : t('Redirecting to chat page...')
      }
      description={
        activeToken ? (
          <Trans
            t={t}
            i18nKey='Using key <key/>. The chat will open in a new page shortly.'
            components={{
              key: <span className='font-mono'>{activeToken.name}</span>,
            }}
          />
        ) : (
          t('The chat will open with your API key in a moment.')
        )
      }
    />
  )
}
