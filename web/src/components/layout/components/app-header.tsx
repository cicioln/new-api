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
import { useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Search } from '@/components/search'
import { useSidebarView } from '@/hooks/use-sidebar-view'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'

import { checkIsActive } from '../lib/url-utils'
import { Header } from './header'
import { HeaderActions } from './header-actions'
import { CONSOLE_HREF, SiteNav } from './site-nav'

/**
 * Console top bar: page title on mobile, centered site navigation,
 * command search, language, notifications, appearance and the account menu.
 */
export function AppHeader() {
  const { t } = useTranslation()
  const href = useLocation({ select: (location) => location.href })
  const pathname = useLocation({ select: (location) => location.pathname })
  const { navGroups } = useSidebarView()
  const navLinks = useTopNavLinks()

  let crumb = ''
  for (const group of navGroups) {
    const active = group.items.find((item) => checkIsActive(href, item))
    if (active) {
      crumb = active.title
      break
    }
  }
  if (!crumb && pathname.startsWith('/chat')) crumb = t('Chat')

  return (
    <Header>
      <div className='min-w-0 flex-1'>
        <b className='block truncate text-sm font-medium lg:hidden'>{crumb}</b>
      </div>

      <SiteNav
        links={navLinks}
        activeHref={CONSOLE_HREF}
        className='hidden shrink-0 lg:flex'
      />

      <div className='flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3'>
        <Search
          className='hidden sm:flex'
          placeholder={t('Search pages, models, keys')}
        />
        <HeaderActions />
      </div>
    </Header>
  )
}
