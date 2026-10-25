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
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { createAppQueryClient } from '@/lib/query-client'
import { Route } from '@/routes/chat2link'
import { useAuthStore } from '@/stores/auth-store'

function renderChat2Link(chats: unknown, tokens: unknown[]) {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/status') {
      return { data: { success: true, data: { chats } } } as never
    }
    return {
      data: { success: true, data: { items: tokens, total: tokens.length } },
    } as never
  })
  useAuthStore.getState().auth.setUser({ id: 1, username: 'u', role: 1 })
  const router = createRouter({
    routeTree: createRootRoute({ component: Route.options.component }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  useAuthStore.getState().auth.reset('idle')
})

describe('chat2link states', () => {
  it('shows the no preset state with a dashboard link when no web chat is configured', async () => {
    renderChat2Link([], [])

    expect(
      await screen.findByRole('heading', {
        name: 'No available Web chat links',
      })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Back to Dashboard' })
    ).toHaveAttribute('href', '/dashboard')
  })

  it('shows the key error inline without a global toast when no token is enabled', async () => {
    const toastError = vi.spyOn(toast, 'error')
    renderChat2Link([{ Web: 'https://chat.example.com/?key={key}' }], [])

    expect(
      await screen.findByRole('heading', {
        name: 'No available API keys',
      })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Create key' })).toHaveAttribute(
      'href',
      '/keys'
    )
    expect(toastError).not.toHaveBeenCalled()
  })
})
