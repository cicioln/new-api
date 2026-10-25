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
import { PlusSignIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { nanoid } from 'nanoid'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { CodeDialog } from './components/compare/code-dialog'
import {
  CompareCard,
  type CompareCardController,
} from './components/compare/compare-card'
import { CompareComposer } from './components/compare/compare-composer'
import { SettingsPanel } from './components/compare/settings-panel'
import { usePlaygroundOptions, usePlaygroundState } from './hooks'
import { applyMessageStateUpdate, type MessageStateUpdater } from './lib'
import type { Message, ParameterEnabled } from './types'

const MAX_COMPARISONS = 3
const PRIMARY_ID = 'primary'

type ExtraPanel = { id: string; model: string; messages: Message[] }

export function Playground() {
  const { t } = useTranslation()
  const {
    config,
    parameterEnabled,
    messages,
    models,
    groups,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
  } = usePlaygroundState()

  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  const [extraPanels, setExtraPanels] = useState<ExtraPanel[]>([])
  const [generatingIds, setGeneratingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [codeOpen, setCodeOpen] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const controllers = useRef(new Map<string, CompareCardController>())

  // The sliders are always visible, so their values are always sent.
  const effectiveParameterEnabled = useMemo<ParameterEnabled>(
    () => ({
      ...parameterEnabled,
      temperature: true,
      top_p: true,
      max_tokens: true,
    }),
    [parameterEnabled]
  )

  const handleGeneratingChange = useCallback(
    (id: string, generating: boolean) => {
      setGeneratingIds((current) => {
        if (current.has(id) === generating) return current
        const next = new Set(current)
        if (generating) next.add(id)
        else next.delete(id)
        return next
      })
    },
    []
  )

  const updatePanelMessages = useCallback(
    (id: string, updater: MessageStateUpdater) => {
      setExtraPanels((panels) =>
        panels.map((panel) =>
          panel.id === id
            ? {
                ...panel,
                messages: applyMessageStateUpdate(panel.messages, updater),
              }
            : panel
        )
      )
    },
    []
  )

  // Stable per-panel updaters keep each card's chat handlers from re-creating.
  const panelUpdaters = useRef(
    new Map<string, (updater: MessageStateUpdater) => void>()
  )
  const getPanelUpdater = (id: string) => {
    let updater = panelUpdaters.current.get(id)
    if (!updater) {
      updater = (next) => updatePanelMessages(id, next)
      panelUpdaters.current.set(id, updater)
    }
    return updater
  }

  // Open with two side-by-side comparisons once a second model is available.
  if (!seeded && config.model && models.length > 1) {
    setSeeded(true)
    const second = models.find((option) => option.value !== config.model)
    if (second && extraPanels.length === 0) {
      setExtraPanels([{ id: nanoid(), model: second.value, messages: [] }])
    }
  }

  const isGenerating = generatingIds.size > 0
  const hasMessages =
    messages.length > 0 || extraPanels.some((panel) => panel.messages.length)

  const handleAddComparison = () => {
    const used = new Set([config.model, ...extraPanels.map((p) => p.model)])
    const nextModel =
      models.find((option) => !used.has(option.value))?.value ?? config.model
    setExtraPanels((panels) => [
      ...panels,
      { id: nanoid(), model: nextModel, messages: [] },
    ])
  }

  const forEachController = (
    action: (controller: CompareCardController) => void
  ) => {
    controllers.current.forEach(action)
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Playground')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t(
          'Tune parameters and compare outputs across models. Requests are billed to the selected group.'
        )}
      </SectionPageLayout.Description>
      <SectionPageLayout.Actions>
        <Button variant='outline' size='sm' onClick={() => setCodeOpen(true)}>
          {t('View code')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={
            isGenerating ||
            models.length === 0 ||
            extraPanels.length + 1 >= MAX_COMPARISONS
          }
          onClick={handleAddComparison}
        >
          <HugeiconsIcon icon={PlusSignIcon} aria-hidden='true' />
          {t('Add comparison')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[280px_minmax(0,1fr)]'>
          <SettingsPanel
            config={config}
            groups={groups}
            disabled={isGenerating}
            onConfigChange={updateConfig}
          />
          <div className='grid min-w-0 gap-3.5'>
            <div className='grid grid-cols-1 items-start gap-3.5 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]'>
              <CompareCard
                id={PRIMARY_ID}
                model={config.model}
                models={models}
                onModelChange={(value) => updateConfig('model', value)}
                config={config}
                parameterEnabled={effectiveParameterEnabled}
                messages={messages}
                updateMessages={updateMessages}
                controllers={controllers}
                onGeneratingChange={handleGeneratingChange}
              />
              {extraPanels.map((panel) => (
                <CompareCard
                  key={panel.id}
                  id={panel.id}
                  model={panel.model}
                  models={models}
                  onModelChange={(value) =>
                    setExtraPanels((panels) =>
                      panels.map((item) =>
                        item.id === panel.id ? { ...item, model: value } : item
                      )
                    )
                  }
                  onRemove={() => {
                    panelUpdaters.current.delete(panel.id)
                    setExtraPanels((panels) =>
                      panels.filter((item) => item.id !== panel.id)
                    )
                  }}
                  config={config}
                  parameterEnabled={effectiveParameterEnabled}
                  messages={panel.messages}
                  updateMessages={getPanelUpdater(panel.id)}
                  controllers={controllers}
                  onGeneratingChange={handleGeneratingChange}
                />
              ))}
            </div>
            <CompareComposer
              canSend={!isLoadingModels && models.length > 0}
              isGenerating={isGenerating}
              hasMessages={hasMessages}
              onSubmit={(text) =>
                forEachController((controller) => controller.send(text))
              }
              onStop={() =>
                forEachController((controller) => controller.stop())
              }
              onClear={() =>
                forEachController((controller) => controller.clear())
              }
            />
          </div>
        </div>
        <CodeDialog
          open={codeOpen}
          onOpenChange={setCodeOpen}
          config={config}
          parameterEnabled={effectiveParameterEnabled}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
