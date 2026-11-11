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

import { isUserDeleted } from '../constants'
import type { User } from '../types'
import { useUsers } from './users-provider'

// The name opens the user detail panel; deleted users have no panel.
export function UserNameCell(props: { user: User }) {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useUsers()
  const name = (
    <>
      <b className='font-medium!'>
        {props.user.display_name || props.user.username}
      </b>{' '}
      <span className='text-muted-foreground'>{props.user.username}</span>
    </>
  )
  if (isUserDeleted(props.user)) {
    return <span className='whitespace-nowrap'>{name}</span>
  }
  return (
    <button
      type='button'
      className='focus-visible:ring-ring/50 cursor-pointer rounded-sm text-start whitespace-nowrap underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:outline-none'
      aria-label={t('View details of {{username}}', {
        username: props.user.username,
      })}
      onClick={(event) => {
        event.stopPropagation()
        setCurrentRow(props.user)
        setOpen('detail')
      }}
    >
      {name}
    </button>
  )
}
