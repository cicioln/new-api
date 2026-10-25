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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

export interface MarketSegProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  'aria-label': string
  className?: string
}

/** Segmented control matching the design's `.seg`. */
export function MarketSeg<T extends string>(props: MarketSegProps<T>) {
  return (
    <ToggleGroup
      value={[props.value]}
      onValueChange={(values: unknown[]) => {
        const next = props.options.find((option) => option.value === values[0])
        if (next) props.onChange(next.value)
      }}
      spacing={0.5}
      aria-label={props['aria-label']}
      className={cn('bg-card gap-0 rounded-lg border p-[3px]', props.className)}
    >
      {props.options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className='text-subtle-foreground hover:text-foreground aria-pressed:text-foreground h-[26px] min-w-0 rounded-md px-2.5 text-[12.5px] font-normal hover:bg-transparent aria-pressed:font-medium'
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
