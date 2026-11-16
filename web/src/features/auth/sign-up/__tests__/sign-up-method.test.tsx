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
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { STATUS_QUERY_KEY } from '@/lib/status-query'

import { SignUpForm } from '../components/sign-up-form'

function renderSignUp(status: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(STATUS_QUERY_KEY, status)
  const root = createRootRoute({ component: Outlet })
  const signUp = createRoute({
    getParentRoute: () => root,
    path: '/sign-up',
    component: () => <SignUpForm />,
  })
  const router = createRouter({
    routeTree: root.addChildren([signUp]),
    history: createMemoryHistory({ initialEntries: ['/sign-up'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

let get: ReturnType<typeof vi.spyOn>
let post: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/verification') return { data: { success: true } }
    return { data: { success: true, data: {} } }
  })
  // A failed response keeps the form on the page; only the payload matters.
  post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: false, message: 'stop' } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function fillPasswords(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Password'), 'sign-up-password')
  await user.type(screen.getByLabelText('Confirm password'), 'sign-up-password')
}

it('submits a username sign-up without an email address by default', async () => {
  renderSignUp({})
  const user = userEvent.setup()

  expect(await screen.findByRole('tab', { name: 'Username' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Username'), 'dave')
  await fillPasswords(user)
  await user.click(screen.getByRole('button', { name: 'Sign up' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  const payload = post.mock.calls[0][1] as Record<string, unknown>
  expect(payload).toMatchObject({ username: 'dave' })
  expect(payload).not.toHaveProperty('email')
  expect(payload).not.toHaveProperty('verification_code')
})

it('submits an email sign-up with its code and no username after switching tabs', async () => {
  renderSignUp({})
  const user = userEvent.setup()

  await user.click(await screen.findByRole('tab', { name: 'Email' }))
  expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Email'), ' bob@example.com ')
  await user.click(screen.getByRole('button', { name: 'Get code' }))
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      '/api/verification',
      expect.objectContaining({
        params: expect.objectContaining({ email: 'bob@example.com' }),
      })
    )
  )
  await user.type(screen.getByLabelText('Email verification code'), '123456')
  await fillPasswords(user)
  await user.click(screen.getByRole('button', { name: 'Sign up' }))

  await waitFor(() => expect(post).toHaveBeenCalled())
  const payload = post.mock.calls[0][1] as Record<string, unknown>
  expect(payload).toMatchObject({
    email: 'bob@example.com',
    verification_code: '123456',
  })
  expect(payload).not.toHaveProperty('username')
})

it('blocks an email sign-up with an invalid address before sending it', async () => {
  renderSignUp({})
  const user = userEvent.setup()

  await user.click(await screen.findByRole('tab', { name: 'Email' }))
  await user.type(screen.getByLabelText('Email'), 'not-an-email')
  await user.type(screen.getByLabelText('Email verification code'), '123456')
  await fillPasswords(user)
  await user.click(screen.getByRole('button', { name: 'Sign up' }))

  expect(
    await screen.findByText('Please enter a valid email address')
  ).toBeVisible()
  expect(post).not.toHaveBeenCalled()
})

it('offers only the email method when the administrator requires email verification', async () => {
  renderSignUp({ email_verification: true })

  expect(await screen.findByLabelText('Email')).toBeVisible()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
})
