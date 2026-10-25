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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { About } from '../index'

const getAboutContent = vi.hoisted(() => vi.fn())

vi.mock('../api', () => ({ getAboutContent }))

function renderAbout() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const root = createRootRoute({ component: About })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('about page', () => {
  it('renders markdown content under the site title inside the article', async () => {
    getAboutContent.mockResolvedValue({
      success: true,
      data: '## Service\n\nHello.',
    })
    renderAbout()

    const article = await screen.findByTestId('legal-article')
    expect(await within(article).findByText('Hello.')).toBeVisible()
    expect(
      within(article).getByRole('heading', { level: 1 })
    ).toHaveTextContent('About New API')
  })

  it('keeps the open source attribution when no content is configured', async () => {
    getAboutContent.mockResolvedValue({ success: true, data: '' })
    renderAbout()

    const article = await screen.findByTestId('legal-article')
    expect(await within(article).findByText('AGPL v3.0 License')).toBeVisible()
  })
})
