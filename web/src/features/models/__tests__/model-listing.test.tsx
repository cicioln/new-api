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
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router'
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { ModelsDialogs } from '../components/models-dialogs'
import { ModelsProvider } from '../components/models-provider'
import { ModelsTable } from '../components/models-table'
import type { Model } from '../types'

const metadata: Model = {
  id: 7,
  model_name: 'catalog-model',
  vendor_id: 3,
  tags: 'chat,reason',
  endpoints: '',
  supported_endpoints: ['anthropic', 'openai'],
  quota_types: [0],
  configured_channel_count: 2,
  name_rule: 0,
  status: 1,
  sync_official: 1,
  created_time: 1,
  updated_time: 1,
}
const channel: Model = {
  ...metadata,
  id: 0,
  model_name: 'channel-only',
  vendor_id: undefined,
  tags: '',
  supported_endpoints: ['image-generation'],
  quota_types: [1],
  configured_channel_count: 1,
  status: 0,
}
const clients: QueryClient[] = []

function Page() {
  return (
    <ModelsProvider>
      <ModelsTable />
      <ModelsDialogs />
    </ModelsProvider>
  )
}

async function renderList(
  items: Model[] = [metadata, channel],
  total?: number
) {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 100 })
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/models/') {
      return {
        data: { success: true, data: { items, total: total ?? items.length } },
      }
    }
    if (url === '/api/vendors/') {
      return {
        data: {
          success: true,
          data: { items: [{ id: 3, name: 'Anthropic', status: 1 }], total: 1 },
        },
      }
    }
    if (url === '/api/models/7') {
      return { data: { success: true, data: metadata } }
    }
    return { data: { success: true, data: { items: [] } } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  const root = createRootRoute()
  const authenticated = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
  })
  const models = createRoute({
    getParentRoute: () => authenticated,
    path: 'models/$section',
    component: Page,
  })
  const router = createRouter({
    routeTree: root.addChildren([authenticated.addChildren([models])]),
    history: createMemoryHistory({ initialEntries: ['/models/metadata'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  if (items.length) {
    await screen.findByRole('button', { name: items[0].model_name })
  } else await screen.findByText('No Models Found')
  await waitFor(() => expect(client.isFetching()).toBe(0))
  return { get }
}

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
})

it('lists models with the design columns and no toolbar', async () => {
  const { get } = await renderList()
  expect(get).toHaveBeenCalledWith('/api/models/', {
    params: expect.objectContaining({ include_channel_models: true }),
  })
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers).toEqual([
    'Model',
    'Vendor',
    'Tags',
    'Endpoints',
    'Channel count',
    'Billing',
    'Listed',
    'Actions',
  ])
  expect(
    screen.queryByPlaceholderText('Filter by model name...')
  ).not.toBeInTheDocument()
  const row = screen.getByRole('row', { name: /catalog-model/ })
  expect(within(row).getByText('Anthropic')).toBeVisible()
  expect(within(row).getByText('chat')).toBeVisible()
  expect(within(row).getByText('reason')).toBeVisible()
  expect(within(row).getByText('/v1/messages +1')).toBeVisible()
  expect(within(row).getByText('2')).toBeVisible()
  expect(within(row).getByText('Billing metered')).toBeVisible()
  const other = screen.getByRole('row', { name: /channel-only/ })
  expect(within(other).getByText('/v1/images/generations')).toBeVisible()
  expect(within(other).getByText('Billing per call')).toBeVisible()
})

it('hides pagination when all models fit on one page', async () => {
  await renderList()
  expect(screen.queryByText(/models total/)).not.toBeInTheDocument()
})

it('toggles the model square listing from the switch', async () => {
  await renderList()
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  const user = userEvent.setup()
  const listed = screen.getByRole('switch', {
    name: 'List catalog-model in model square',
  })
  expect(listed).toBeChecked()
  await user.click(listed)
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/models/?status_only=true', {
      id: 7,
      status: 0,
    })
  )
})

it('disables listing for channel models without metadata', async () => {
  await renderList([channel])
  expect(
    screen.getByRole('switch', { name: 'List channel-only in model square' })
  ).toHaveAttribute('aria-disabled', 'true')
})

it('prefills and creates metadata only when the user explicitly saves it', async () => {
  await renderList([channel])
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { ...channel, id: 9 } },
  })
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Open menu' }))
  await user.click(
    await screen.findByRole('menuitem', { name: 'Add metadata' })
  )
  expect(screen.getByRole('textbox', { name: 'Model Name *' })).toHaveValue(
    'channel-only'
  )
  expect(post).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Save metadata' }))
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/api/models/',
      expect.objectContaining({ model_name: 'channel-only' }),
      expect.anything()
    )
  )
})
