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
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

/**
 * Shared frame for error pages: a monospace status code, a short title and
 * the follow-up actions, centered on the plain canvas.
 */
export function ErrorFrame(props: ErrorFrameProps) {
  return (
    <div
      className={cn(
        'flex h-svh w-full flex-col items-center justify-center px-5 text-center',
        props.className
      )}
    >
      {props.code !== undefined && (
        <h1 className='font-mono text-[56px] leading-none font-medium tracking-[-0.04em]'>
          {props.code}
        </h1>
      )}
      {props.code !== undefined ? (
        <p className='mt-3 text-[15px] font-semibold'>{props.title}</p>
      ) : (
        <h1 className='mt-3 text-[15px] font-semibold'>{props.title}</h1>
      )}
      <div className='text-subtle-foreground mt-1 max-w-md text-[13px] leading-relaxed'>
        {props.children}
      </div>
      {props.actions && (
        <div className='mt-4 flex flex-wrap justify-center gap-2'>
          {props.actions}
        </div>
      )}
    </div>
  )
}
