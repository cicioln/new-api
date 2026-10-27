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
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { CachedPriceCell } from '../components/cached-price-cell'
import { ModelCard } from '../components/model-card'
import { ModelCardGrid } from '../components/model-card-grid'
import { PricingTable } from '../components/pricing-table'
import type { MarketPerf } from '../lib/market'
import type { PricingModel } from '../types'

function pricingModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'example-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default', 'premium'],
    group_ratio: { default: 1, premium: 3 },
    ...overrides,
  }
}

function perf(overrides: Partial<MarketPerf> = {}): MarketPerf {
  return {
    latencyMs: 1200,
    tps: 42,
    successRate: 99.8,
    requests: 10,
    series: [],
    ...overrides,
  }
}

function pricing() {
  return screen.getByRole('group', { name: 'Pricing' })
}

const originalStorage = useSystemConfigStore.persist.getOptions().storage
beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  })
  useSystemConfigStore.persist.setOptions({
    storage: createJSONStorage(() => localStorage),
  })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'USD' },
  })
})
afterEach(() => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useSystemConfigStore.persist.setOptions({ storage: originalStorage })
})

describe('model cards', () => {
  it('shows separate generic and image cache prices including a free image cache', () => {
    render(
      <CachedPriceCell
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr:
            'tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 0 + c * 30)',
        })}
        options={{ tokenUnit: 'M' }}
      />
    )
    expect(screen.getByText('Cache Read').parentElement).toHaveTextContent(
      '$1.25'
    )
    expect(screen.getByText('Image Cache').parentElement).toHaveTextContent(
      '$0'
    )
  })

  it('shows input and output prices for the selected group, recharge mode and token unit', () => {
    const props = {
      model: pricingModel(),
      onClick: vi.fn(),
      selectedGroup: 'premium',
      showRechargePrice: true,
      priceRate: 3,
      usdExchangeRate: 6,
    }
    const { rerender } = render(<ModelCard {...props} tokenUnit='M' />)
    expect(
      within(pricing()).getByText('Input / 1M').nextSibling
    ).toHaveTextContent('$3')
    expect(
      within(pricing()).getByText('Output / 1M').nextSibling
    ).toHaveTextContent('$9')
    rerender(<ModelCard {...props} tokenUnit='K' />)
    expect(
      within(pricing()).getByText('Input / 1K').nextSibling
    ).toHaveTextContent('$0.003')
    expect(
      within(pricing()).getByText('Output / 1K').nextSibling
    ).toHaveTextContent('$0.009')
  })

  it('shows a per-request price with its billing mode and no token unit', () => {
    render(
      <ModelCard
        model={pricingModel({ quota_type: 1, model_price: 0.4 })}
        onClick={vi.fn()}
        selectedGroup='premium'
        showRechargePrice
        priceRate={3}
        usdExchangeRate={6}
        tokenUnit='K'
      />
    )
    expect(within(pricing()).getByText('Per request')).toBeVisible()
    expect(within(pricing()).getByText(/\$0\.60/)).toHaveTextContent(
      /\$0\.60\s*\/\s*request/
    )
    expect(within(pricing()).queryByText(/1K|1M/)).not.toBeInTheDocument()
  })

  it('shows expression prices in the selected token unit', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", p * 3 + c * 15)',
        })}
        onClick={vi.fn()}
        tokenUnit='K'
        selectedGroup='premium'
        showRechargePrice
        priceRate={3}
        usdExchangeRate={6}
      />
    )
    expect(
      within(pricing()).getByText('Input / 1K').nextSibling
    ).toHaveTextContent('$0.0045')
    expect(
      within(pricing()).getByText('Output / 1K').nextSibling
    ).toHaveTextContent('$0.0225')
  })

  it('updates the current time tier at a minute boundary and after returning to the page', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:59:59+08:00'))
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr:
        'hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? tier("peak", p * 3 + c * 9) : tier("off_peak", p * 1.5 + c * 4.5)',
    })
    render(<ModelCard model={model} onClick={vi.fn()} tokenUnit='M' />)
    expect(screen.getByText('$1.5')).toBeVisible()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('$3')).toBeVisible()
    act(() => {
      vi.setSystemTime(new Date('2026-09-07T12:00:00+08:00'))
      fireEvent(document, new Event('visibilitychange'))
    })
    expect(screen.getByText('$1.5')).toBeVisible()
  })

  it('keeps task prices in their usage unit instead of the token unit', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr:
            'u("mode") == "pro" ? tier("pro", u("seconds") * 0.8) : tier("std", u("seconds") * 0.4)',
          billing_usage_schema: {
            seconds: { type: 'number', unit: 'second' },
            mode: { enum: ['std', 'pro'] },
          },
        })}
        onClick={vi.fn()}
        tokenUnit='K'
      />
    )
    expect(within(pricing()).getByText(/0.4.*0.8/)).toHaveTextContent(
      /0.4 – \$0.8\s*\/\s*s/
    )
    expect(within(pricing()).queryByText(/1K|1M/)).not.toBeInTheDocument()
  })

  it.each([
    [
      'an unconfigured usage model',
      { billing_usage_schema: { seconds: { type: 'number', unit: 'second' } } },
      'Price not configured',
    ],
    [
      'an unrecognized expression',
      {
        billing_mode: 'tiered_expr',
        billing_expr:
          'u("seconds") > 30 ? tier("long", u("seconds") * 0.3) : tier("short", u("seconds") * 0.4)',
        billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
      },
      'Special billing expression',
    ],
  ] as const)(
    'shows a billing note instead of inventing prices for %s',
    (_name, overrides, note) => {
      render(
        <ModelCard
          model={pricingModel(overrides as Partial<PricingModel>)}
          onClick={vi.fn()}
        />
      )
      expect(within(pricing()).getByText(note)).toBeVisible()
      expect(within(pricing()).queryByText(/Input/)).not.toBeInTheDocument()
    }
  )

  it('opens details only from the Details button, not from a card click', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const name = 'provider/model-with-a-long-name-and-a-version-suffix-20260906'
    render(
      <ModelCard model={pricingModel({ model_name: name })} onClick={onClick} />
    )
    await user.click(screen.getByRole('button', { name: 'Copy model name' }))
    expect(await navigator.clipboard.readText()).toBe(name)
    await user.click(screen.getByText(name))
    expect(onClick).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(onClick).toHaveBeenCalledWith(name)
  })

  it('shows the vendor icon instead of the letter avatar when set', () => {
    const { container } = render(
      <ModelCard
        model={pricingModel({
          vendor_name: 'Anthropic',
          vendor_icon: 'Claude.Color',
        })}
        onClick={vi.fn()}
      />
    )
    const avatar = container.querySelector('[aria-hidden].bg-muted')
    expect(avatar).not.toBeNull()
    expect(avatar).not.toHaveTextContent('A')
  })

  it('shows up to four group tags and folds the rest into +N', () => {
    const groups = ['default', 'vip', 'svip', 'enterprise', 'azure', 'cn']
    render(
      <ModelCard
        model={pricingModel({
          enable_groups: groups,
          group_ratio: Object.fromEntries(groups.map((g) => [g, 1])),
        })}
        onClick={vi.fn()}
      />
    )
    for (const group of groups.slice(0, 3)) {
      expect(screen.getByText(group)).toBeVisible()
    }
    expect(screen.queryByText('enterprise')).not.toBeInTheDocument()
    expect(screen.getByText('+3')).toHaveAttribute(
      'title',
      groups.slice(3).join(', ')
    )
  })

  it('collapses the metrics into a no-data note when perf is missing', () => {
    render(<ModelCard model={pricingModel()} onClick={vi.fn()} />)
    const metrics = screen.getByLabelText(
      'Performance metrics for the last 24 hours'
    )
    expect(metrics).toHaveTextContent('No performance data available')
    expect(within(metrics).queryByText('—')).not.toBeInTheDocument()
    expect(within(metrics).queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows dashes and muted bars when perf has no samples', () => {
    render(
      <ModelCard
        model={pricingModel()}
        onClick={vi.fn()}
        perf={{ requests: 0, series: [] }}
      />
    )
    const metrics = screen.getByLabelText(
      'Performance metrics for the last 24 hours'
    )
    expect(within(metrics).getAllByText('—')).toHaveLength(3)
    const strip = within(metrics).getByRole('img', {
      name: 'No performance data available',
    })
    expect(strip.children).toHaveLength(24)
    expect(strip.children[23]).toHaveClass('bg-border')
  })

  it('colors the success rate and the latest bars by status', () => {
    render(
      <ModelCard
        model={pricingModel()}
        onClick={vi.fn()}
        perf={perf({
          successRate: 95,
          series: [
            { ts: 7200, success_rate: 50 },
            { ts: 3600, success_rate: 100 },
          ],
        })}
      />
    )
    const metrics = screen.getByLabelText(
      'Performance metrics for the last 24 hours'
    )
    expect(within(metrics).getByText('95.00%')).toHaveClass('text-warning')
    expect(within(metrics).getByText('1.2s')).toBeVisible()
    expect(within(metrics).getByText('42')).toHaveTextContent('42 t/s')
    const bars = within(metrics).getByRole('img', {
      name: 'Success rate',
    }).children
    expect(bars[21]).toHaveClass('bg-border')
    expect(bars[22].firstElementChild).toHaveClass('bg-success', 'h-full')
    expect(bars[23].firstElementChild).toHaveClass('bg-destructive')
    expect(bars[23].firstElementChild).not.toHaveClass('h-full')
  })

  it('opens the pelican test without opening details and disables it for embeddings', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const onTest = vi.fn()
    render(
      <>
        <ModelCard model={pricingModel()} onClick={onClick} onTest={onTest} />
        <ModelCard
          model={pricingModel({
            id: 2,
            model_name: 'embed-model',
            supported_endpoint_types: ['embeddings'],
          })}
          onClick={onClick}
          onTest={onTest}
        />
      </>
    )
    const [chat, embed] = screen.getAllByRole('button', {
      name: 'Pelican test',
    })
    await user.click(chat)
    expect(onTest).toHaveBeenCalledWith('example-model')
    expect(onClick).not.toHaveBeenCalled()
    expect(embed).toBeDisabled()
  })

  it('renders every filtered model in the grid and the table', () => {
    const models = Array.from({ length: 25 }, (_, index) =>
      pricingModel({ id: index + 1, model_name: `model-${index + 1}` })
    )
    const { unmount } = render(
      <ModelCardGrid models={models} perf={new Map()} onModelClick={vi.fn()} />
    )
    expect(screen.getByText('model-25')).toBeVisible()
    unmount()
    render(
      <PricingTable
        models={models}
        perf={new Map([['model-1', perf()]])}
        tokenUnit='K'
        onModelClick={vi.fn()}
      />
    )
    expect(screen.getAllByRole('row')).toHaveLength(26)
    expect(screen.getByText('Input / 1K')).toBeVisible()
    expect(screen.getByText('99.80%')).toHaveClass('text-success')
  })
})
