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
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

export type RankingsMode = 'real' | 'simulated' | 'mixed'

type SimulatedModelRow = {
  key: number
  model_name: string
  daily_tokens: string
  growth_pct: string
}

type RankingsSectionProps = {
  mode: RankingsMode
  models: string
}

const MODE_OPTIONS: { value: RankingsMode; label: string; hint: string }[] = [
  {
    value: 'real',
    label: 'Real data',
    hint: 'Rankings come only from actual usage logs.',
  },
  {
    value: 'simulated',
    label: 'Simulated data',
    hint: 'Rankings show only the models configured below; usage logs are ignored.',
  },
  {
    value: 'mixed',
    label: 'Real + simulated',
    hint: 'Configured tokens are added on top of actual usage for the same model.',
  },
]

let rowKey = 0

function parseRows(raw: string): SimulatedModelRow[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => ({
      key: ++rowKey,
      model_name: String(item?.model_name ?? ''),
      daily_tokens: item?.daily_tokens ? String(item.daily_tokens) : '',
      growth_pct: item?.growth_pct != null ? String(item.growth_pct) : '0',
    }))
  } catch {
    return []
  }
}

function serializeRows(rows: SimulatedModelRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      model_name: row.model_name.trim(),
      daily_tokens: Math.round(Number(row.daily_tokens)),
      growth_pct: Number(row.growth_pct) || 0,
    }))
  )
}

/** First problem with the rows as an i18n key and params, or null. */
function validateRows(
  rows: SimulatedModelRow[]
): { key: string; params: Record<string, unknown> } | null {
  const seen = new Set<string>()
  for (const [index, row] of rows.entries()) {
    const line = index + 1
    const name = row.model_name.trim()
    if (!name) return { key: 'Row {{line}}: model name is required', params: { line } }
    if (seen.has(name)) {
      return { key: 'Row {{line}}: duplicate model {{name}}', params: { line, name } }
    }
    seen.add(name)
    const tokens = Number(row.daily_tokens)
    if (!Number.isFinite(tokens) || tokens <= 0) {
      return {
        key: 'Row {{line}}: daily tokens must be greater than 0',
        params: { line },
      }
    }
    const growth = Number(row.growth_pct)
    if (!Number.isFinite(growth) || growth <= -100 || growth > 10000) {
      return {
        key: 'Row {{line}}: growth must be between -100% and 10000%',
        params: { line },
      }
    }
  }
  return null
}

export function RankingsSection(props: RankingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [mode, setMode] = useState<RankingsMode>(props.mode)
  const [rows, setRows] = useState<SimulatedModelRow[]>(() =>
    parseRows(props.models)
  )

  useEffect(() => {
    setMode(props.mode)
  }, [props.mode])
  useEffect(() => {
    setRows(parseRows(props.models))
  }, [props.models])

  const baselineModels = useMemo(
    () => serializeRows(parseRows(props.models)),
    [props.models]
  )
  const simulationOn = mode !== 'real'

  const updateRow = (key: number, patch: Partial<SimulatedModelRow>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  }

  const handleSave = async () => {
    const problem = validateRows(rows)
    if (problem) {
      toast.error(t(problem.key, problem.params))
      return
    }
    const models = serializeRows(rows)
    if (mode === props.mode && models === baselineModels) {
      toast.info(t('No changes to save'))
      return
    }
    if (models !== baselineModels) {
      await updateOption.mutateAsync({ key: 'rankings_setting.models', value: models })
    }
    if (mode !== props.mode) {
      await updateOption.mutateAsync({ key: 'rankings_setting.mode', value: mode })
    }
  }

  return (
    <SettingsSection title={t('Rankings')}>
      <SettingsPageFormActions
        onSave={() => void handleSave()}
        isSaving={updateOption.isPending}
      />
      <div className='space-y-6'>
        <div className='max-w-sm space-y-2'>
          <Label>{t('Data source')}</Label>
          <Select
            items={MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.label),
            }))}
            value={mode}
            onValueChange={(value) => setMode(value as RankingsMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-xs'>
            {t(MODE_OPTIONS.find((option) => option.value === mode)?.hint ?? '')}
          </p>
        </div>

        <div className='space-y-3'>
          <div className='flex flex-wrap items-end justify-between gap-2'>
            <div>
              <h4 className='font-medium'>{t('Simulated models')}</h4>
              <p className='text-muted-foreground mt-1 text-xs'>
                {t(
                  'Daily tokens scale with the period (today ×1, week ×7, month ×30, year ×365). Growth is against the previous period and drives the rank change and trend lines. Vendors are matched from model metadata.'
                )}
              </p>
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() =>
                setRows((current) => [
                  ...current,
                  { key: ++rowKey, model_name: '', daily_tokens: '', growth_pct: '0' },
                ])
              }
            >
              <Plus className='size-4' />
              {t('Add model')}
            </Button>
          </div>

          {rows.length === 0 ? (
            <p className='text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm'>
              {t('No simulated models yet')}
            </p>
          ) : (
            <div className='overflow-x-auto rounded-lg border'>
              <table className='w-full min-w-[560px] text-sm'>
                <thead className='bg-muted/40 text-muted-foreground text-xs'>
                  <tr>
                    <th className='px-3 py-2 text-left font-medium'>{t('Model name')}</th>
                    <th className='px-3 py-2 text-left font-medium'>{t('Daily tokens')}</th>
                    <th className='px-3 py-2 text-left font-medium'>{t('Growth (%)')}</th>
                    <th className='w-12 px-3 py-2' />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className='border-t'>
                      <td className='px-3 py-2'>
                        <Input
                          value={row.model_name}
                          placeholder='gpt-5'
                          aria-label={t('Model name')}
                          onChange={(e) => updateRow(row.key, { model_name: e.target.value })}
                        />
                      </td>
                      <td className='px-3 py-2'>
                        <Input
                          type='number'
                          min={1}
                          step={1}
                          value={row.daily_tokens}
                          placeholder='50000000'
                          aria-label={t('Daily tokens')}
                          onChange={(e) => updateRow(row.key, { daily_tokens: e.target.value })}
                        />
                      </td>
                      <td className='px-3 py-2'>
                        <Input
                          type='number'
                          step={1}
                          value={row.growth_pct}
                          aria-label={t('Growth (%)')}
                          onChange={(e) => updateRow(row.key, { growth_pct: e.target.value })}
                        />
                      </td>
                      <td className='px-3 py-2 text-right'>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          aria-label={t('Delete')}
                          onClick={() =>
                            setRows((current) => current.filter((item) => item.key !== row.key))
                          }
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!simulationOn && rows.length > 0 && (
            <p className='text-warning text-xs'>
              {t('Simulated models only take effect when the data source is Simulated or Real + simulated.')}
            </p>
          )}
        </div>
      </div>
    </SettingsSection>
  )
}
