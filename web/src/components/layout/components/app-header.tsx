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
import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ConfigDrawer } from '@/components/config-drawer'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { useNotifications } from '@/hooks/use-notifications'
import { useSidebarView } from '@/hooks/use-sidebar-view'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { cn } from '@/lib/utils'

import { checkIsActive } from '../lib/url-utils'
import { Header } from './header'

/**
 * Console top bar: breadcrumb for the current page, site navigation,
 * command search, language, notifications, appearance and the account menu.
 */
export function AppHeader() {
  const { t } = useTranslation()
  const href = useLocation({ select: (location) => location.href })
  const pathname = useLocation({ select: (location) => location.pathname })
  const { navGroups } = useSidebarView()
  const notifications = useNotifications()
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
      <nav
        aria-label={t('Breadcrumb')}
        className='text-subtle-foreground hidden min-w-0 truncate text-[13px] sm:block'
      >
        {t('Console')}
        {crumb && (
          <>
            {' / '}
            <b className='text-foreground font-medium'>{crumb}</b>
          </>
        )}
      </nav>
      <b className='min-w-0 truncate text-sm font-medium sm:hidden'>{crumb}</b>

      {navLinks.length > 0 && (
        <nav
          aria-label={t('Site navigation')}
          className='hidden items-center gap-1 border-s ps-4 lg:flex'
        >
          {navLinks.map((link) => {
            const className = cn(
              'rounded-[7px] px-3 py-1.5 text-sm transition-colors',
              pathname === link.href
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              link.disabled && 'pointer-events-none opacity-50'
            )
            if (link.external) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={className}
                >
                  {link.title}
                </a>
              )
            }
            return (
              <Link
                key={link.href}
                to={link.href}
                disabled={link.disabled}
                className={className}
              >
                {link.title}
              </Link>
            )
          })}
        </nav>
      )}

      <div className='ms-auto flex min-w-0 items-center gap-2 sm:gap-4'>
        <Search
          className='hidden sm:flex'
          placeholder={t('Search pages, models, keys')}
        />
        <LanguageSwitcher />
        <NotificationPopover
          open={notifications.popoverOpen}
          onOpenChange={notifications.setPopoverOpen}
          unreadCount={notifications.unreadCount}
          activeTab={notifications.activeTab}
          onTabChange={notifications.setActiveTab}
          notice={notifications.notice}
          announcements={notifications.announcements}
          loading={notifications.loading}
        />
        <ConfigDrawer />
        <ProfileDropdown />
      </div>
    </Header>
  )
}
