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
import { CircleCheck, ChevronLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Form grid: 14px between fields. */
export const AUTH_FORM_CLASS = 'grid gap-3.5'

/** Field wrapper: label sits 6px above its control. */
export const AUTH_FIELD_CLASS = 'gap-1.5'

/** Field label; a trailing link is pushed to the right. */
export const AUTH_LABEL_CLASS =
  'flex justify-between text-[13px] leading-[1.55] font-medium'

/** Muted link shown inside a field label. */
export const AUTH_LABEL_LINK_CLASS =
  'text-subtle-foreground text-[13px] font-normal hover:opacity-75'

/** 40px input with the accent focus halo. */
export const AUTH_INPUT_CLASS =
  'bg-card h-10 rounded-lg px-3 text-sm focus-visible:border-foreground focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_22%,transparent)]'

/** Full-width 42px primary action. */
export const AUTH_SUBMIT_CLASS =
  'mt-1.5 h-[42px] w-full justify-center gap-2 rounded-lg px-4 text-sm'

/** Full-width 38px secondary action (use with variant='outline'). */
export const AUTH_OUTLINE_CLASS =
  'h-[38px] w-full justify-center gap-2 rounded-lg px-4 text-sm'

export function AuthHeader(props: {
  title: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <div className='mb-7'>
      <h1 className='text-[26px] leading-[1.55] font-bold tracking-[-0.02em]'>
        {props.title}
      </h1>
      {props.description && (
        <p className='text-subtle-foreground mt-1.5 text-sm leading-[1.55]'>
          {props.description}
        </p>
      )}
    </div>
  )
}

export function AuthBackLink(props: {
  to: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Link
      to={props.to}
      onClick={props.onClick}
      className='text-subtle-foreground hover:text-foreground mb-6 inline-flex w-fit items-center gap-1.5 text-[13px]'
    >
      <ChevronLeft className='size-[15px]' strokeWidth={2} />
      {props.children}
    </Link>
  )
}

/** Centered "Have an account? Sign in" line under the form. */
export function AuthAlt(props: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-subtle-foreground mt-5 text-center text-[13px] [&_a]:text-foreground [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-[3px]',
        props.className
      )}
    >
      {props.children}
    </div>
  )
}

export function AuthDivider(props: { children: React.ReactNode }) {
  return (
    <div className='text-subtle-foreground before:bg-border after:bg-border my-[22px] flex items-center gap-3 text-xs before:h-px before:flex-1 after:h-px after:flex-1'>
      {props.children}
    </div>
  )
}

/** Green success notice with a check icon. */
export function AuthNotice(props: { children: React.ReactNode }) {
  return (
    <div className='text-foreground mb-[18px] flex gap-3 rounded-[10px] bg-[color-mix(in_srgb,var(--success)_16%,var(--card))] p-3.5 text-[13px] leading-[1.6]'>
      <CircleCheck
        className='text-success mt-px size-[18px] shrink-0'
        strokeWidth={2}
      />
      <div>{props.children}</div>
    </div>
  )
}
