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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { ChannelPromptLogs } from '..'

const originalAuth = useAuthStore.getState().auth

function setUserRole(role: number) {
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      user: {
        id: 1,
        username: role >= ROLE.ADMIN ? 'admin' : 'user',
        display_name: role >= ROLE.ADMIN ? 'Admin' : 'User',
        role,
        status: 1,
        email: 'test@example.com',
        quota: 0,
        used_quota: 0,
        request_count: 0,
        group: 'default',
        aff_code: '',
        aff_count: 0,
        aff_quota: 0,
        aff_history_quota: 0,
        inviter_id: 0,
        has_password: true,
        two_fa_enabled: false,
      },
    },
  }))
}

function renderPromptLogs() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ChannelPromptLogs />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  useAuthStore.setState({ auth: originalAuth })
})

test('blocks non-admin users from viewing prompt logs', () => {
  setUserRole(ROLE.USER)
  const getSpy = vi.spyOn(api, 'get')

  renderPromptLogs()

  expect(screen.getByText('Access Denied')).toBeTruthy()
  expect(
    screen.getByText('Only administrators can access channel prompt logs.')
  ).toBeTruthy()
  expect(getSpy).not.toHaveBeenCalled()
})

test('shows a retry action instead of an empty log list when loading fails', async () => {
  setUserRole(ROLE.ADMIN)
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url.startsWith('/api/prompt_log/settings')) {
      return {
        data: {
          success: true,
          data: { global: { enabled: true }, channels: [] },
        },
      }
    }
    throw new Error('Network unavailable')
  })
  renderPromptLogs()
  expect(await screen.findByRole('button', { name: 'Retry' })).toBeVisible()
  expect(screen.queryByText('No prompt logs found')).not.toBeInTheDocument()
})

test('renders admin prompt logs, detail modal with authenticated blob attachment, and switch drawer', async () => {
  setUserRole(ROLE.ADMIN)
  const user = userEvent.setup()

  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn()
  }

  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    if (url.startsWith('/api/prompt_log/settings')) {
      return {
        data: {
          success: true,
          message: '',
          data: {
            global: {
              enabled: true,
              retention_days: 7,
              max_text_bytes: 65536,
              max_file_size_mb: 20,
            },
            channels: [
              {
                id: 5,
                name: 'OpenAI-Channel',
                type: 1,
                status: 1,
                prompt_log_enabled: true,
              },
            ],
            can_manage_global: true,
            can_manage_channels: true,
          },
        },
      }
    }
    if (url.startsWith('/api/prompt_log/101/attachments/att_1')) {
      expect(config?.responseType).toBe('blob')
      return {
        data: new Blob(['fake-png'], { type: 'image/png' }),
      }
    }
    if (url.startsWith('/api/prompt_log/101')) {
      return {
        data: {
          success: true,
          message: '',
          data: {
            id: 101,
            created_at: 1700000000,
            request_id: 'req-abc',
            channel_id: 5,
            channel_name: 'OpenAI-Channel',
            channel_type: 1,
            user_id: 2,
            username: 'alice',
            token_id: 3,
            token_name: 'app-key',
            model_name: 'gpt-4o',
            endpoint: '/v1/chat/completions',
            relay_format: 'openai',
            prompt_preview: 'Explain this image',
            prompt_text: '[user]\nExplain this image',
            prompt_truncated: false,
            message_count: 1,
            has_attachments: true,
            attachment_count: 1,
            attachments: [
              {
                id: 'att_1',
                kind: 'image',
                source: 'inline_base64',
                mime_type: 'image/png',
                file_name: 'chart.png',
                size_bytes: 2048,
                has_file: true,
                download_url: '/api/prompt_log/101/attachments/att_1',
              },
            ],
            metadata_json: '{"model":"gpt-4o"}',
          },
        },
      }
    }
    return {
      data: {
        success: true,
        message: '',
        data: {
          items: [
            {
              id: 101,
              created_at: 1700000000,
              request_id: 'req-abc',
              channel_id: 5,
              channel_name: 'OpenAI-Channel',
              channel_type: 1,
              user_id: 2,
              username: 'alice',
              token_id: 3,
              token_name: 'app-key',
              model_name: 'gpt-4o',
              endpoint: '/v1/chat/completions',
              relay_format: 'openai',
              prompt_preview: 'Explain this image',
              prompt_truncated: false,
              message_count: 1,
              has_attachments: true,
              attachment_count: 1,
              attachments: [
                {
                  id: 'att_1',
                  kind: 'image',
                  source: 'inline_base64',
                  mime_type: 'image/png',
                  file_name: 'chart.png',
                  size_bytes: 2048,
                  has_file: true,
                  download_url: '/api/prompt_log/101/attachments/att_1',
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        },
      },
    }
  })

  renderPromptLogs()

  expect(await screen.findByText('Explain this image')).toBeTruthy()
  expect(screen.getByText('Global prompt capture is ON')).toBeTruthy()

  await user.click(screen.getByText('Explain this image'))

  expect(await screen.findByText('Prompt Log Details')).toBeTruthy()
  expect(await screen.findByText('chart.png')).toBeTruthy()
  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith(
      '/api/prompt_log/101/attachments/att_1',
      expect.objectContaining({ responseType: 'blob' })
    )
  })

  // Open switches drawer and toggle channel prompt logging
  const putSpy = vi.spyOn(api, 'put').mockResolvedValue({
    data: {
      success: true,
      message: '',
      data: { channel_id: 5, prompt_log_enabled: false },
    },
  })
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Switches & Retention' }))
  expect(
    await screen.findByText('Prompt Extraction Switches & Retention')
  ).toBeTruthy()
  expect(await screen.findByText('OpenAI-Channel')).toBeTruthy()
  const switches = screen.getAllByRole('switch')
  const channelSwitch = switches.at(-1)
  expect(channelSwitch).toBeTruthy()
  await user.click(channelSwitch as HTMLElement)
  await waitFor(() => {
    expect(putSpy).toHaveBeenCalledWith('/api/prompt_log/channels/5', {
      enabled: false,
    })
  })
})
