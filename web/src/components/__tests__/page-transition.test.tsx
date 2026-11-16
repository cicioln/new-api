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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useRouterState,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AnimatedOutlet } from '../page-transition'

function SectionPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return <div data-testid='scroller'>{pathname}</div>
}

async function renderSections(initialPath: string) {
  const rootRoute = createRootRoute({ component: AnimatedOutlet })
  const sectionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/logs/$section',
    component: SectionPage,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([sectionRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return router
}

describe('AnimatedOutlet scroll position', () => {
  it('scrolls back to the top when switching sections of the same route', async () => {
    const router = await renderSections('/logs/task')
    await screen.findByText('/logs/task')
    const scroller = screen.getByTestId('scroller')
    scroller.scrollTop = 400
    scroller.scrollLeft = 120

    await act(async () => {
      router.history.push('/logs/common')
      await router.load()
    })

    await screen.findByText('/logs/common')
    expect(screen.getByTestId('scroller')).toBe(scroller)
    expect(scroller.scrollTop).toBe(0)
    expect(scroller.scrollLeft).toBe(0)
  })
})
