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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmailBindDialog } from '@/features/security/components/dialogs/email-bind-dialog'

import type { UpdateUserRequest, UserProfile } from '../types'

/** Server-side limit of `display_name` (model.User validate:"max=20"). */
const DISPLAY_NAME_MAX = 20

interface BasicInfoCardProps {
  profile: UserProfile | null
  loading: boolean
  updating: boolean
  onSave: (data: UpdateUserRequest) => Promise<boolean>
  onProfileUpdate: () => void
}

/** Editable account basics: display name, read-only username, email. */
export function BasicInfoCard(props: BasicInfoCardProps) {
  const { t } = useTranslation()
  const [displayName, setDisplayName] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const savedName = props.profile?.display_name ?? ''

  useEffect(() => {
    setDisplayName(savedName)
  }, [savedName])

  if (props.loading || !props.profile) {
    return (
      <section className='bg-card min-w-0 rounded-lg border p-[18px]'>
        <Skeleton className='h-5 w-24' />
        <Skeleton className='mt-2 h-4 w-64' />
        <Skeleton className='mt-4 h-10 w-full' />
        <Skeleton className='mt-3.5 h-10 w-full' />
      </section>
    )
  }

  const profile = props.profile
  const trimmed = displayName.trim()
  const unchanged = trimmed === savedName

  return (
    <section
      aria-labelledby='profile-basic-info'
      className='bg-card min-w-0 rounded-lg border p-[18px]'
    >
      <h3 id='profile-basic-info' className='text-sm font-semibold'>
        {t('Basic information')}
      </h3>
      <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
        {t('Shown in audit logs instead of your username.')}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (unchanged || props.updating) return
          void props.onSave({ display_name: trimmed })
        }}
      >
        <div className='grid gap-x-3.5 sm:grid-cols-2'>
          <div className='mb-3.5'>
            <Label
              htmlFor='profile-display-name'
              className='mb-1.5 text-[13px]'
            >
              {t('Display name')}
            </Label>
            <Input
              id='profile-display-name'
              className='h-10'
              value={displayName}
              maxLength={DISPLAY_NAME_MAX}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className='mb-3.5'>
            <Label htmlFor='profile-username' className='mb-1.5 text-[13px]'>
              {t('Username')}
            </Label>
            <Input
              id='profile-username'
              className='h-10'
              value={profile.username}
              readOnly
            />
          </div>
          <div className='mb-3.5 sm:col-span-2'>
            <Label htmlFor='profile-email' className='mb-1.5 text-[13px]'>
              {t('Email')}
            </Label>
            <div className='flex gap-2'>
              <Input
                id='profile-email'
                className='h-10'
                value={profile.email ?? ''}
                placeholder={t('Not bound')}
                readOnly
              />
              <Button
                type='button'
                variant='outline'
                className='h-10 flex-none'
                onClick={() => setEmailOpen(true)}
              >
                {profile.email ? t('Change email') : t('Bind')}
              </Button>
            </div>
          </div>
        </div>
        <div className='flex justify-end'>
          <Button type='submit' size='sm' disabled={props.updating}>
            {t('Save')}
          </Button>
        </div>
      </form>
      <EmailBindDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        currentEmail={profile.email}
        onSuccess={props.onProfileUpdate}
      />
    </section>
  )
}
