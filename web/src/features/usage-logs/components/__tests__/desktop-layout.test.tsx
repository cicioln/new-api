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
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { usageLogSchema } from '../../data/schema'
import { UsageLogsProvider } from '../usage-logs-provider'
import { UsageLogsTable } from '../usage-logs-table'

const errorLog = usageLogSchema.parse({
  id: 1,
  user_id: 3,
  created_at: 1788840000,
  type: 5,
  content: 'upstream rate limited',
  username: 'zhangxm',
  token_name: 'production',
  model_name: 'gemini-3-pro',
  group: 'default',
  channel: 9,
  channel_name: 'gemini-vertex',
  quota: 0,
  use_time: 0,
  other: JSON.stringify({
    status_code: 429,
    admin_info: { use_channel: [9, 12] },
  }),
})

const chatLog = usageLogSchema.parse({
  id: 2,
  user_id: 3,
  created_at: 1788840060,
  type: 2,
  content: '',
  username: 'lin_w',
  token_name: 'cursor',
  model_name: 'gpt-5.2',
  group: 'vip',
  channel: 4,
  channel_name: 'openai-main',
  quota: 5000,
  prompt_tokens: 1020,
  completion_tokens: 184,
  use_time: 1,
  is_stream: true,
  other: JSON.stringify({ frt: 400, model_ratio: 1 }),
})

const embeddingLog = usageLogSchema.parse({
  id: 3,
  user_id: 3,
  created_at: 1788840120,
  type: 2,
  content: '',
  username: 'lin_w',
  token_name: 'cursor',
  model_name: 'text-embedding-3-large',
  group: 'vip',
  channel: 4,
  channel_name: 'openai-main',
  quota: 20,
  prompt_tokens: 64,
  completion_tokens: 0,
  use_time: 0,
  other: JSON.stringify({ request_path: '/v1/embeddings' }),
})

async function renderLogs(role: number) {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'tester', role })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    let data: unknown = { quota: 0, rpm: 0, tpm: 0 }
    if (url.startsWith('/api/log?') || url.startsWith('/api/log/self?')) {
      data = { items: [errorLog, chatLog, embeddingLog], total: 48213 }
    } else if (url === '/api/group/') {
      data = []
    } else if (url === '/api/user/self/groups') {
      data = {}
    } else if (url.startsWith('/api/subscription')) {
      data = []
    }
    return { data: { success: true, data } }
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: () => <UsageLogsTable logCategory='common' />,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({ initialEntries: ['/usage-logs/common'] }),
  })
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <UsageLogsProvider>
        <RouterProvider router={router} />
      </UsageLogsProvider>
    </QueryClientProvider>
  )
  await screen.findByText('gpt-5.2')
  return router
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  localStorage.clear()
})

it('shows the design columns in order for administrators', async () => {
  await renderLogs(ROLE.ADMIN)
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers).toEqual([
    'Time',
    'User',
    'Key',
    'Model',
    'Group',
    'Type',
    'Input',
    'Output',
    'First token / Total',
    'Cost',
    'Channel',
  ])
})

it('omits user and channel columns in the personal view', async () => {
  await renderLogs(ROLE.USER)
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers).not.toContain('User')
  expect(headers).not.toContain('Channel')
  expect(screen.queryByRole('button', { name: /User/ })).not.toBeInTheDocument()
})

it('labels a retried error with its status code as a warning tag', async () => {
  await renderLogs(ROLE.ADMIN)
  expect(screen.getByText('Error 429 Retried')).toHaveClass('text-warning')
})

it('tags consume rows by the request kind from the relay path', async () => {
  await renderLogs(ROLE.ADMIN)
  const typeCell = (model: string) =>
    screen.getByText(model).closest('tr')?.querySelectorAll('td')[5]
  expect(typeCell('gpt-5.2')).toHaveTextContent('Conversation')
  expect(typeCell('text-embedding-3-large')).toHaveTextContent('Embedding')
})

it('right-aligns numeric columns and shows first token over total time', async () => {
  await renderLogs(ROLE.ADMIN)
  const timing = screen.getByText('0.4s / 1.0s')
  expect(timing.closest('td')).toHaveClass('text-right')
  expect(screen.getByText('1,020').closest('td')).toHaveClass('text-right')
})

it('uses the simple pager with the formatted record total', async () => {
  await renderLogs(ROLE.ADMIN)
  expect(screen.getByText('48,213 records total')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
})

it('offers dashed type, user and channel chips instead of search buttons', async () => {
  await renderLogs(ROLE.ADMIN)
  expect(screen.getByRole('textbox', { name: 'Model Name' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Key Name' })).toBeVisible()
  for (const name of ['Type', 'User', 'Channel']) {
    expect(screen.getByRole('button', { name })).toHaveClass('border-dashed')
  }
  expect(
    screen.queryByRole('button', { name: 'Search' })
  ).not.toBeInTheDocument()
})

it('applies a channel chip value to the URL search', async () => {
  const user = userEvent.setup()
  const router = await renderLogs(ROLE.ADMIN)
  await user.click(screen.getByRole('button', { name: 'Channel' }))
  await user.type(
    await screen.findByRole('textbox', { name: 'Channel' }),
    '12{Enter}'
  )
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ channel: '12' })
  )
})

it('opens the log details when a row is clicked', async () => {
  const user = userEvent.setup()
  await renderLogs(ROLE.ADMIN)
  await user.click(screen.getByText('gpt-5.2'))
  expect(await screen.findByRole('dialog')).toBeVisible()
})
