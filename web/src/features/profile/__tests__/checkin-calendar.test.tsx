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
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { CheckinCalendarCard } from '../components/checkin-calendar-card'

function renderCard(checkedInToday: boolean, records: string[]) {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        enabled: true,
        stats: {
          checked_in_today: checkedInToday,
          total_checkins: 9,
          total_quota: 0,
          records: records.map((date) => ({
            checkin_date: date,
            quota_awarded: 100,
          })),
        },
      },
    },
  } as never)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CheckinCalendarCard
        checkinEnabled
        turnstileEnabled={false}
        turnstileSiteKey=''
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 12))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('check-in calendar', () => {
  it('renders one cell per day of the month after the weekday header', async () => {
    renderCard(false, [])

    const grid = await screen.findByTestId('checkin-grid')
    const days = grid.querySelectorAll('span:not([aria-hidden])')
    expect(days).toHaveLength(31)
    expect(days[0]).toHaveTextContent('1')
  })

  it('marks checked-in days and today separately', async () => {
    renderCard(false, ['2026-10-01', '2026-10-22'])

    const grid = await screen.findByTestId('checkin-grid')
    expect(grid.querySelectorAll('[data-checked]')).toHaveLength(2)
    expect(grid.querySelector('[data-today]')).toHaveTextContent('23')
    expect(grid.querySelector('[data-today]')).not.toHaveAttribute(
      'data-checked'
    )
  })

  it('shows the monthly count and disables the button once checked in today', async () => {
    renderCard(true, ['2026-10-22', '2026-10-23'])

    expect(await screen.findByText('2 days')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Checked in' })).toBeDisabled()
  })

  it('keeps the check-in button enabled before checking in today', async () => {
    renderCard(false, [])

    expect(
      await screen.findByRole('button', { name: 'Check in now' })
    ).toBeEnabled()
  })
})
