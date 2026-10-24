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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { OverviewDashboard } from '../overview-dashboard'

let client: QueryClient

beforeEach(() => {
  window.localStorage.clear()
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'dashboard-user',
    role: 1,
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    switch (url) {
      case '/api/data/self':
        return { data: { success: true, data: [] } }
      case '/api/log/self?p=1&page_size=6':
        return { data: { success: true, data: { items: [], total: 0 } } }
      case '/api/perf-metrics/summary':
        return { data: { success: true, data: { models: [], summary: null } } }
      case '/api/notice':
        return { data: { success: true, data: '' } }
      default:
        break
    }
    if (String(url).startsWith('/api/log/self/stat?')) {
      return { data: { success: true, data: { quota: 0, rpm: 0, tpm: 0 } } }
    }
    if (String(url).includes('type=5')) {
      return { data: { success: true, data: { items: [], total: 0 } } }
    }
    throw new Error(`Unexpected dashboard request: ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  window.localStorage.clear()
})

async function renderOverview() {
  const router = createRouter({
    routeTree: createRootRoute({ component: OverviewDashboard }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('overview dashboard layout', () => {
  it('renders only the greeting and the four usage panels, without a setup guide', async () => {
    await renderOverview()

    await screen.findByRole('heading', { name: 'Request trend' })
    const headings = screen
      .getAllByRole('heading')
      .map((heading) => heading.textContent)
    expect(headings[0]).toMatch(/dashboard-user$/)
    expect(headings.slice(1)).toEqual([
      'Request trend',
      'Model usage distribution',
      'Recent requests',
      'Channel availability',
    ])
    expect(
      screen.queryByRole('button', { name: /setup guide/i })
    ).not.toBeInTheDocument()
  })

  it('selecting a period marks it pressed and remembers it after remounting', async () => {
    const user = userEvent.setup()
    const first = await renderOverview()
    const day = await screen.findByRole('button', { name: '24 hours' })
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.click(day)
    expect(day).toHaveAttribute('aria-pressed', 'true')
    first.unmount()

    await renderOverview()
    expect(
      await screen.findByRole('button', { name: '24 hours' })
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
