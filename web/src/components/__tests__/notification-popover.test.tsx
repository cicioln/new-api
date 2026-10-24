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
import { describe, expect, it, vi } from 'vitest'

import { NotificationPopover } from '../notification-popover'

function renderPopover(unreadCount: number, open = false) {
  render(
    <NotificationPopover
      open={open}
      onOpenChange={vi.fn()}
      unreadCount={unreadCount}
      activeTab='notice'
      onTabChange={vi.fn()}
      notice=''
      announcements={[]}
      loading={false}
    />
  )
}

describe('notification popover trigger', () => {
  it('shows an unread dot and announces the unread count', () => {
    renderPopover(3)

    expect(
      screen.getByRole('button', { name: 'Notifications, 3 unread' })
    ).toBeVisible()
    expect(screen.getByTestId('notification-unread-dot')).toBeInTheDocument()
  })

  it('hides the unread dot when everything is read', () => {
    renderPopover(0)

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeVisible()
    expect(
      screen.queryByTestId('notification-unread-dot')
    ).not.toBeInTheDocument()
  })

  it('renders the header tabs and a close action when open', async () => {
    renderPopover(0, true)

    expect(await screen.findByRole('tab', { name: 'Notice' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Timeline' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
  })
})
