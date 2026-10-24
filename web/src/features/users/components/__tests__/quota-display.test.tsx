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
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import type { User } from '../../types'
import { useUsersColumns } from '../users-columns'
import { UsersProvider } from '../users-provider'
import { UsersTable } from '../users-table'

const clients: QueryClient[] = []
const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

function QuotaTable(props: { remaining: number; used: number }) {
  const columns = useUsersColumns().filter((column) =>
    ['quota', 'used_quota'].includes(
      column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')
    )
  )
  const table = useReactTable({
    columns,
    data: [
      {
        id: 1,
        username: 'test',
        display_name: '',
        role: 1,
        status: 1,
        quota: props.remaining,
        used_quota: props.used,
        request_count: 0,
        group: 'default',
      } as User,
    ],
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th key={header.id} data-sortable={header.column.getCanSort()}>
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

it('shows the used share as a progress bar and opens quota details on click', async () => {
  render(
    <I18nextProvider i18n={i18n}>
      <QuotaTable remaining={1900} used={1100} />
    </I18nextProvider>
  )
  expect(
    screen.getByRole('columnheader', { name: 'Quota usage' })
  ).toBeInTheDocument()
  expect(screen.getAllByRole('columnheader')).toHaveLength(1)
  const bar = screen.getByRole('progressbar', { name: 'Used percentage' })
  expect(bar).toHaveAttribute('aria-valuenow', '37')
  expect(screen.getByText('37%')).toBeInTheDocument()
  expect(bar.firstElementChild).toHaveClass('bg-primary')
  const trigger = screen.getByRole('button', { name: 'Used percentage 37%' })
  await userEvent.click(trigger)
  const detail = await screen.findByRole('dialog', { name: 'Quota ($)' })
  expect(within(detail).getByText('Available Balance')).toBeInTheDocument()
  expect(within(detail).getByText('Total Used')).toBeInTheDocument()
  expect(within(detail).getByText('0.0038')).toBeInTheDocument()
  expect(within(detail).getByText('0.0022')).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(trigger).toHaveFocus()
})

it.each([
  { remaining: 0, used: 0, percent: '0' },
  { remaining: 50, used: 950, percent: '95' },
  { remaining: -500000, used: 1000000, percent: '100' },
])('clamps the used share to 0-100 and flags heavy usage (%o)', (props) => {
  render(
    <I18nextProvider i18n={i18n}>
      <QuotaTable remaining={props.remaining} used={props.used} />
    </I18nextProvider>
  )
  const bar = screen.getByRole('progressbar')
  expect(bar).toHaveAttribute('aria-valuenow', props.percent)
  expect(bar.firstElementChild).toHaveClass(
    Number(props.percent) > 90 ? 'bg-destructive' : 'bg-primary'
  )
})

it('uses the configured currency unit in the quota details title', async () => {
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'TOKENS' },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <QuotaTable remaining={100} used={200} />
    </I18nextProvider>
  )
  await userEvent.click(screen.getByRole('button'))
  const detail = await screen.findByRole('dialog', { name: 'Quota (Tokens)' })
  expect(within(detail).getByText('100')).toBeInTheDocument()
  expect(within(detail).getByText('200')).toBeInTheDocument()
})

function UsersPage() {
  return (
    <TooltipProvider>
      <UsersProvider>
        <UsersTable />
      </UsersProvider>
    </TooltipProvider>
  )
}

async function renderUsersList(emptyInvitation = false) {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 100 })
  const usersResponse = {
    data: {
      success: true,
      data: {
        items: [
          {
            id: 2,
            username: 'long-user-name-for-table-layout',
            display_name: 'A display name',
            role: 1,
            status: 1,
            quota: 1900,
            used_quota: 1100,
            request_count: 0,
            created_at: Math.floor(Date.now() / 1000) - 86400,
            last_login_at: Math.floor(Date.now() / 1000) - 20,
            group: 'default',
            aff_count: emptyInvitation ? 0 : 2,
            aff_history_quota: emptyInvitation ? 0 : 500000,
            inviter_id: emptyInvitation ? 0 : 42,
          },
        ],
        total: 1,
      },
    },
  }
  const get = vi
    .spyOn(api, 'get')
    .mockImplementation(async (url) =>
      url === '/api/group/'
        ? { data: { success: true, data: ['default'] } }
        : usersResponse
    )
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const users = createRoute({
    getParentRoute: () => auth,
    path: 'users/',
    component: UsersPage,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([users])]),
    history: createMemoryHistory({ initialEntries: ['/users/'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  await router.load()
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByText('long-user-name-for-table-layout')
  return get
}

it('renders the design columns with names, roles, status tags and counts', async () => {
  await renderUsersList()
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers).toEqual([
    'ID',
    'User',
    'Group',
    'Role',
    'Status',
    'Quota usage',
    'Requests',
    'Invites',
    'Actions',
  ])
  const row = screen.getByRole('row', {
    name: /long-user-name-for-table-layout/,
  })
  expect(within(row).getByText('A display name')).toHaveClass('font-medium!')
  expect(within(row).getByText('default')).toBeInTheDocument()
  expect(within(row).getByText('Regular user')).toBeInTheDocument()
  expect(within(row).getByText('Normal')).toHaveClass('text-success')
  expect(within(row).getAllByRole('cell')[7]).toHaveTextContent(/^2$/)
  expect(screen.getByText('1 users total')).toBeInTheDocument()
})
