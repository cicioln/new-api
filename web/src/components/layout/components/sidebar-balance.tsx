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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Balance card pinned to the bottom of the console sidebar. The bar shows
 * the remaining share of quota (remaining / (remaining + used)).
 */
export function SidebarBalance() {
  const { t } = useTranslation()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const user = useAuthStore((s) => s.auth.user)

  if (!user || (state === 'collapsed' && !isMobile)) return null

  const remain = Math.max(0, Number(user.quota ?? 0))
  const used = Math.max(0, Number(user.used_quota ?? 0))
  const total = remain + used
  const percent = total > 0 ? Math.round((remain / total) * 100) : 0

  return (
    <div className='bg-card mx-2 mb-2 rounded-[10px] border p-3.5'>
      <p className='text-subtle-foreground text-xs'>{t('Balance')}</p>
      <p className='mt-0.5 mb-2.5 text-[22px] font-semibold tracking-tight tabular-nums'>
        {formatQuota(remain)}
      </p>
      <div
        role='progressbar'
        aria-label={t('Remaining quota')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className='bg-muted mb-2.5 h-1 overflow-hidden rounded-full'
      >
        <div className='bg-primary h-full' style={{ width: `${percent}%` }} />
      </div>
      <Button
        variant='outline'
        size='sm'
        className='w-full'
        render={<Link to='/wallet' onClick={() => setOpenMobile(false)} />}
      >
        {t('Recharge')}
      </Button>
    </div>
  )
}
