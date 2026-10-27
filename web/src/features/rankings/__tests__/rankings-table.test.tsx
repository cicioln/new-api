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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TopRisersCard, VendorShareCard } from '../components/rankings-side'
import { RankingsTable } from '../components/rankings-table'
import type { ModelRanking } from '../types'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

function row(overrides: Partial<ModelRanking> = {}): ModelRanking {
  return {
    rank: 1,
    previous_rank: 1,
    model_name: 'claude-opus-5-5',
    vendor: 'Anthropic',
    category: 'all',
    total_tokens: 4_820_000_000,
    share: 0.284,
    growth_pct: 12.1,
    ...overrides,
  }
}

describe('rankings table', () => {
  beforeEach(() => navigate.mockClear())

  it('shows tokens, share, growth and rank change for each model', () => {
    render(
      <RankingsTable
        rows={[
          row(),
          row({
            rank: 2,
            previous_rank: 4,
            model_name: 'deepseek-v4',
            vendor: 'DeepSeek',
            total_tokens: 2_410_000_000,
            share: 0.142,
            growth_pct: -6.2,
          }),
          row({ rank: 3, previous_rank: undefined, model_name: 'new-model' }),
        ]}
        showTrend
      />
    )
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('4.82B')).toBeVisible()
    expect(within(rows[0]).getByText('28.4%')).toBeVisible()
    expect(within(rows[0]).getByText('+12.1%')).toBeVisible()
    expect(within(rows[0]).getByText('—')).toBeVisible()
    expect(within(rows[1]).getByText('-6.2%')).toBeVisible()
    expect(within(rows[1]).getByText('▲ 2')).toBeVisible()
    expect(within(rows[2]).getByText('NEW')).toBeVisible()
  })

  it('hides the trend columns when no previous period exists', () => {
    render(
      <RankingsTable
        rows={[row({ previous_rank: undefined })]}
        showTrend={false}
      />
    )
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
    expect(screen.queryByText('NEW')).not.toBeInTheDocument()
  })

  it('opens the model details when a row is clicked or activated by Enter', async () => {
    const user = userEvent.setup()
    render(<RankingsTable rows={[row()]} showTrend />)
    const target = screen.getAllByRole('row')[1]
    await user.click(target)
    target.focus()
    await user.keyboard('{Enter}')
    expect(navigate).toHaveBeenCalledTimes(2)
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/pricing/$modelId',
      params: { modelId: 'claude-opus-5-5' },
    })
  })
})

describe('rankings side cards', () => {
  it('lists each vendor with its share', () => {
    render(
      <VendorShareCard
        vendors={[
          {
            rank: 1,
            vendor: 'Anthropic',
            total_tokens: 10,
            share: 0.434,
            growth_pct: 0,
            models_count: 3,
            top_model: 'claude-opus-5-5',
          },
        ]}
      />
    )
    expect(screen.getByRole('listitem')).toHaveTextContent('Anthropic43.4%')
  })

  it('shows an empty message when no model climbed', () => {
    render(<TopRisersCard movers={[]} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
