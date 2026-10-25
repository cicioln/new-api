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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { checkIsActive } from '@/components/layout/lib/url-utils'

import { SettingsNav } from '../settings-nav'

function renderNav(path: string) {
  const root = createRootRoute({ component: SettingsNav })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
}

describe('SettingsNav', () => {
  it('lists every group and marks the current section', async () => {
    renderNav('/system-settings/site/system-info')

    const nav = await screen.findByRole('navigation', {
      name: 'System Settings',
    })
    for (const group of ['Site', 'Auth', 'Billing', 'Security']) {
      expect(within(nav).getByText(group)).toBeInTheDocument()
    }
    const current = within(nav).getByRole('link', {
      name: 'System Information',
    })
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(
      within(nav).getByRole('link', { name: 'System Notice' })
    ).not.toHaveAttribute('aria-current')
  })
})

describe('checkIsActive activePathPrefix', () => {
  const item = {
    title: 'System Settings',
    url: '/system-settings/site/system-info',
    activePathPrefix: '/system-settings',
  } as const

  it('matches the prefix and nested paths only', () => {
    expect(checkIsActive('/system-settings', item)).toBe(true)
    expect(checkIsActive('/system-settings/security/ssrf', item)).toBe(true)
    expect(checkIsActive('/system-settings-extra', item)).toBe(false)
  })
})
