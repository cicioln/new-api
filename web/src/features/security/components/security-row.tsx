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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SecurityRowProps {
  title: ReactNode
  description: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  /** Dialogs owned by the row; they portal out of the layout. */
  children?: ReactNode
  as?: 'div' | 'li'
}

/** One settings row: title and hint on the left, actions on the right. */
export function SecurityRow(props: SecurityRowProps) {
  const Row = props.as ?? 'div'
  return (
    <Row className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t py-[13px] first:border-t-0 first:pt-0'>
      <div className='flex min-w-0 items-center gap-3'>
        {props.icon && (
          <span
            aria-hidden='true'
            className='bg-muted grid size-[30px] flex-none place-items-center rounded-lg [&_svg]:size-4'
          >
            {props.icon}
          </span>
        )}
        <div className='min-w-0'>
          <h3 className='flex items-center gap-2 text-[13.5px] font-medium'>
            {props.title}
          </h3>
          <p className='text-muted-foreground truncate text-[12.5px]'>
            {props.description}
          </p>
        </div>
      </div>
      {props.actions && (
        <div className='flex flex-none items-center gap-1.5'>
          {props.actions}
        </div>
      )}
      {props.children}
    </Row>
  )
}

interface SecurityTagProps {
  label: string
  active: boolean
}

/** The design's small status tag with a leading dot. */
export function SecurityTag(props: SecurityTagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap',
        props.active
          ? 'bg-success/12 text-success'
          : 'bg-muted text-muted-foreground'
      )}
    >
      <span aria-hidden className='size-1.5 rounded-full bg-current' />
      {props.label}
    </span>
  )
}
