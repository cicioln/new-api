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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Profile } from '@/features/profile'
import type { UserProfile } from '@/features/profile/types'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { Security } from '../index'

const profile: UserProfile = {
  id: 1,
  username: 'alice',
  display_name: 'Alice',
  role: 1,
  group: 'default',
  quota: 1000000,
  used_quota: 0,
  request_count: 0,
  status: 1,
  aff_count: 0,
  aff_quota: 0,
  aff_history_quota: 0,
  created_time: 0,
  setting: JSON.stringify({
    notify_type: 'email',
    quota_warning_threshold: 500000,
  }),
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  useAuthStore
    .getState()
    .auth.setUser({ ...profile, permissions: { sidebar_settings: false } })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/access_tokens') {
      return { data: { success: true, data: { items: [], legacy: null } } }
    }
    if (url === '/api/user/access_tokens/catalog') {
      return {
        data: {
          success: true,
          data: { groups: [], max_tokens: 20, default_expiry_days: 30 },
        },
      }
    }
    if (url === '/api/user/self') {
      return { data: { success: true, data: profile } }
    }
    if (url === '/api/user/passkey') {
      return { data: { success: true, data: { enabled: false } } }
    }
    if (url === '/api/user/2fa/status') {
      return {
        data: {
          success: true,
          data: { enabled: false, locked: false, backup_codes_remaining: 0 },
        },
      }
    }
    if (url === '/api/user/sessions') {
      return { data: { success: true, data: [] } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.getState().auth.reset()
  vi.restoreAllMocks()
})

async function renderPage(path = '/security') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    checkin_enabled: false,
    wechat_login: true,
    github_oauth: true,
    oidc_enabled: true,
    custom_oauth_providers: [
      {
        id: 1,
        name: 'Gitea',
        slug: 'gitea',
        client_id: 'test-client',
        authorization_endpoint: 'https://example.com/oauth/authorize',
        scopes: 'openid',
      },
    ],
  })
  const root = createRootRoute()
  const security = createRoute({
    getParentRoute: () => root,
    path: '/security',
    component: Security,
  })
  const personal = createRoute({
    getParentRoute: () => root,
    path: '/profile',
    component: Profile,
  })
  const router = createRouter({
    routeTree: root.addChildren([security, personal]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  const rendered = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { ...rendered, router }
}

describe('security page layout', () => {
  it('lists password, 2FA, Passkey, access token and deletion rows in one card', async () => {
    await renderPage()
    const card = await screen.findByRole('region', {
      name: 'Security & Access',
    })
    expect(
      await within(card).findByRole('heading', {
        name: /Two-factor authentication \(TOTP\)/,
      })
    ).toBeVisible()
    expect(
      await within(card).findByRole('heading', { name: /Passkey/ })
    ).toBeVisible()
    expect(
      within(card)
        .getAllByRole('heading')
        .map((heading) => heading.textContent)
    ).toEqual([
      'Login password',
      'Two-factor authentication (TOTP)Not enabled',
      'PasskeyNot enabled',
      'System access token',
      'Delete Account',
    ])
    expect(
      within(card).getByRole('button', { name: 'Change Password' })
    ).toBeVisible()
    expect(within(card).getByRole('button', { name: 'Manage' })).toBeVisible()
    expect(screen.queryByText('Account Bindings')).not.toBeInTheDocument()
  })

  it('shows recent logins as a table with time, method, IP and device columns', async () => {
    await renderPage()
    const logins = await screen.findByRole('region', { name: 'Recent logins' })
    expect(
      within(logins)
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
    ).toEqual(['Time', 'Login method', 'IP', 'Device', 'Actions'])
    expect(
      await within(logins).findByText('No active login sessions')
    ).toBeVisible()
  })

  it('Manage opens access token management in a sheet', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Manage' }))
    const sheet = await screen.findByRole('dialog', { name: 'Access tokens' })
    expect(await within(sheet).findByText('No access tokens')).toBeVisible()
  })

  it('the password action opens the existing dialog by keyboard and Escape closes it', async () => {
    const user = userEvent.setup()
    await renderPage()
    const action = await screen.findByRole('button', {
      name: 'Change Password',
    })
    action.focus()
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', {
      name: 'Change Password',
    })
    expect(within(dialog).getByLabelText('Current Password')).toBeVisible()
    expect(
      within(dialog).getByLabelText('New Password', { exact: true })
    ).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })

  it('Profile shows account bindings and basic info without security requests', async () => {
    await renderPage('/profile')
    const bindings = await screen.findByRole('list', {
      name: 'Account Bindings',
    })
    expect(within(bindings).getAllByRole('listitem')).toHaveLength(4)
    expect(within(bindings).getByText('Gitea')).toBeVisible()
    expect(screen.getByLabelText('Username')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Display name')).toHaveValue('Alice')
    expect(
      screen.queryByRole('button', { name: 'Change Password' })
    ).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith('/api/user/passkey')
    expect(api.get).not.toHaveBeenCalledWith('/api/user/2fa/status')
    expect(api.get).not.toHaveBeenCalledWith('/api/user/sessions')
  })

  it('saving a changed display name sends only display_name', async () => {
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = userEvent.setup()
    await renderPage('/profile')
    const save = await screen.findByRole('button', { name: 'Save' })
    const input = screen.getByLabelText('Display name')
    await user.clear(input)
    await user.type(input, 'Alice W')
    await user.click(save)
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/api/user/self',
        { display_name: 'Alice W' },
        expect.anything()
      )
    )
  })

  it('a failed profile load offers retry before exposing account actions', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: false } })
    const user = userEvent.setup()
    await renderPage()
    expect(await screen.findByText('Failed to load profile')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Delete Account' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('button', { name: 'Delete Account' })
    ).toBeVisible()
  })
})
