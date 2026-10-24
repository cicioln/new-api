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

import { Skeleton } from '@/components/ui/skeleton'
import dayjs from '@/lib/dayjs'
import { getRoleLabel } from '@/lib/roles'

import { getDisplayName } from '../lib'
import type { UserProfile } from '../types'

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

  const facts: [string, string][] = [
    [t('Group'), profile.group || '—'],
    [t('Role'), getRoleLabel(profile.role)],
    [t('Email'), profile.email || '—'],
    [
      t('Registration time'),
      profile.created_time
        ? dayjs.unix(profile.created_time).format('YYYY-MM-DD')
        : '—',
    ],
    [
      t('Inviter'),
      profile.invite_user_id ? `ID ${profile.invite_user_id}` : '—',
    ],
  ]

  return (
    <section className='bg-card min-w-0 rounded-lg border p-[18px]'>
      <div className='flex items-center gap-3.5'>
        <span
          aria-hidden='true'
          className='from-primary size-[52px] flex-none rounded-[14px] bg-linear-to-br to-[#FFB088]'
        />
        <div className='min-w-0'>
          <h2 className='truncate text-[17px] font-semibold'>
            {getDisplayName(profile)}
          </h2>
          <p className='text-muted-foreground truncate text-[12.5px]'>
            {profile.username} · ID {profile.id}
          </p>
        </div>
      </div>
      <dl className='mt-[18px] grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]'>
        {facts.map(([label, value]) => (
          <div key={label} className='contents'>
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='truncate font-mono text-[12.5px]'>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
