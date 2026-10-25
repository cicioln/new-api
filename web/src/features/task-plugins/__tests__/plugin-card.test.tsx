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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { MarketplacePluginCard } from '../components/marketplace-plugin-card'
import { PluginCard } from '../components/plugin-card'
import type { TaskPluginListItem } from '../types'

// @lobehub/icons transitively imports @emoji-mart JSON assets that vitest's
// externalized ESM loader rejects. Icon rendering is irrelevant to the card
// layout contracts under test, so the icon loader boundary is stubbed.
vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

function makeItem(overrides?: Partial<TaskPluginListItem>): TaskPluginListItem {
  return {
    meta: {
      apiVersion: 1,
      key: 'kling',
      name: 'Kling',
      version: '1.2.3',
      author: { name: 'acme' },
      models: ['kling-v1', 'kling-v2'],
      fetchMode: 'proxy',
      description: { en: 'Generate videos with Kling.' },
      usageSchema: {
        duration: { type: 'number', unit: 'second' },
      },
    },
    source: 'factory',
    enabled: true,
    active: true,
    source_hash: '',
    remark: '',
    runtime_status: 'registered',
    channel_count: 0,
    in_flight_count: 0,
    ...overrides,
  }
}

function renderCard(item: TaskPluginListItem) {
  const handlers = {
    onToggle: vi.fn(),
    onDetails: vi.fn(),
    onUpload: vi.fn(),
    onDelete: vi.fn(),
  }
  render(<PluginCard plugin={item} switchDisabled={false} {...handlers} />)
  return handlers
}

describe('PluginCard', () => {
  test('given a plugin, the version reads as a labelled caption under the name', () => {
    renderCard(makeItem())

    expect(screen.getByText('Kling')).toBeInTheDocument()
    expect(screen.getByLabelText('Active version 1.2.3')).toHaveTextContent(
      'v1.2.3'
    )
  })

  test('given a description, it is clamped to two lines', () => {
    renderCard(makeItem())

    expect(screen.getByText('Generate videos with Kling.')).toHaveClass(
      'line-clamp-2'
    )
  })

  test('given an enabled plugin, the footer names the bound channel count', () => {
    renderCard(makeItem({ channel_count: 2 }))

    expect(screen.getByText('Enabled · 2 channels bound')).toBeInTheDocument()
  })

  test('given a disabled plugin, the footer says it is not enabled', () => {
    renderCard(makeItem({ enabled: false, runtime_status: 'disabled' }))

    expect(screen.getByText('Plugin not enabled')).toBeInTheDocument()
  })

  test('given a compile failure, the footer reports it with the runtime error', () => {
    renderCard(
      makeItem({ runtime_status: 'compile_failed', runtime_error: 'boom' })
    )

    expect(screen.getByText('Compilation failed')).toHaveAttribute(
      'title',
      'boom'
    )
  })

  test('toggling the switch reports the requested state', async () => {
    const user = userEvent.setup()
    const handlers = renderCard(makeItem())

    await user.click(
      screen.getByRole('switch', { name: 'Enable plugin kling' })
    )

    expect(handlers.onToggle).toHaveBeenCalledWith(false, expect.anything())
  })

  test('the configure menu opens details', async () => {
    const user = userEvent.setup()
    const handlers = renderCard(makeItem())

    await user.click(screen.getByRole('button', { name: 'Configure' }))
    await user.click(screen.getByRole('menuitem', { name: 'Details' }))

    expect(handlers.onDetails).toHaveBeenCalledOnce()
  })

  test('given a usage schema, billing parameters stay out of the card', () => {
    renderCard(makeItem())

    expect(screen.queryByText('Billing parameters')).toBeNull()
    expect(screen.queryByText('duration')).toBeNull()
  })
})

test.each(['override', 'factory', 'override_over_factory'] as const)(
  'marketplace entry for %s offers installation',
  async (source) => {
    const user = userEvent.setup()
    const onInstall = vi.fn()
    render(
      <MarketplacePluginCard
        plugin={{
          key: 'kling',
          name: 'Kling',
          latest: '1.2.3',
          versions: [{ version: '1.2.3', path: 'plugin.js' }],
        }}
        installed={makeItem({ source })}
        installState={{ status: 'up_to_date', installedVersion: '1.2.3' }}
        onInstall={onInstall}
      />
    )
    expect(
      screen.queryByRole('button', { name: 'Select version' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Install' }))
    expect(onInstall).toHaveBeenCalledOnce()
    expect(
      screen.queryByText('Updates with the system')
    ).not.toBeInTheDocument()
  }
)
