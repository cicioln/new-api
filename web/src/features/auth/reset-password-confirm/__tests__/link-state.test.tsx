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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ResetPasswordConfirm } from '..'

function renderReset(email?: string, token?: string) {
  const root = createRootRoute()
  const routes = [
    createRoute({
      getParentRoute: () => root,
      path: '/reset',
      component: () => <ResetPasswordConfirm email={email} token={token} />,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/forgot-password',
      component: () => <p>forgot password page</p>,
    }),
  ]
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/reset'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

describe('reset password link state', () => {
  it('shows the invalid link alert and no form when the token is missing', async () => {
    renderReset('a@b.com')

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('navigates to forgot password when requesting a new link', async () => {
    const router = renderReset()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Request again' })
    )

    expect(await screen.findByText('forgot password page')).toBeVisible()
    expect(router.state.location.pathname).toBe('/forgot-password')
  })

  it('shows the email read-only when the link has email and token', async () => {
    renderReset('a@b.com', 'tok')

    const email = await screen.findByDisplayValue('a@b.com')
    expect(email).toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
