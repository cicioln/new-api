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
import type { CSSProperties } from 'react'

import {
  getFamilyColor,
  parseModelName,
} from '@/features/pricing/lib/model-name'
import { cn } from '@/lib/utils'

/** Family + colored version + tag chips, matching the model square cards. */
export function RankingModelName(props: {
  modelName: string
  className?: string
}) {
  const parsed = parseModelName(props.modelName)
  return (
    <span
      title={props.modelName}
      className={cn(
        'flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-tight',
        props.className
      )}
      style={{ '--family': getFamilyColor(parsed) } as CSSProperties}
    >
      <b className='truncate font-semibold'>{parsed.label}</b>
      {parsed.version && (
        <span className='font-semibold text-(--family) tabular-nums'>
          {parsed.version}
        </span>
      )}
      {parsed.tags.map((tag) => (
        <span
          key={tag}
          className='bg-muted text-muted-foreground self-center rounded-[5px] px-1.5 text-[11px] leading-[18px] font-normal'
        >
          {tag}
        </span>
      ))}
    </span>
  )
}
