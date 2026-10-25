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
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SetupWizard } from '../setup-wizard'

function renderWizard(databaseType: string) {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: { status: false, root_init: true, database_type: databaseType },
    },
  } as never)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({ component: SetupWizard }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

function getSteps() {
  return within(screen.getByRole('list')).getAllByRole('listitem')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('setup wizard steps', () => {
  it('marks only the first of four steps as current on load', async () => {
    renderWizard('sqlite')

    await screen.findByTestId('setup-database-row')
    const steps = getSteps()
    expect(steps).toHaveLength(4)
    expect(steps[0]).toHaveAttribute('aria-current', 'step')
    expect(
      steps.filter((step) => step.hasAttribute('aria-current'))
    ).toHaveLength(1)
  })

  it('shows the persist warning for a SQLite database', async () => {
    renderWizard('sqlite')

    const row = await screen.findByTestId('setup-database-row')
    expect(within(row).getByText('SQLite')).toBeVisible()
    expect(within(row).getByText('Persist the data file')).toBeVisible()
  })

  it('moves the current marker to the next step when clicking next', async () => {
    renderWizard('postgres')

    await screen.findByTestId('setup-database-row')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    const steps = getSteps()
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(steps[0]).not.toHaveAttribute('aria-current')
  })

  it('lists the database and default usage mode on the review step', async () => {
    renderWizard('mysql')

    await screen.findByTestId('setup-database-row')
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    }

    expect(
      await screen.findByRole('heading', { name: 'Ready to initialize' })
    ).toBeVisible()
    expect(screen.getByText('mysql')).toBeVisible()
    expect(screen.getByText('External operations')).toBeVisible()
  })
})
