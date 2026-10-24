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
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationStore } from '@/stores/notification-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { OverviewDashboard } from '../overview-dashboard'

const periodKey = 'dashboard_overview_period'
let client: QueryClient
let dataRequests: Array<Record<string, unknown>>
let logItems: Array<Record<string, unknown>>
let failureTotal: number
let tokenStat: Record<string, number>
let notice: string

beforeEach(() => {
  window.localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    display_name: 'Alice',
    role: 1,
    quota: 1000000,
    used_quota: 1000,
    request_count: 1,
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  dataRequests = []
  logItems = []
  failureTotal = 0
  tokenStat = { quota: 0, rpm: 0, tpm: 0 }
  notice = ''
  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    switch (url) {
      case '/api/token/?p=1&size=10':
        return {
          data: {
            success: true,
            data: { items: [{ id: 1, name: 'App', key: 'k', status: 1 }] },
          },
        }
      case '/api/status':
        return { data: { data: {} } }
      case '/api/user/models':
        return { data: { success: true, data: ['gpt-4o-mini'] } }
      case '/api/data/self':
        dataRequests.push(config?.params as Record<string, unknown>)
        return { data: { success: true, data: [] } }
      case '/api/log/self?p=1&page_size=6':
        return {
          data: { success: true, data: { items: logItems, total: 0 } },
        }
      case '/api/perf-metrics/summary':
        return {
          data: {
            success: true,
            data: {
              summary: { success_rate: 98.5, avg_latency_ms: 900, avg_tps: 3 },
              window_end: 1793000000,
              models: [{ model_name: 'gpt-4o-mini', success_rate: 98.5 }],
            },
          },
        }
      case '/api/notice':
        return { data: { success: true, data: notice } }
      default:
        break
    }
    if (String(url).startsWith('/api/log/self/stat?')) {
      return { data: { success: true, data: tokenStat } }
    }
    if (
      String(url).startsWith('/api/log/self?p=1&page_size=') &&
      String(url).includes('type=5')
    ) {
      return {
        data: { success: true, data: { items: [], total: failureTotal } },
      }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useNotificationStore.setState(useNotificationStore.getInitialState(), true)
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

describe('overview period switch', () => {
  it('defaults to 7 days and greets the user by display name', async () => {
    await renderOverview()
    const group = await screen.findByRole('group', { name: 'Time range' })
    expect(
      within(group).getByRole('button', { name: '7 days' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('heading')[0]).toHaveTextContent(/Alice$/)
  })

  it('requests hourly data and remembers the choice when switching to 24 hours', async () => {
    const user = userEvent.setup()
    await renderOverview()
    await user.click(await screen.findByRole('button', { name: '24 hours' }))

    expect(screen.getByRole('button', { name: '24 hours' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(dataRequests.at(-1)?.default_time).toBe('hour')
    expect(window.localStorage.getItem(periodKey)).toBe('24h')
  })

  it('falls back to 7 days when the saved period is invalid', async () => {
    window.localStorage.setItem(periodKey, 'forever')
    await renderOverview()
    expect(
      await screen.findByRole('button', { name: '7 days' })
    ).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('overview panels', () => {
  it('shows per-model availability rows with one decimal', async () => {
    await renderOverview()
    expect(
      await screen.findByRole('heading', { name: 'Channel availability' })
    ).toBeVisible()
    expect(await screen.findByText('98.5%')).toBeVisible()
  })

  it('counts failed calls from error logs under the success rate', async () => {
    failureTotal = 3
    await renderOverview()
    expect(
      await screen.findByText('3 failures retried automatically')
    ).toBeVisible()
  })

  it('splits token usage into input and output when the stat reports them', async () => {
    tokenStat = { ...tokenStat, prompt_tokens: 1200, completion_tokens: 300 }
    await renderOverview()
    expect(await screen.findByText(/Input 1\.2K · Output 300/)).toBeVisible()
  })

  it('shows the system notice once and hides it for the day after muting', async () => {
    const user = userEvent.setup()
    notice = 'Database upgrade tonight'
    const first = await renderOverview()
    const dialog = await screen.findByRole('dialog', { name: 'System Notice' })
    expect(
      await within(dialog).findByText('Database upgrade tonight')
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: "Don't show again today" })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    first.unmount()

    await renderOverview()
    await screen.findByRole('heading', { name: 'Request trend' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists only API calls in recent requests with their HTTP status', async () => {
    logItems = [
      {
        id: 1,
        user_id: 1,
        created_at: 1793000000,
        type: 2,
        content: '',
        model_name: 'gpt-4o-mini',
        token_name: 'App',
        quota: 100,
        prompt_tokens: 10,
        completion_tokens: 5,
        use_time: 1,
      },
      {
        id: 2,
        user_id: 1,
        created_at: 1793000001,
        type: 5,
        content: '',
        model_name: 'broken-model',
        token_name: 'App',
        other: JSON.stringify({ status_code: 429 }),
      },
      {
        id: 3,
        user_id: 1,
        created_at: 1793000002,
        type: 1,
        content: 'top-up',
        model_name: 'top-up-row',
      },
    ]
    await renderOverview()
    const table = (await screen.findByText('broken-model')).closest('table')
    if (!table) throw new Error('recent requests table missing')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('200')).toBeVisible()
    expect(within(rows[1]).getByText('429')).toBeVisible()
    expect(screen.queryByText('top-up-row')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no requests', async () => {
    await renderOverview()
    expect(await screen.findByText('No requests yet')).toBeVisible()
    expect(await screen.findByText('No usage in this period')).toBeVisible()
  })
})
