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
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'

import * as settingsApi from '../../api'
import { SettingsPageProvider } from '../../components/settings-page-context'
import { UsageReportingSettingsCard } from '../usage-reporting-settings-card'

function Fixture() {
  const [queryClient] = useState(() => new QueryClient())
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsPageProvider actionsContainer={actions}>
        <div ref={setActions} />
        <UsageReportingSettingsCard passthrough={false} ratio={0.6657} />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

describe('usage reporting settings', () => {
  it('shows the shipped Chinese translations after a language change', async () => {
    i18next.addResourceBundle('zhCN', 'translation', zh.translation)
    await i18next.changeLanguage('zhCN')
    try {
      render(<Fixture />)
      expect(
        screen.getByRole('switch', { name: '上报真实 Token 用量' })
      ).toBeVisible()
      expect(
        screen.getByRole('spinbutton', { name: '用量展示系数' })
      ).toHaveValue(0.6657)
    } finally {
      await act(async () => {
        await i18next.changeLanguage('en')
      })
    }
  })
  it('defaults to scaling and keeps the custom ratio when toggled with the keyboard', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    const toggle = screen.getByRole('switch', {
      name: 'Report Actual Token Usage',
    })
    const ratio = screen.getByRole('spinbutton', {
      name: 'Usage Display Ratio',
    })
    expect(toggle).not.toBeChecked()
    expect(ratio).toHaveValue(0.6657)
    await user.clear(ratio)
    await user.type(ratio, '0.75')
    toggle.focus()
    await user.keyboard(' ')
    expect(toggle).toBeChecked()
    expect(ratio).toBeDisabled()
    await user.keyboard(' ')
    expect(ratio).toBeEnabled()
    expect(ratio).toHaveValue(0.75)
  })

  it('saves a custom coefficient and passthrough through the option API', async () => {
    const update = vi
      .spyOn(settingsApi, 'updateSystemOption')
      .mockResolvedValue({ success: true, message: '' })
    const user = userEvent.setup()
    render(<Fixture />)
    const ratio = screen.getByRole('spinbutton', {
      name: 'Usage Display Ratio',
    })
    await user.clear(ratio)
    await user.type(ratio, '0.5')
    await user.click(
      screen.getByRole('switch', { name: 'Report Actual Token Usage' })
    )
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        key: 'global.usage_passthrough_enabled',
        value: true,
      })
    )
    expect(update).toHaveBeenCalledWith({
      key: 'global.usage_display_ratio',
      value: 0.5,
    })
  })

  it('rejects a nonpositive coefficient and exposes the validation error', async () => {
    const update = vi
      .spyOn(settingsApi, 'updateSystemOption')
      .mockResolvedValue({ success: true, message: '' })
    const user = userEvent.setup()
    render(<Fixture />)
    const ratio = screen.getByRole('spinbutton', {
      name: 'Usage Display Ratio',
    })
    await user.clear(ratio)
    await user.type(ratio, '0')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(
      await screen.findByText(
        'Usage display ratio must be a finite number greater than zero'
      )
    ).toBeVisible()
    expect(ratio).toHaveAttribute('aria-invalid', 'true')
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps edits available after a failed save so the user can retry', async () => {
    const update = vi
      .spyOn(settingsApi, 'updateSystemOption')
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValue({ success: true, message: '' })
    const user = userEvent.setup()
    render(<Fixture />)
    const ratio = screen.getByRole('spinbutton', {
      name: 'Usage Display Ratio',
    })
    await user.clear(ratio)
    await user.type(ratio, '0.5')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    )
    expect(ratio).toHaveValue(0.5)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
  })
})
