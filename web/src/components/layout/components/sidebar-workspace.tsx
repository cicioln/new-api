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
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSidebar } from '@/components/ui/sidebar'
import { useUserDisplay } from '@/hooks/use-user-display'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Account card under the sidebar logo: name plus "group · role", linking to
 * the profile page.
 */
export function SidebarWorkspace() {
  const { t } = useTranslation()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const user = useAuthStore((s) => s.auth.user)
  const { displayName, roleLabel } = useUserDisplay(user)

  if (!user || (state === 'collapsed' && !isMobile)) return null

  const group = user.group ? String(user.group) : 'default'

  return (
    <Link
      to='/profile'
      onClick={() => setOpenMobile(false)}
      className='bg-card hover:border-input focus-visible:ring-ring/40 mb-3.5 flex items-center gap-2.5 rounded-[9px] border p-2 outline-none focus-visible:ring-2'
    >
      <span
        aria-hidden='true'
        className='from-primary size-7 shrink-0 rounded-[7px] bg-linear-135 to-[#ffb088]'
      />
      <span className='min-w-0 flex-1'>
        <b className='block truncate text-[13px] leading-tight font-semibold'>
          {displayName}
        </b>
        <small className='text-subtle-foreground block truncate text-[11px]'>
          {t('{{group}} group · {{role}}', { group, role: roleLabel })}
        </small>
      </span>
      <ChevronDown
        className='text-subtle-foreground size-3.5 shrink-0'
        aria-hidden='true'
      />
    </Link>
  )
}
