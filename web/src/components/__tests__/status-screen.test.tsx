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
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createAppQueryClient } from '@/lib/query-client'

import { StatusScreen, type StatusScreenTone } from '../status-screen'

function renderScreen(tone: StatusScreenTone, action?: React.ReactNode) {
  const root = createRootRoute({
    component: () => (
      <StatusScreen
        tone={tone}
        title='Signing in'
        description='Please wait'
        action={action}
      />
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('status screen', () => {
  it('announces a pending screen as a polite status without a result icon', async () => {
    renderScreen('pending')

    const status = await screen.findByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('heading', { name: 'Signing in' })).toBeVisible()
    expect(status.querySelector('[data-tone]')).toBeNull()
  })

  it('marks an error screen with the error tone and renders its action', async () => {
    renderScreen('error', <button type='button'>Retry</button>)

    const status = await screen.findByRole('status')
    expect(status.querySelector('[data-tone]')).toHaveAttribute(
      'data-tone',
      'error'
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  it('links the brand back to the home page', async () => {
    renderScreen('success')

    expect(await screen.findByRole('link')).toHaveAttribute('href', '/')
  })
})
