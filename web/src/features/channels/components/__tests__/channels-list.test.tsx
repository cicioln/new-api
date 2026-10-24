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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { channelSchema, type Channel } from '../../types'
import { ChannelsProvider } from '../channels-provider'
import { ChannelsTable } from '../channels-table'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})
const clients: QueryClient[] = []

function channel(id: number, name: string, extra: Partial<Channel> = {}) {
  return channelSchema.parse({
    id,
    type: 1,
    key: '',
    status: 1,
    name,
    created_time: 0,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    group: 'default,vip',
    ...extra,
  })
}

const ITEMS = [
  channel(1, 'anthropic-01', { response_time: 312, priority: 10, weight: 100 }),
  channel(4, 'gemini-vertex', { response_time: 1200 }),
  channel(6, 'azure-east', { status: 3, response_time: 9000 }),
  channel(7, 'bedrock-us', { status: 2 }),
]

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

async function renderChannels(initialEntry = '/channels/') {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/channel' || url === '/api/channel/search') {
      return {
        data: {
          success: true,
          data: {
            items: ITEMS,
            total: ITEMS.length,
            type_counts: { 1: 4 },
            status_counts: { 1: 10, 2: 1, 3: 1 },
            tags: ['prod'],
          },
        },
      }
    }
    return { data: { success: true, data: ['default', 'vip'] } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const channelsRoute = createRoute({
    getParentRoute: () => auth,
    path: 'channels/',
    component: () => (
      <ChannelsProvider>
        <ChannelsTable />
      </ChannelsProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([channelsRoute])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByText('anthropic-01')
  const listCalls = () =>
    get.mock.calls.filter(
      ([url]) => url === '/api/channel' || url === '/api/channel/search'
    )
  return { get, listCalls }
}

it('shows status tab counts and requests auto-disabled channels when that tab is chosen', async () => {
  const { listCalls } = await renderChannels()
  const tabs = within(screen.getByRole('tablist'))
  expect(tabs.getByRole('tab', { name: /All\s*12/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )

  await userEvent.click(tabs.getByRole('tab', { name: /Auto Disabled\s*1/ }))

  await waitFor(() =>
    expect(listCalls().at(-1)?.[1]?.params).toMatchObject({ status: 'auto' })
  )
})

it('labels rows by status and last response time as in the design', async () => {
  await renderChannels()
  const row = (name: string) =>
    within(screen.getByText(name).closest('tr') as HTMLElement)

  expect(
    row('anthropic-01').getByText('Channel status enabled')
  ).toBeInTheDocument()
  expect(row('anthropic-01').getByText('312ms')).toBeInTheDocument()
  expect(row('anthropic-01').getByText('10 / 100')).toBeInTheDocument()
  expect(row('anthropic-01').getByText('default, vip')).toBeInTheDocument()
  expect(row('gemini-vertex').getByText('Slow response')).toBeInTheDocument()
  expect(row('gemini-vertex').getByText('1.2s')).toBeInTheDocument()
  expect(row('azure-east').getByText('Auto Disabled')).toBeInTheDocument()
  expect(row('azure-east').getByText('Timeout')).toBeInTheDocument()
  expect(row('bedrock-us').getByText('Manual Disabled')).toBeInTheDocument()
  expect(row('bedrock-us').getByText('—')).toBeInTheDocument()
})

it('searches name, ID and model through the search API with the typed keyword', async () => {
  const { listCalls } = await renderChannels()

  await userEvent.type(
    screen.getByPlaceholderText('Name, ID or model'),
    'claude'
  )

  await waitFor(
    () => {
      const [url, config] = listCalls().at(-1) ?? []
      expect(url).toBe('/api/channel/search')
      expect(config?.params).toMatchObject({ keyword: 'claude' })
    },
    { timeout: 2000 }
  )
})

it('shows the bulk bar with the selected channel count only while rows are selected', async () => {
  await renderChannels()
  expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()

  const checkboxes = screen.getAllByRole('checkbox', { name: 'Select row' })
  await userEvent.click(checkboxes[0])
  await userEvent.click(checkboxes[1])

  const bar = within(screen.getByRole('toolbar'))
  expect(bar.getByText('Selected 2 channels')).toBeInTheDocument()
  for (const action of ['Enable', 'Disable', 'Set Tag', 'Test', 'Delete']) {
    expect(bar.getByRole('button', { name: action })).toBeInTheDocument()
  }

  await userEvent.click(checkboxes[0])
  await userEvent.click(checkboxes[1])
  expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
})
