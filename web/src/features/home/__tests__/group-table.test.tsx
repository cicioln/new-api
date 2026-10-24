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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { GroupTable } from '../components/sections/group-table'

const navigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}))

function mockApi(groups: unknown) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/home/groups') return groups as never
    return { data: { success: true, data: [] } } as never
  })
}

function renderTable() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <GroupTable />
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  navigate.mockReset()
})

describe('home group table', () => {
  it('shows ratio, model count and 1h status, and opens pricing for a group', async () => {
    mockApi({
      data: {
        success: true,
        data: {
          window_start: 0,
          window_end: 3600,
          groups: [
            {
              group: 'vip',
              desc: 'VIP line',
              ratio: 0.8,
              model_count: 12,
              success_rate: 99.4,
              avg_latency_ms: 820,
            },
            {
              group: 'default',
              desc: 'default',
              ratio: 1,
              model_count: 5,
              success_rate: null,
              avg_latency_ms: null,
            },
          ],
        },
      },
    })
    const user = userEvent.setup()
    renderTable()

    const vipRow = (await screen.findByText('vip')).closest('tr')
    expect(vipRow).toHaveTextContent('VIP line')
    expect(vipRow).toHaveTextContent('×0.8')
    expect(vipRow).toHaveTextContent('12')
    expect(vipRow).toHaveTextContent('99.4%')
    expect(vipRow).toHaveTextContent('820ms')

    const idleRow = screen.getByText('default').closest('tr')
    expect(idleRow).toHaveTextContent('No data')

    await user.click(screen.getByText('vip'))
    expect(navigate).toHaveBeenCalledWith({
      to: '/pricing',
      search: { group: 'vip' },
    })
  })

  it('offers a retry when the group summary fails to load', async () => {
    const get = mockApi({ data: { success: false, message: 'boom' } })
    const user = userEvent.setup()
    renderTable()

    expect(await screen.findByText('Failed to load groups')).toBeInTheDocument()
    const before = get.mock.calls.filter(
      ([url]) => url === '/api/home/groups'
    ).length
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      get.mock.calls.filter(([url]) => url === '/api/home/groups').length
    ).toBeGreaterThan(before)
  })

  it('shows an empty state when no groups are usable', async () => {
    mockApi({
      data: {
        success: true,
        data: { window_start: 0, window_end: 3600, groups: [] },
      },
    })
    renderTable()

    expect(await screen.findByText('No groups available')).toBeInTheDocument()
  })
})
