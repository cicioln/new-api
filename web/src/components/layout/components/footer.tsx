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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { getUptimeStatus } from '@/features/dashboard/api'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { LogoMark } from './logo-mark'

interface FooterProps {
  className?: string
}

const NEW_API_FOOTER_ATTRIBUTION_KEY = [
  'footer',
  'new' + 'api',
  'projectAttributionSuffix',
].join('.')

const NEW_API_REPO_URL = 'https://github.com/QuantumNous/new-api'

function ProjectAttribution() {
  const { t } = useTranslation()
  return (
    <span className='text-subtle-foreground'>
      &copy; {new Date().getFullYear()}{' '}
      <a
        href={NEW_API_REPO_URL}
        target='_blank'
        rel='noopener noreferrer'
        className='hover:text-foreground'
      >
        {t('New API')}
      </a>
      . {t(NEW_API_FOOTER_ATTRIBUTION_KEY)}
    </span>
  )
}

/** Status page link with a dot summarising the Uptime Kuma monitors. */
function StatusLink() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const enabled = Boolean(status?.uptime_kuma_enabled)
  const { data } = useQuery({
    queryKey: ['footer', 'uptime-status'],
    queryFn: getUptimeStatus,
    enabled,
    staleTime: 60 * 1000,
  })
  const groups = data?.success ? data.data : []
  const url = groups.find((g) => g.url)?.url
  if (!enabled || !url) return null

  const down = groups
    .flatMap((g) => g.monitors)
    .filter((m) => m.status !== 1).length
  return (
    <a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      className='hover:text-foreground inline-flex items-center gap-1.5'
    >
      <i
        aria-hidden
        className={cn(
          'size-[7px] rounded-full',
          down ? 'bg-warning' : 'bg-success'
        )}
      />
      {down
        ? t('Status page · {{count}} services degraded', { count: down })
        : t('Status page · All operational')}
    </a>
  )
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const { systemName, footerHtml } = useSystemConfig()
  const { status } = useStatus()
  const docsLink = typeof status?.docs_link === 'string' ? status.docs_link : ''

  if (footerHtml) {
    return (
      <footer className={cn('mt-24 border-t pt-10 pb-24', props.className)}>
        <div className='text-subtle-foreground mx-auto w-full max-w-[1600px] px-4 text-[13px] leading-[1.8] md:px-7'>
          <div
            className='custom-footer [&_a]:text-muted-foreground [&_a]:underline [&_a]:underline-offset-[3px]'
            dangerouslySetInnerHTML={{ __html: footerHtml }}
          />
          <ProjectAttribution />
        </div>
      </footer>
    )
  }

  const linkClass = 'hover:text-foreground'

  return (
    <footer className={cn('mt-24 border-t pt-10 pb-24', props.className)}>
      <div className='mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-6 px-4 text-[13px] md:px-7'>
        <Link
          to='/'
          className='flex items-center gap-2.5 text-base font-bold tracking-[-0.01em]'
        >
          <LogoMark />
          <span>{systemName || 'New API'}</span>
        </Link>
        <ProjectAttribution />
        <nav className='text-muted-foreground flex flex-wrap gap-5 sm:ms-auto'>
          {docsLink && (
            <a
              href={docsLink}
              target='_blank'
              rel='noopener noreferrer'
              className={linkClass}
            >
              {t('Docs')}
            </a>
          )}
          <a
            href='https://docs.newapi.pro/api/'
            target='_blank'
            rel='noopener noreferrer'
            className={linkClass}
          >
            {t('API Reference')}
          </a>
          <a
            href={NEW_API_REPO_URL}
            target='_blank'
            rel='noopener noreferrer'
            className={linkClass}
          >
            GitHub
          </a>
          <StatusLink />
          <Link to='/user-agreement' className={linkClass}>
            {t('Terms of Service')}
          </Link>
          <Link to='/privacy-policy' className={linkClass}>
            {t('Privacy Policy')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
