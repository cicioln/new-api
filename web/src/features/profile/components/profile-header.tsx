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

import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import dayjs from '@/lib/dayjs'
import { formatNumber, formatQuota } from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'

import { getDisplayName } from '../lib'
import type { UserProfile } from '../types'

// ============================================================================
// Profile Header Component
// ============================================================================

interface ProfileHeaderProps {
  profile: UserProfile | null
  loading: boolean
}

/** Account summary card: avatar and name, then the read-only account facts. */
export function ProfileHeader(props: ProfileHeaderProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <section className='bg-card rounded-lg border p-[18px]'>
        <div className='flex items-center gap-3.5'>
          <Skeleton className='size-[52px] rounded-[14px]' />
          <div className='space-y-2'>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='h-4 w-24' />
          </div>
        </div>
        <div className='mt-[18px] space-y-2.5'>
          {['a', 'b', 'c', 'd', 'e'].map((key) => (
            <Skeleton key={key} className='h-4 w-full' />
          ))}
        </div>
      </section>
    )
  }

  const profile = props.profile
  if (!profile) return null

  const displayName = getDisplayName(profile)
  const avatarName = profile.username || displayName
  const facts: [string, string][] = [
    [t('Group'), profile.group || '-'],
    [t('Role'), getRoleLabel(profile.role)],
    [t('Email'), profile.email || '-'],
    [
      t('Registered'),
      profile.created_time
        ? dayjs(profile.created_time * 1000).format('YYYY-MM-DD')
        : '-',
    ],
    [t('Current Balance'), formatQuota(profile.quota)],
    [t('Total Usage'), formatQuota(profile.used_quota)],
    [t('API Requests'), formatNumber(profile.request_count)],
  ]

  return (
    <section className='bg-card min-w-0 rounded-lg border p-[18px]'>
      <div className='flex items-center gap-3.5'>
        <Avatar className='size-[52px] rounded-[14px] text-base'>
          <AvatarFallback
            className='rounded-[14px] font-semibold text-white'
            style={getUserAvatarStyle(avatarName)}
          >
            {getUserAvatarFallback(avatarName)}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0'>
          <h1 className='truncate text-[17px] font-semibold'>{displayName}</h1>
          <p className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm'>
            <span className='truncate'>{profile.username}</span>
            <span aria-hidden='true'>·</span>
            <StatusBadge
              label={`${t('User ID')} ${profile.id}`}
              variant='neutral'
              copyText={String(profile.id)}
              className='h-auto px-0'
            />
          </p>
        </div>
      </div>
      <dl className='mt-[18px] grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]'>
        {facts.map(([label, value]) => (
          <div key={label} className='contents'>
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='truncate text-right font-medium tabular-nums'>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
