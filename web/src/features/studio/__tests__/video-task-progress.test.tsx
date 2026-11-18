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
import { act, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { VideoTaskProgress } from '../components/video-task-progress'

describe('VideoTaskProgress', () => {
  it('updates the phase label when the interface language changes', async () => {
    const i18n = createInstance()
    await i18n.init({
      lng: 'en',
      resources: {
        en: { translation: { 'Downloading video': 'Downloading video' } },
        zhCN: { translation: { 'Downloading video': '下载视频' } },
      },
    })
    render(
      <I18nextProvider i18n={i18n}>
        <VideoTaskProgress
          data={{ stage: 'downloading' }}
          inProgress
          progress={80}
        />
      </I18nextProvider>
    )
    expect(screen.getByText('Downloading video · 80%')).toBeInTheDocument()
    await act(async () => {
      await i18n.changeLanguage('zhCN')
    })
    expect(screen.getByText('下载视频 · 80%')).toBeInTheDocument()
  })
  it.each([
    ['queued', 'Queued'],
    ['planning', 'Planning video shots'],
    ['connecting', 'Connecting to video service'],
    ['generating', 'Generating'],
    ['downloading', 'Downloading video'],
    ['joining', 'Assembling video'],
    ['retrying', 'Waiting to retry'],
    ['status_unknown', 'Checking task status'],
  ])('shows the %s stage', async (stage, label) => {
    const i18n = createInstance()
    await i18n.init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: {} } },
    })
    render(
      <I18nextProvider i18n={i18n}>
        <VideoTaskProgress
          data={{ stage, segment: 2, segments: 3, attempt: 2 }}
          inProgress
          progress={45}
        />
      </I18nextProvider>
    )
    expect(
      screen.getByText(`${label} · Segment 2/3 · Attempt 2 · 45%`)
    ).toBeInTheDocument()
  })

  it('keeps other providers readable and ignores malformed stage data', async () => {
    const i18n = createInstance()
    await i18n.init({
      lng: 'zh-CN',
      fallbackLng: 'en',
      resources: { en: { translation: {} } },
    })
    render(
      <I18nextProvider i18n={i18n}>
        <VideoTaskProgress
          data={{
            stage: 'untrusted',
            segment: -1,
            segments: '3',
            attempt: '2',
          }}
          inProgress={false}
          progress={Number.NaN}
        />
      </I18nextProvider>
    )
    expect(screen.getByText('Queued')).toBeInTheDocument()
  })
})
