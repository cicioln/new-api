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
import { Link, createFileRoute } from '@tanstack/react-router'
import { KeyRound, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusScreen } from '@/components/status-screen'
import { Button } from '@/components/ui/button'
import { useActiveChatKey } from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl } from '@/features/chat/lib/chat-links'
import { useStatus } from '@/hooks/use-status'

export const Route = createFileRoute('/_authenticated/chat2link')({
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

  const { data: activeKey, error: keyError } = useActiveChatKey(
    Boolean(firstWebPreset)
  )

  useEffect(() => {
    if (!firstWebPreset || !activeKey) return

    const url = resolveChatUrl({
      template: firstWebPreset.url,
      apiKey: activeKey,
      serverAddress,
    })

    if (url) {
      window.location.href = url
    }
  }, [firstWebPreset, activeKey, serverAddress])

  if (!statusLoading && !firstWebPreset) {
    return (
      <StatusScreen
        className='min-h-[70svh]'
        tone='error'
        icon={TriangleAlert}
        title={t('No available Web chat links')}
        description={t(
          'The administrator has not configured a Web chat preset yet.'
        )}
        action={
          <Button size='sm' render={<Link to='/dashboard' />}>
            {t('Back to Dashboard')}
          </Button>
        }
      />
    )
  }

  if (keyError) {
    return (
      <StatusScreen
        className='min-h-[70svh]'
        tone='error'
        icon={KeyRound}
        title={t('No enabled tokens available')}
        description={t(
          'Create or enable an API key, then open the chat from here.'
        )}
        action={
          <Button size='sm' render={<Link to='/keys' />}>
            {t('Create API Key')}
          </Button>
        }
      />
    )
  }

  return (
    <StatusScreen
      className='min-h-[70svh]'
      tone='pending'
      title={
        firstWebPreset
          ? t('Opening {{name}}', { name: firstWebPreset.name })
          : t('Redirecting to chat page...')
      }
      description={t('The chat will open with your API key in a moment.')}
    />
  )
}
