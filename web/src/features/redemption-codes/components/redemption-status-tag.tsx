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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { REDEMPTION_STATUS } from '../constants'
import { isRedemptionExpired } from '../lib'
import type { Redemption } from '../types'

const tagClass =
  'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[12px]! font-medium! whitespace-nowrap'

function getRedemptionDisplayStatus(redemption: Redemption) {
  if (isRedemptionExpired(redemption.expired_time, redemption.status)) {
    return {
      label: 'Expired',
      className: 'bg-destructive/10 text-destructive',
    }
  }
  if (redemption.status === REDEMPTION_STATUS.ENABLED) {
    return { label: 'Unused', className: 'bg-success/12 text-success' }
  }
  return {
    label: redemption.status === REDEMPTION_STATUS.USED ? 'Used' : 'Disabled',
    className: 'bg-muted text-muted-foreground',
  }
}

export function RedemptionStatusTag(props: { redemption: Redemption }) {
  const { t } = useTranslation()
  const status = getRedemptionDisplayStatus(props.redemption)
  return (
    <span className={cn(tagClass, status.className)}>
      <span className='size-1.5 rounded-full bg-current' aria-hidden='true' />
      {t(status.label)}
    </span>
  )
}
