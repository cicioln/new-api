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
import { cn } from '@/lib/utils'

type ErrorFrameProps = {
  code?: number | string
  title: React.ReactNode
  /** Rendered above the code, e.g. the brand on the maintenance page */
  leading?: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

/**
 * Shared frame for error pages: a monospace status code, a short title, a
 * muted explanation and the follow-up actions in a narrow centered column.
 */
export function ErrorFrame(props: ErrorFrameProps) {
  return (
    <div
      className={cn(
        'text-subtle-foreground mx-auto my-20 max-w-[420px] px-5 py-12 text-center text-[13px] leading-[1.6]',
        props.className
      )}
    >
      {props.leading}
      {props.code !== undefined && (
        <h1 className='text-foreground mb-1 font-mono text-[56px] leading-[1.6] font-medium tracking-[-0.04em]'>
          {props.code}
        </h1>
      )}
      {props.code !== undefined ? (
        <p className='text-foreground mb-1 text-[15px] font-bold'>
          {props.title}
        </p>
      ) : (
        <h1 className='text-foreground mb-1 text-[15px] font-bold'>
          {props.title}
        </h1>
      )}
      {props.children}
      {props.actions && (
        <div className='mt-3.5 flex flex-wrap justify-center gap-1'>
          {props.actions}
        </div>
      )}
    </div>
  )
}
