import { useQuery } from '@tanstack/react-query'
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
import {
  Box,
  CalendarDays,
  ChartNoAxesColumn,
  ClipboardList,
  Cog,
  Gift,
  House,
  Info,
  Key,
  List,
  MessageSquare,
  Plug,
  Route,
  ShieldCheck,
  SquareCheck,
  Terminal,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import { getChannels } from '@/features/channels/api'
import { getApiKeys } from '@/features/keys/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const BADGE_STALE_TIME = 60 * 1000

/** Show a count next to a nav entry only once it is known. */
function toBadge(total: number | undefined): string | undefined {
  return total == null ? undefined : String(total)
}

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()
  const role = useAuthStore((state) => state.auth.user?.role ?? 0)
  const keyTotal = useQuery({
    queryKey: ['sidebar', 'badge', 'keys'],
    queryFn: async () => (await getApiKeys({ p: 1, size: 1 })).data?.total,
    staleTime: BADGE_STALE_TIME,
    meta: { errorToast: false },
  })
  const channelTotal = useQuery({
    queryKey: ['sidebar', 'badge', 'channels'],
    queryFn: async () =>
      (await getChannels({ p: 1, page_size: 1 })).data?.total,
    enabled: role >= ROLE.ADMIN,
    staleTime: BADGE_STALE_TIME,
    meta: { errorToast: false },
  })

  return {
    navGroups: [
      {
        id: 'general',
        title: '',
        items: [
          {
            title: t('Overview'),
            url: '/dashboard/overview',
            icon: House,
          },
          {
            title: t('Dashboard'),
            url: '/dashboard/models',
            icon: ChartNoAxesColumn,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
            badge: toBadge(keyTotal.data),
          },
          {
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            icon: List,
          },
          {
            title: t('Audit Logs'),
            url: '/usage-logs/audit',
            icon: ClipboardList,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: SquareCheck,
          },
        ],
      },
      {
        id: 'chat',
        title: t('Conversation'),
        items: [
          {
            title: t('Chat'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
          {
            title: t('Playground'),
            url: '/playground',
            icon: Terminal,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Personal'),
        items: [
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
          },
          {
            title: t('Security & Access'),
            url: '/security',
            icon: ShieldCheck,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Manage'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Route,
            badge: toBadge(channelTotal.data),
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Gift,
          },
          {
            title: t('Subscriptions'),
            url: '/subscriptions',
            icon: CalendarDays,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: Info,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('Task Plugins'),
            url: '/task-plugins',
            icon: Plug,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activePathPrefix: '/system-settings',
            icon: Cog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
    ],
  }
}
