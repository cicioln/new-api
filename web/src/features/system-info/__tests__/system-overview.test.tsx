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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SystemOverview } from '../components/system-overview'
import { getPrimaryInstance } from '../lib/format'
import type { SystemInstance } from '../types'

const GB = 1024 ** 3

function instance(
  name: string,
  overrides: Partial<SystemInstance> = {},
  isMaster = false
): SystemInstance {
  return {
    node_name: name,
    status: 'online',
    stale_after_seconds: 90,
    started_at: 100,
    last_seen_at: 200,
    info: {
      role: { is_master: isMaster },
      runtime: {
        version: 'v1.2.3',
        go_version: 'go1.26.0',
        goos: 'linux',
        goarch: 'amd64',
        database: 'postgres',
        redis_enabled: true,
      },
      resources: {
        cpu: { usage_percent: 23.4 },
        memory: {
          usage_percent: 45,
          total_bytes: 4 * GB,
          used_bytes: 1.8 * GB,
        },
        storage: {
          total_bytes: 100 * GB,
          used_bytes: 38 * GB,
          used_percent: 38,
        },
      },
    },
    ...overrides,
  }
}

function mockApi(instances: SystemInstance[]) {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/system-info/instances') {
      return { data: { success: true, data: instances } }
    }
    if (url === '/api/performance/logs') {
      return { data: { success: true, data: { enabled: false } } }
    }
    return { data: { success: true, data: {} } }
  })
}

function renderOverview() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <SystemOverview />
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('prefers the online master when picking the instance to describe', () => {
  const worker = instance('worker')
  const staleMaster = instance('old', { status: 'stale' }, true)
  const master = instance('master', {}, true)

  expect(getPrimaryInstance([worker, staleMaster, master])).toBe(master)
  expect(getPrimaryInstance([staleMaster, worker])).toBe(worker)
  expect(getPrimaryInstance([])).toBeNull()
})

it('shows resource usage and runtime facts from the master instance', async () => {
  mockApi([instance('worker'), instance('master', {}, true)])
  renderOverview()

  expect(await screen.findByText('PostgreSQL')).toBeInTheDocument()
  expect(screen.getByText('go1.26.0 linux/amd64')).toBeInTheDocument()
  expect(screen.getByText('Connected')).toBeInTheDocument()
  expect(screen.getByText(/^master · /)).toBeInTheDocument()
  expect(screen.getByText('/ 4 GB')).toBeInTheDocument()
  expect(screen.getByText('/ 100 GB')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Disk' })).toHaveAttribute(
    'aria-valuenow',
    '38'
  )
})

it('shows placeholders when no instance has reported', async () => {
  mockApi([])
  renderOverview()

  expect(
    await screen.findByRole('progressbar', { name: 'CPU' })
  ).toHaveAttribute('aria-valuenow', '0')
  expect(screen.queryByText('PostgreSQL')).not.toBeInTheDocument()
})
