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
import { expect, test, vi } from 'vitest'

import { MarketplacePluginCard } from '../components/marketplace-plugin-card'
import { PluginWebsiteLink } from '../components/plugin-website-link'

vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

const website = 'https://example.com/plugin'

test('marketplace card shows the plugin website separately from installation', () => {
  render(
    <MarketplacePluginCard
      indexUrl='https://example.com/index.json'
      plugin={{
        key: 'example',
        name: 'Example',
        website,
        latest: '1.0.0',
        versions: [{ version: '1.0.0', path: 'plugin.js' }],
      }}
      installState={{ status: 'not_installed' }}
      onInstall={() => undefined}
    />
  )
  expect(screen.getByRole('link', { name: 'Plugin website' })).toHaveAttribute(
    'href',
    website
  )
  expect(screen.getByRole('button', { name: 'Install' })).toBeEnabled()
})

test('website link is reachable and activated using the keyboard', async () => {
  const user = userEvent.setup()
  render(<PluginWebsiteLink website={website} />)
  const link = screen.getByRole('link', { name: 'Plugin website' })
  const click = vi.fn((event: Event) => event.preventDefault())
  link.addEventListener('click', click)
  await user.tab()
  expect(link).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(click).toHaveBeenCalledOnce()
  link.removeEventListener('click', click)
})
