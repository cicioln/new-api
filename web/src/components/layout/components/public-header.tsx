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
import { Link, useRouterState } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/context/theme-provider'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { cn } from '@/lib/utils'
import { openAuthDialog } from '@/stores/auth-dialog-store'
import { useAuthStore } from '@/stores/auth-store'

import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { HeaderActions } from './header-actions'
import { LogoMark } from './logo-mark'
import { SiteNav } from './site-nav'

const AUTH_PROMPT_SECONDS = 5

type AuthPromptTarget = {
  title: string
  href: string
}

export interface PublicHeaderProps {
  navLinks?: TopNavLink[]
  mobileLinks?: TopNavLink[]
  navContent?: React.ReactNode
  showThemeSwitch?: boolean
  showLanguageSwitcher?: boolean
  logo?: React.ReactNode
  siteName?: string
  homeUrl?: string
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
  showNavigation?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  className?: string
}

export function PublicHeader(props: PublicHeaderProps) {
  const navLinks = props.navLinks ?? defaultTopNavLinks
  const showAuthButtons = props.showAuthButtons ?? true
  const homeUrl = props.homeUrl ?? '/'

  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authPromptTarget, setAuthPromptTarget] =
    useState<AuthPromptTarget | null>(null)
  const [authPromptSecondsLeft, setAuthPromptSecondsLeft] =
    useState(AUTH_PROMPT_SECONDS)
  const { auth } = useAuthStore()
  const { systemName, loading } = useSystemConfig()
  const { resolvedTheme, setTheme } = useTheme()
  const dynamicLinks = useTopNavLinks()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const isAuthenticated = !!auth.user
  const displaySiteName = props.siteName || systemName
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks

  let logoContent: ReactNode = <LogoMark />
  if (props.logo) logoContent = props.logo
  if (loading) logoContent = <Skeleton className='size-[26px] rounded-[7px]' />

  useEffect(() => {
    if (!authPromptTarget) return

    const intervalId = window.setInterval(() => {
      setAuthPromptSecondsLeft((seconds) => Math.max(seconds - 1, 0))
    }, 1000)

    const timeoutId = window.setTimeout(() => {
      const redirect = authPromptTarget.href
      setAuthPromptTarget(null)
      openAuthDialog('sign-in', redirect)
    }, AUTH_PROMPT_SECONDS * 1000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [authPromptTarget])

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptTarget(null)
    setAuthPromptSecondsLeft(AUTH_PROMPT_SECONDS)
  }, [])

  const navigateToSignIn = useCallback(() => {
    const redirect = authPromptTarget?.href || '/'
    setAuthPromptTarget(null)
    openAuthDialog('sign-in', redirect)
  }, [authPromptTarget?.href])

  const handleNavLinkClick = useCallback(
    (
      event: React.MouseEvent<HTMLAnchorElement>,
      link: TopNavLink,
      closeMobile = false
    ) => {
      if (link.disabled) {
        event.preventDefault()
        return
      }

      if (link.requiresAuth) {
        event.preventDefault()
        if (closeMobile) {
          setMobileOpen(false)
        }
        setAuthPromptSecondsLeft(AUTH_PROMPT_SECONDS)
        setAuthPromptTarget({
          title: t(link.title),
          href: link.href,
        })
        return
      }

      if (closeMobile) {
        setMobileOpen(false)
      }
    },
    [t]
  )

  const renderLink = (link: TopNavLink, className: string, mobile = false) => {
    if (link.external) {
      return (
        <a
          key={`${link.title}:${link.href}`}
          href={link.href}
          target='_blank'
          rel='noopener noreferrer'
          aria-disabled={link.disabled}
          tabIndex={link.disabled ? -1 : undefined}
          onClick={(event) => handleNavLinkClick(event, link, mobile)}
          className={className}
        >
          {t(link.title)}
        </a>
      )
    }
    return (
      <Link
        key={`${link.title}:${link.href}`}
        to={link.href}
        disabled={link.disabled}
        onClick={(event) => handleNavLinkClick(event, link, mobile)}
        className={className}
      >
        {t(link.title)}
      </Link>
    )
  }

  return (
    <>
      <header
        className={cn(
          'bg-background/82 sticky top-0 z-20 border-b backdrop-blur-md',
          props.className
        )}
      >
        <div className='relative mx-auto flex h-[60px] max-w-[1360px] items-center gap-8 px-4 sm:px-6'>
          <Link
            to={homeUrl}
            className='flex min-w-0 items-center gap-2.5 text-base font-bold tracking-[-0.01em]'
          >
            {logoContent}
            <span className='max-w-48 truncate' title={displaySiteName}>
              {loading ? <Skeleton className='h-4 w-16' /> : displaySiteName}
            </span>
          </Link>

          <SiteNav
            links={links}
            onLinkClick={(event, link) => handleNavLinkClick(event, link)}
            className='absolute left-1/2 hidden -translate-x-1/2 lg:flex'
          />

          <div className='ms-auto flex items-center gap-2'>
            <HeaderActions />
            <button
              type='button'
              className='bg-card text-muted-foreground grid size-[34px] shrink-0 place-items-center rounded-lg border lg:hidden'
              onClick={() => setMobileOpen(true)}
              aria-label={t('Open menu')}
            >
              <Menu className='size-4' strokeWidth={1.8} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side='right'
          showCloseButton={false}
          className='bg-card w-[min(300px,86vw)] gap-0.5 px-4 pt-3 pb-5 sm:max-w-none'
        >
          <div className='mb-3 flex items-center justify-between'>
            <SheetTitle className='flex min-w-0 items-center gap-2.5 text-base font-bold'>
              {logoContent}
              <span className='truncate'>{displaySiteName}</span>
            </SheetTitle>
            <SheetClose
              className='text-muted-foreground grid size-8 place-items-center rounded-[7px]'
              aria-label={t('Close menu')}
            >
              <X className='size-4' strokeWidth={2} aria-hidden />
            </SheetClose>
          </div>
          {links.map((link) =>
            renderLink(
              link,
              cn(
                'rounded-lg px-3 py-2.5 text-[15px]',
                pathname === link.href
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground',
                link.disabled && 'pointer-events-none opacity-50'
              ),
              true
            )
          )}
          <div className='mt-auto grid gap-2'>
            <Button
              variant='outline'
              className='h-9'
              onClick={() =>
                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
              }
            >
              {t('Toggle theme')}
            </Button>
            {showAuthButtons && !isAuthenticated && (
              <Button
                variant='outline'
                className='h-9'
                onClick={() => {
                  setMobileOpen(false)
                  openAuthDialog('sign-in')
                }}
              >
                {t('Sign in')}
              </Button>
            )}
            {showAuthButtons && (
              <Button
                className='h-9'
                render={<Link to='/dashboard' />}
                onClick={() => setMobileOpen(false)}
              >
                {t('Enter console')}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!authPromptTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeAuthPrompt()
          }
        }}
        title={t('Sign in required')}
        description={t('Please sign in to view {{module}}.', {
          module: authPromptTarget?.title || '',
        })}
        contentClassName='sm:max-w-md'
        contentHeight='auto'
        footer={
          <>
            <Button variant='outline' onClick={closeAuthPrompt}>
              {t('Cancel')}
            </Button>
            <Button onClick={navigateToSignIn}>{t('Sign in now')}</Button>
          </>
        }
      >
        <div className='bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-sm'>
          {t('Redirecting to sign in in {{seconds}} seconds.', {
            seconds: authPromptSecondsLeft,
          })}
        </div>
      </Dialog>
    </>
  )
}
