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

import type { TaskLog } from '../../types'
import { TaskStatusTabs } from '../task-status-tabs'
import { UsageLogsProvider } from '../usage-logs-provider'
import { UsageLogsTable } from '../usage-logs-table'

const successTask: TaskLog = {
  id: 1,
  user_id: 3,
  platform: 'kling',
  task_id: 'task_8f3a2c91d4e7b0',
  action: 'text_to_video',
  channel_id: 4,
  group: 'default',
  quota: 120000,
  submit_time: 1788840000,
  finish_time: 1788840125,
  progress: '100%',
  status: 'SUCCESS',
}

const refundedTask: TaskLog = {
  ...successTask,
  id: 2,
  task_id: 'task_failed_refund_01',
  quota: 0,
  finish_time: 0,
  progress: '0%',
  status: 'FAILURE',
  fail_reason: 'content rejected',
}

async function renderTasks() {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    let data: unknown = {}
    if (url.startsWith('/api/task?') || url.startsWith('/api/task/self?')) {
      const status = new URLSearchParams(url.split('?')[1]).get('status')
      data = status
        ? { items: [refundedTask], total: 2 }
        : { items: [successTask, refundedTask], total: 126 }
    }
    return { data: { success: true, data } }
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: () => (
      <>
        <TaskStatusTabs />
        <UsageLogsTable logCategory='task' />
      </>
    ),
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({ initialEntries: ['/usage-logs/task'] }),
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
  await screen.findByText('task_8f3a…b0')
  return { router, get }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  localStorage.clear()
})

it('shows the design task columns in order', async () => {
  await renderTasks()
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers).toEqual([
    'Submit Time',
    'Task ID',
    'Platform',
    'Type',
    'Status',
    'Progress',
    'Duration',
    'Cost',
  ])
})

it('shows status tabs with task counts', async () => {
  await renderTasks()
  expect(await screen.findByRole('tab', { name: 'All126' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByRole('tab', { name: 'Completed' })).toBeVisible()
})

it('filters tasks by status when a tab is clicked', async () => {
  const { router, get } = await renderTasks()
  await userEvent.click(screen.getByRole('tab', { name: /Failed/ }))
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ status: 'failed' })
  )
  await waitFor(() =>
    expect(get.mock.calls.some(([url]) => url.includes('status=FAILURE'))).toBe(
      true
    )
  )
})

it('tags a refunded failure and shows no duration for it', async () => {
  await renderTasks()
  const row = screen.getByText('Failed · Refunded').closest('tr')
  expect(screen.getByText('Failed · Refunded')).toHaveClass('text-destructive')
  expect(row?.querySelectorAll('td')[6]).toHaveTextContent('—')
  expect(
    screen.getByText('task_8f3a…b0').closest('tr')?.querySelectorAll('td')[6]
  ).toHaveTextContent('2m 05s')
})

it('opens the task details dialog when a row is clicked', async () => {
  await renderTasks()
  await userEvent.click(screen.getByText('task_8f3a…b0'))
  expect(await screen.findByRole('dialog')).toBeVisible()
})
