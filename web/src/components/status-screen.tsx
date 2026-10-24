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
import { Link } from '@tanstack/react-router'
import { Check, Loader2, X, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

export type StatusScreenTone = 'pending' | 'success' | 'error'

type StatusScreenProps = {
  tone: StatusScreenTone
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  /** Icon for the error tone; defaults to a cross. */
  icon?: LucideIcon
  className?: string
}

/**
 * Full-screen, centered status card for transient pages (OAuth callback,
 * chat redirect): brand, a spinner or result icon, a title and an action.
 */
export function StatusScreen(props: StatusScreenProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()
  const ErrorIcon = props.icon ?? X

  return (
    <div
      className={cn(
        'bg-background text-foreground grid min-h-svh place-items-center px-4 py-6',
        props.className
      )}
    >
      <div
        role='status'
        aria-live='polite'
        className='flex w-full max-w-[380px] flex-col items-center text-center'
      >
        <Link
          to='/'
          className='mb-10 flex items-center gap-2.5 transition-opacity hover:opacity-80'
        >
          {loading ? (
            <Skeleton className='size-7 rounded-md' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='size-7 rounded-md object-cover'
            />
          )}
          {loading ? (
            <Skeleton className='h-5 w-24' />
          ) : (
            <span className='text-[15px] font-semibold tracking-tight'>
              {systemName}
            </span>
          )}
        </Link>

        {props.tone === 'pending' && (
          <Loader2
            aria-hidden='true'
            className='text-muted-foreground mb-3.5 size-6 animate-spin'
          />
        )}
        {props.tone !== 'pending' && (
          <span
            data-tone={props.tone}
            className={cn(
              'mb-3.5 grid size-10 place-items-center rounded-full',
              props.tone === 'success'
                ? 'bg-success/15 text-success'
                : 'bg-destructive/15 text-destructive'
            )}
          >
            {props.tone === 'success' ? (
              <Check aria-hidden='true' className='size-5' strokeWidth={2.2} />
            ) : (
              <ErrorIcon
                aria-hidden='true'
                className='size-5'
                strokeWidth={2.2}
              />
            )}
          </span>
        )}

        <h1 className='mb-1.5 text-base font-semibold'>{props.title}</h1>
        {props.description != null && (
          <p className='text-muted-foreground text-[13.5px] leading-relaxed'>
            {props.description}
          </p>
        )}
        {props.action != null && (
          <div className='mt-[18px]'>{props.action}</div>
        )}
      </div>
    </div>
  )
}
