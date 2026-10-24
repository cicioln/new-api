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
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { ProfileHeader } from '../components/profile-header'
import type { UserProfile } from '../types'

const profile = {
  id: 1024,
  username: 'alice',
  display_name: 'Alice',
  role: 1,
  group: 'vip',
  email: '',
  quota: 0,
  used_quota: 0,
  request_count: 12,
  status: 1,
  aff_count: 0,
  aff_quota: 0,
  created_time: 0,
} as unknown as UserProfile

it('shows the display name as the heading with the account facts listed below', () => {
  render(<ProfileHeader profile={profile} loading={false} />)
  expect(screen.getByRole('heading', { name: 'Alice' })).toBeVisible()
  expect(screen.getByText(/· ID 1024/)).toBeVisible()
  expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
    'Group',
    'Role',
    'Email',
    'Registration time',
    'Inviter',
  ])
  expect(screen.getByText('vip')).toBeVisible()
})

it('falls back to a dash for missing email, registration date and inviter', () => {
  render(<ProfileHeader profile={profile} loading={false} />)
  const terms = screen.getAllByRole('term').map((term) => term.textContent)
  const values = screen
    .getAllByRole('definition')
    .map((value) => value.textContent)
  expect(values[terms.indexOf('Email')]).toBe('—')
  expect(values[terms.indexOf('Registration time')]).toBe('—')
  expect(values[terms.indexOf('Inviter')]).toBe('—')
})

it('renders nothing once loading finishes without a profile', () => {
  const { container } = render(<ProfileHeader profile={null} loading={false} />)
  expect(container).toBeEmptyDOMElement()
})
