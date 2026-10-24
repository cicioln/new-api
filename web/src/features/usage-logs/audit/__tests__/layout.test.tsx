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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import dayjs from '@/lib/dayjs'
import { useAuthStore } from '@/stores/auth-store'

import { AuditLogs } from '..'

const chrome =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36'
const items = [
  {
    event_id: 'create-token',
    user_id: 2,
    username: 'zhangxm',
    actor_role: 1,
    created_at: dayjs('2026-10-23T14:12:00').unix(),
    category: 'operation',
    action: 'token.create',
    token_ref: '',
    ip: '203.0.113.24',
    user_agent: chrome,
    method: 'POST',
    route: '/api/token/',
    status: 200,
    success: true,
    request_id: 'req-1',
    content: '',
    other: {
      op: { action: 'token.create', params: { id: 7, name: 'Claude Code' } },
    },
  },
  {
    event_id: 'login-failed',
    user_id: 3,
    username: 'unknown',
    actor_role: 1,
    created_at: dayjs('2026-10-22T22:05:00').unix(),
    category: 'login',
    action: 'user.login',
    token_ref: '',
    ip: '198.51.100.7',
    user_agent: 'curl/8.7.1',
    method: 'POST',
    route: '/api/user/login',
    status: 401,
    success: false,
    request_id: 'req-2',
    content: 'Login failed',
    other: {},
  },
]

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'admin',
    role: 100,
  })
})
afterEach(() => {
  cleanup()
  useAuthStore.getState().auth.reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderPage() {
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { items, total: items.length } },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <AuditLogs />
    </QueryClientProvider>
  )
  return get
}

it('renders the design header, toolbar and seven columns', async () => {
  renderPage()
  expect(
    screen.getByText(
      'Sign-in, key, top-up and settings changes and other sensitive operations.'
    )
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Export' })).toBeVisible()
  expect(screen.getByPlaceholderText('Search action or IP')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Action type' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Operator' })).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Date Range' })
  ).not.toBeInTheDocument()

  const created = await screen.findByRole('row', { name: /zhangxm/ })
  expect(
    screen.getAllByRole('columnheader').map((header) => header.textContent)
  ).toEqual(['Time', 'Operator', 'Action', 'Object', 'IP', 'Client', 'Result'])
  const cells = within(created).getAllByRole('cell')
  expect(cells.map((cell) => cell.textContent)).toEqual([
    '10-23 14:12',
    'zhangxm',
    'Create API token “Claude Code”(ID: 7)',
    '—',
    '203.0.113.24',
    'Chrome · macOS',
    'Success',
  ])
  const failed = screen.getByRole('row', { name: /198\.51\.100\.7/ })
  expect(within(failed).getByText('curl')).toBeVisible()
  expect(within(failed).getByText('Blocked')).toHaveClass('text-destructive')
  expect(screen.getByText('2 records total')).toBeVisible()
})

it('sends the search keyword and the action type category', async () => {
  const get = renderPage()
  const user = userEvent.setup()
  await screen.findByRole('row', { name: /zhangxm/ })
  await user.type(
    screen.getByPlaceholderText('Search action or IP'),
    ' 203.0.113 {Enter}'
  )
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/api/audit', {
      params: expect.objectContaining({ keyword: '203.0.113', p: 1 }),
    })
  )
  await user.click(screen.getByRole('button', { name: 'Action type' }))
  await user.click(await screen.findByRole('option', { name: 'Login' }))
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/api/audit', {
      params: expect.objectContaining({
        category: 'login',
        keyword: '203.0.113',
      }),
    })
  )
})

it('opens details from a row click and exports the filtered records', async () => {
  const get = renderPage()
  const user = userEvent.setup()
  const createObjectURL = vi.fn(() => 'blob:audit')
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL,
    revokeObjectURL: vi.fn(),
  })
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
  await user.click(await screen.findByRole('row', { name: /zhangxm/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Log Details' })
  expect(within(dialog).getByText('req-1')).toBeVisible()
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )

  await user.click(screen.getByRole('button', { name: 'Export' }))
  await waitFor(() => expect(click).toHaveBeenCalled())
  expect(get).toHaveBeenLastCalledWith('/api/audit', {
    params: expect.objectContaining({ p: 1, page_size: 100 }),
  })
  expect(createObjectURL).toHaveBeenCalledTimes(1)
})
