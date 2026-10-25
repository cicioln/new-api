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
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { getSystemSettingsNavGroups } from '../lib/settings-nav'

/**
 * Grouped section navigation shown beside the settings card. Collapses
 * into a horizontally scrolling strip on narrow screens.
 */
export function SettingsNav() {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (location) => location.pathname })
  const groups = getSystemSettingsNavGroups(t)

  return (
    <nav
      aria-label={t('System Settings')}
      className='flex gap-0.5 overflow-x-auto border-b pb-2 lg:sticky lg:top-4 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0'
    >
      {groups.map((group, index) => (
        <Fragment key={group.title}>
          <div
            className={cn(
              'text-subtle-foreground hidden px-2.5 pb-1 text-[11px] lg:block',
              index === 0 ? 'pt-0' : 'pt-3'
            )}
          >
            {group.title}
          </div>
          {group.items.map((item) => {
            const active = pathname === item.url
            return (
              <Link
                key={item.url}
                to={item.url}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-[7px] px-2.5 py-[7px] text-[13.5px] whitespace-nowrap',
                  active
                    ? 'bg-card text-foreground ring-border font-medium ring-1 ring-inset'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {item.title}
              </Link>
            )
          })}
        </Fragment>
      ))}
    </nav>
  )
}
