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
import { describe, expect, it } from 'vitest'

import { LegalDocument } from '../legal-document'
import type { LegalDocumentResponse } from '../types'

function renderDocument(response: LegalDocumentResponse) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const root = createRootRoute({
    component: () => (
      <LegalDocument
        title='User Agreement'
        queryKey='legal-test'
        fetchDocument={async () => response}
        emptyMessage='The administrator has not set a user agreement.'
      />
    ),
  })
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

describe('legal document layout', () => {
  it('shows the empty state inside the article when no document is configured', async () => {
    renderDocument({ success: true, data: '' })

    const article = await screen.findByTestId('legal-article')
    expect(
      await within(article).findByText(
        'The administrator has not set a user agreement.'
      )
    ).toBeVisible()
  })

  it('renders markdown under the page title inside the article', async () => {
    renderDocument({ success: true, data: '## Terms\n\nBe nice.' })

    const article = await screen.findByTestId('legal-article')
    expect(await within(article).findByText('Be nice.')).toBeVisible()
    expect(
      within(article).getByRole('heading', { level: 1, name: 'User Agreement' })
    ).toBeVisible()
  })

  it('lists numbered sections in a table of contents', async () => {
    renderDocument({
      success: true,
      data: '## 1. Scope\n\nA\n\n## 2. Keys\n\nB',
    })

    const toc = await screen.findByRole('navigation', {
      name: 'Table of contents',
    })
    expect(within(toc).getByRole('button', { name: '1. Scope' })).toBeVisible()
    expect(within(toc).getByRole('button', { name: '2. Keys' })).toBeVisible()
  })

  it('places the site footer after the article', async () => {
    renderDocument({ success: true, data: 'Text' })

    const article = await screen.findByTestId('legal-article')
    const footer = screen.getByRole('contentinfo')
    expect(
      article.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
