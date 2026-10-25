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
import { useSystemConfig } from '@/hooks/use-system-config'
import { DEFAULT_LOGO } from '@/lib/constants'
import { cn } from '@/lib/utils'

/** Brand mark: the configured logo, or the "N" tile with an accent corner. */
export function LogoMark(props: { className?: string }) {
  const { logo } = useSystemConfig()

  if (logo && logo !== DEFAULT_LOGO) {
    return (
      <img
        src={logo}
        alt=''
        className={cn(
          'size-[26px] rounded-[7px] object-contain',
          props.className
        )}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'bg-foreground text-background after:bg-primary after:border-background relative grid size-[26px] shrink-0 place-items-center rounded-[7px] font-mono text-[13px] font-medium after:absolute after:-right-[3px] after:-bottom-[3px] after:size-[9px] after:rounded-[3px] after:border-2',
        props.className
      )}
    >
      N
    </span>
  )
}
