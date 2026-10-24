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
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

import { maskRedemptionCode } from '../../lib'
import type { Redemption } from '../../types'
import { useRedemptionsColumns } from '../redemptions-columns'
import { RedemptionsPrimaryButtons } from '../redemptions-primary-buttons'
import { RedemptionsProvider } from '../redemptions-provider'

vi.mock('@/lib/copy-to-clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}))

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

const now = Math.floor(Date.now() / 1000)

function code(overrides: Partial<Redemption>): Redemption {
  return {
    id: 1,
    user_id: 1,
    name: 'launch',
    key: 'abcd1234efgh5678ijkl9012mnop3456',
    status: 1,
    quota: 500000,
    created_time: now,
    redeemed_time: 0,
    expired_time: 0,
    used_user_id: 0,
    ...overrides,
  }
}

function CodesTable(props: { data: Redemption[] }) {
  const table = useReactTable({
    columns: useRedemptionsColumns(),
    data: props.data,
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

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <RedemptionsProvider>{ui}</RedemptionsProvider>
      </TooltipProvider>
    </I18nextProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('masks codes like the design', () => {
  expect(maskRedemptionCode('abcd1234efgh5678ijkl9012mnop3456')).toBe(
    'abcd-•••-3456'
  )
  expect(maskRedemptionCode('short')).toBe('short')
})

it('renders the design columns, status tags, redeemer and expiry', () => {
  renderWithProviders(
    <CodesTable
      data={[
        code({ id: 41 }),
        code({
          id: 40,
          status: 3,
          used_user_id: 7,
          used_username: 'lin_w',
          expired_time: dayjsSeconds('2026-11-30'),
        }),
        code({ id: 38, expired_time: now - 60 }),
        code({ id: 37, status: 3, used_user_id: 9 }),
      ]}
    />
  )

  expect(
    screen.getAllByRole('columnheader').map((th) => th.textContent)
  ).toEqual([
    'ID',
    'Name',
    'Redemption Code',
    'Quota',
    'Status',
    'Redeemed By',
    'Expiration Time',
    'Actions',
  ])
  expect(screen.getAllByText('abcd-•••-3456')).toHaveLength(4)
  expect(screen.getByText('Unused')).toHaveClass('text-success')
  expect(screen.getAllByText('Used')[0]).toHaveClass('text-muted-foreground')
  expect(screen.getByText('Expired')).toHaveClass('text-destructive')
  expect(screen.getByText('lin_w')).toBeInTheDocument()
  expect(screen.getByText('User 9')).toBeInTheDocument()
  expect(screen.getByText('2026-11-30')).toBeInTheDocument()
  expect(screen.getAllByText('Never expires')).toHaveLength(2)
})

it('copies the full code from the code cell', async () => {
  const user = userEvent.setup()
  renderWithProviders(<CodesTable data={[code({})]} />)

  await user.click(screen.getByRole('button', { name: 'Copy redemption code' }))

  await waitFor(() =>
    expect(copyToClipboard).toHaveBeenCalledWith(
      'abcd1234efgh5678ijkl9012mnop3456'
    )
  )
})

it('exports every unused code across pages', async () => {
  const pages = [
    Array.from({ length: 100 }, (_, i) =>
      code({ id: i + 1, key: `key-${i + 1}` })
    ),
    [code({ id: 101, key: 'key-101' })],
  ]
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    const params = new URLSearchParams(String(url).split('?')[1])
    return {
      data: {
        success: true,
        data: { items: pages[Number(params.get('p')) - 1], total: 101 },
      },
    }
  })
  let exported: Blob | undefined
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn((blob: Blob) => {
        exported = blob
        return 'blob:codes'
      }),
      revokeObjectURL: vi.fn(),
    })
  )
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
  const user = userEvent.setup()
  renderWithProviders(<RedemptionsPrimaryButtons />)

  await user.click(screen.getByRole('button', { name: 'Export unused' }))

  await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
  expect(get).toHaveBeenCalledTimes(2)
  expect(String(get.mock.calls[0][0])).toContain('status=1')
  const lines = (await (exported as Blob).text()).trim().split('\n')
  expect(lines).toHaveLength(101)
  expect(lines[100].split('\t')[1]).toBe('key-101')
  expect(
    screen.getByRole('button', { name: 'Batch generate' })
  ).toBeInTheDocument()
})

function dayjsSeconds(date: string) {
  return Math.floor(new Date(`${date}T12:00:00`).getTime() / 1000)
}
