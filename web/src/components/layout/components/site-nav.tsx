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

import { cn } from '@/lib/utils'

import type { TopNavLink } from '../types'

export const CONSOLE_HREF = '/dashboard'

function isLinkActive(link: TopNavLink, pathname: string): boolean {
  if (link.href === '/') return pathname === '/'
  return pathname === link.href || pathname.startsWith(`${link.href}/`)
}

/**
 * Pill navigation shared by the public site header and the console header.
 * `activeHref` pins the highlighted entry; otherwise it follows the URL.
 */
export function SiteNav(props: {
  links: TopNavLink[]
  activeHref?: string
  onLinkClick?: (
    event: React.MouseEvent<HTMLAnchorElement>,
    link: TopNavLink
  ) => void
  className?: string
}) {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <nav
      aria-label={t('Site navigation')}
      className={cn(
        'bg-muted/70 items-center gap-0.5 rounded-full border p-1',
        props.className
      )}
    >
      {props.links.map((link) => {
        const active = props.activeHref
          ? link.href === props.activeHref
          : isLinkActive(link, pathname)
        const className = cn(
          'rounded-full px-4 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
          active
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
          link.disabled && 'pointer-events-none opacity-50'
        )
        if (link.external) {
          return (
            <a
              key={link.href}
              href={link.href}
              target='_blank'
              rel='noopener noreferrer'
              onClick={(event) => props.onLinkClick?.(event, link)}
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
            aria-current={active ? 'page' : undefined}
            onClick={(event) => props.onLinkClick?.(event, link)}
            className={className}
          >
            {link.title}
          </Link>
        )
      })}
    </nav>
  )
}
