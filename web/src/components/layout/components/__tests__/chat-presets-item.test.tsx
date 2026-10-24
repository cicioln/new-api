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
import { cleanup, render, screen } from '@testing-library/react'
import { MessageSquare } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'

import { SidebarMenu, SidebarProvider } from '@/components/ui/sidebar'

import { ChatPresetsItem } from '../chat-presets-item'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

async function renderItem(status: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], status)
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SidebarProvider>
          <SidebarMenu>
            <ChatPresetsItem
              item={{
                title: 'Chat',
                icon: MessageSquare,
                type: 'chat-presets',
              }}
            />
          </SidebarMenu>
        </SidebarProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('chat sidebar entry', () => {
  it('stays visible as a link to the chat page when no presets are configured', async () => {
    await renderItem({ chats: [] })
    expect(await screen.findByRole('link', { name: 'Chat' })).toHaveAttribute(
      'href',
      '/chat2link'
    )
  })
})
