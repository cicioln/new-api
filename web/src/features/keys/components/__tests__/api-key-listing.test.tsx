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
  act,
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { Toaster, toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { apiKeySchema, type ApiKey } from '../../types'
import { ApiKeyQuotaCell } from '../api-key-quota-cell'
import { useApiKeysColumns } from '../api-keys-columns'
import { ApiKeysProvider } from '../api-keys-provider'
import { ApiKeysTable } from '../api-keys-table'

const now = 1_700_000_000_000
const key = apiKeySchema.parse({
  id: 7,
  name: 'production',
  key: 'demo********1234',
  status: 1,
  remain_quota: 40_000_000,
  used_quota: 60_000_000,
  unlimited_quota: false,
  expired_time: -1,
  created_time: 0,
  accessed_time: 0,
  group: 'default',
  model_limits_enabled: false,
})
const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})
const clients: QueryClient[] = []

function QuotaTable(props: { apiKey: ApiKey }) {
  const columns = useApiKeysColumns(now).filter(
    (column) => column.id === 'quota'
  )
  const table = useReactTable({
    columns,
    data: [props.apiKey],
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th key={header.id}>
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

function renderQuota(apiKey: ApiKey = key) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  clients.push(client)
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <QuotaTable apiKey={apiKey} />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: {} } })
})
afterEach(() => {
  cleanup()
  toast.dismiss()
  localStorage.clear()
  clients.splice(0).forEach((client) => client.clear())
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

it('shows used and total quota with the currency symbol and a used-share bar', () => {
  renderQuota()
  expect(
    screen.getByRole('columnheader', { name: 'Quota usage' })
  ).toBeInTheDocument()
  const trigger = screen.getByRole('button', {
    name: /Remaining 80; Remaining percentage 40%; Used amount 120/,
  })
  expect(trigger).toHaveTextContent('$ 120 / 200')
  expect(trigger.parentElement).toHaveClass('w-[120px]')
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  expect(screen.getByRole('progressbar')).toHaveClass('text-foreground')
})

it.each([
  ['unused', 500000, 0, 0, 'text-foreground'],
  ['nearly used up', 25000, 475000, 95, 'text-destructive'],
  ['exhausted', 0, 500000, 100, 'text-destructive'],
  ['zero total', 0, 0, 0, 'text-foreground'],
])(
  'renders the %s usage bar with a valid share and the matching color',
  (_label, remaining, used, percentage, color) => {
    renderQuota({ ...key, remain_quota: remaining, used_quota: used })
    const progress = screen.getByRole('progressbar')
    expect(progress).toHaveAttribute('aria-valuenow', String(percentage))
    expect(progress).toHaveClass(color)
  }
)

it('marks an overdrawn balance in the destructive color', () => {
  renderQuota({ ...key, remain_quota: -50000, used_quota: 500000 })
  const values = screen
    .getByRole('button')
    .querySelector('[data-slot="api-key-quota-values"]')
  expect(values).toHaveTextContent('$ 1 / 0.9')
  expect(values).toHaveClass('text-destructive')
})

it('shows unlimited quota with an empty bar and explains it on demand', async () => {
  renderQuota({ ...key, unlimited_quota: true })
  const button = screen.getByRole('button', { name: /Unlimited/ })
  expect(button).toHaveTextContent('Unlimited quota')
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await userEvent.click(button)
  const detail = await screen.findByRole('dialog')
  expect(within(detail).getByText('120')).toBeInTheDocument()
  expect(detail).toHaveTextContent(
    'This API key has no quota limit. Requests still require available wallet or subscription quota.'
  )
})

it('keeps small custom-currency amounts exact with the custom symbol', async () => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CUSTOM',
      customCurrencySymbol: '🐱',
    },
  })
  renderQuota({ ...key, remain_quota: 1900, used_quota: 1100 })
  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('🐱 0.0022 / 0.006')
  await userEvent.click(button)
  const detail = await screen.findByRole('dialog')
  expect(within(detail).getByText('0.0038')).toBeInTheDocument()
})

it('recalculates the usage when remaining quota is edited', () => {
  const { rerender } = render(
    <I18nextProvider i18n={i18n}>
      <ApiKeyQuotaCell apiKey={key} now={now} />
    </I18nextProvider>
  )
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  rerender(
    <I18nextProvider i18n={i18n}>
      <ApiKeyQuotaCell
        apiKey={{ ...key, remain_quota: 90_000_000 }}
        now={now}
      />
    </I18nextProvider>
  )
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  expect(screen.getByText('$ 120 / 300')).toBeInTheDocument()
})

it('opens details with the keyboard and restores focus when Escape closes them', async () => {
  renderQuota()
  const user = userEvent.setup()
  const button = screen.getByRole('button')
  act(() => button.focus())
  await user.keyboard('{Enter}')
  const detail = await screen.findByRole('dialog')
  expect(within(detail).getByText('80')).toBeInTheDocument()
  expect(within(detail).getByText('120')).toBeInTheDocument()
  expect(within(detail).getByText('200')).toBeInTheDocument()
  expect(within(detail).getByText('40%')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(button).toHaveFocus()
})

it('truncates a long amount within its column while showing the full amount in details', async () => {
  renderQuota({ ...key, remain_quota: 123456789000000, used_quota: 0 })
  const button = screen.getByRole('button')
  const values = button.querySelector('[data-slot="api-key-quota-values"]')
  expect(values).toHaveClass('truncate')
  expect(values).toHaveTextContent('$ 0 / 246,913,578')
  await userEvent.click(button)
  expect(
    within(await screen.findByRole('dialog')).getAllByText('246,913,578')
  ).toHaveLength(2)
})

function KeysPage() {
  return (
    <ApiKeysProvider>
      <ApiKeysTable />
      <Toaster />
    </ApiKeysProvider>
  )
}

async function renderKeysPage(status = 1, overrides: Partial<ApiKey> = {}) {
  let currentKey = { ...key, status, ...overrides }
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/token/')) {
      return {
        data: { success: true, data: { items: [currentKey], total: 1 } },
      }
    }
    return { data: { success: true, data: { default: { ratio: 1 } } } }
  })
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { key: 'fake-key-for-test-only' } },
  })
  const put = vi.spyOn(api, 'put').mockImplementation(async (_url, data) => {
    const update = data as { id: number; status: number }
    currentKey = { ...currentKey, status: update.status }
    return { data: { success: true, data: currentKey } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {})
  clients.push(client)
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const keysRoute = createRoute({
    getParentRoute: () => auth,
    path: 'keys/',
    component: KeysPage,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([keysRoute])]),
    history: createMemoryHistory({ initialEntries: ['/keys/'] }),
  })
  await router.load()
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  await screen.findByText(currentKey.name)
  return { post, put }
}

it('lists keys in the design column order without selection or IP columns', async () => {
  await renderKeysPage()
  const headers = screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers).toEqual([
    'Name',
    'Key',
    'Status',
    'Group',
    'Quota usage',
    'Available models',
    'Expiration Time',
    'Last Used',
    'Actions',
  ])
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByText('sk-••••1234')).toBeInTheDocument()
  expect(screen.getByText('Never expires')).toBeInTheDocument()
  expect(screen.getByText('All')).toBeInTheDocument()
})

it('paginates with a key count and text previous and next buttons', async () => {
  await renderKeysPage()
  expect(screen.getByText('1 keys total')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
})

it.each([
  [
    'an enabled key near its limit',
    { used_quota: 95, remain_quota: 5 },
    'Quota running low',
  ],
  ['an enabled key past its expiry', { expired_time: 1 }, 'Expired'],
  [
    'an enabled unlimited key',
    { unlimited_quota: true, used_quota: 95, remain_quota: 5 },
    'Key status enabled',
  ],
])('shows %s with the derived status', async (_label, overrides, status) => {
  await renderKeysPage(1, overrides)
  expect(screen.getByText(status)).toBeInTheDocument()
})

it('lists the allowed models when the key restricts them', async () => {
  await renderKeysPage(1, {
    model_limits_enabled: true,
    model_limits: 'model-alpha,model-beta',
  })
  expect(screen.getByText('model-alpha, model-beta')).toBeInTheDocument()
})

it.each([
  [1, 'Disable', 2, 'Disabled'],
  [2, 'Enable', 1, 'Key status enabled'],
])(
  'toggles status %s from the row menu without fetching a full key',
  async (status, action, nextStatus, nextLabel) => {
    const { post, put } = await renderKeysPage(status)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(await screen.findByRole('menuitem', { name: action }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/token/?status_only=true', {
        id: 7,
        status: nextStatus,
      })
    )
    await screen.findByText(nextLabel)
    expect(post).not.toHaveBeenCalled()
  }
)

it('keeps expired status when the server refuses reactivation', async () => {
  const { put, post } = await renderKeysPage(3)
  put.mockResolvedValue({ data: { success: false, message: 'Token expired' } })
  await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Enable' }))
  await screen.findByText('Token expired')
  expect(screen.getByText('Expired')).toBeInTheDocument()
  expect(screen.queryByText('Key status enabled')).not.toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})

it.each([true, false])(
  'fetches a full key only on explicit copy and honors permission success=%s',
  async (success) => {
    const user = userEvent.setup()
    const { post } = await renderKeysPage()
    post.mockResolvedValue(
      success
        ? { data: { success: true, data: { key: 'fake-key-for-test-only' } } }
        : { data: { success: false, message: 'Verification required' } }
    )
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(post).not.toHaveBeenCalled()
    await user.click(screen.getByRole('menuitem', { name: 'Copy Key' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/token/7/key'))
    if (success) {
      await waitFor(() =>
        expect(copy).toHaveBeenCalledWith('sk-fake-key-for-test-only')
      )
    } else {
      await screen.findByText('Verification required')
      expect(copy).not.toHaveBeenCalled()
    }
  }
)

it('keeps full mobile information without group or quota section headings', async () => {
  const matchMedia = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...matchMedia(query),
    matches: query.includes('max-width'),
  }))
  i18n.addResourceBundle('zh', 'translation', zh.translation)
  await i18n.changeLanguage('zh')
  try {
    await renderKeysPage()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('额度 ($)')).not.toBeInTheDocument()
    expect(screen.getByText('($)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /剩余 80;/ })).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText(zh.translation['Created'])).toBeInTheDocument()
    expect(screen.getByText(zh.translation['Last Used'])).toBeInTheDocument()
    expect(screen.getByText(zh.translation['Expires'])).toBeInTheDocument()
    const card = screen.getByText(key.name).closest('div.rounded-xl')
    expect(card).not.toBeNull()
    expect(
      within(card as HTMLElement).queryByText(zh.translation['Group'], {
        exact: true,
      })
    ).not.toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
    expect(screen.getByText(zh.translation['Models'])).toBeInTheDocument()
    expect(
      screen.getByText(zh.translation['IP Restriction'])
    ).toBeInTheDocument()
  } finally {
    await i18n.changeLanguage('en')
  }
})

it('keeps mobile quota readable and opens complete model and IP restrictions by tapping', async () => {
  const matchMedia = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...matchMedia(query),
    matches: query.includes('max-width'),
  }))
  await renderKeysPage(1, {
    name: 'production-with-a-long-key-name',
    used_quota: 2245080000,
    unlimited_quota: true,
    model_limits_enabled: true,
    model_limits: 'model-alpha,model-beta-with-a-long-name',
    allow_ips: '192.0.2.1\n2001:db8::1',
  })
  const quota = screen.getByRole('button', {
    name: /Unlimited; Used amount 4,490.16/,
  })
  expect(quota).toHaveTextContent('Remaining($)UnlimitedUsed amount4,490.16')
  expect(quota.parentElement).toHaveClass('w-full')
  expect(quota.parentElement).not.toHaveClass('max-w-45')
  expect(quota.querySelector('[data-slot="api-key-quota-values"]')).toHaveClass(
    'grid-cols-[auto_minmax(0,1fr)]'
  )
  expect(within(quota).getByText('Unlimited')).toHaveClass(
    'text-right',
    'text-sm',
    'font-normal'
  )
  expect(within(quota).getByText('4,490.16')).toHaveClass(
    'tabular-nums',
    'text-sm',
    'font-normal',
    'text-right'
  )
  await userEvent.click(screen.getByRole('button', { name: /Models: 2 model/ }))
  let details = await screen.findByRole('dialog')
  expect(within(details).getByText('model-alpha')).toBeVisible()
  expect(within(details).getByText('model-beta-with-a-long-name')).toBeVisible()
  await userEvent.keyboard('{Escape}')
  await userEvent.click(
    screen.getByRole('button', { name: /IP Restriction: 2 IP/ })
  )
  details = await screen.findByRole('dialog')
  expect(within(details).getByText('192.0.2.1')).toBeVisible()
  expect(within(details).getByText('2001:db8::1')).toBeVisible()
})
