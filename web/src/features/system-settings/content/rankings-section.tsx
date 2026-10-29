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
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
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
  start_date: string
  end_date: string
  overrides: DailyOverrideRow[]
}

type DailyOverrideRow = {
  key: number
  date: string
  tokens: string
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
      start_date: String(item?.start_date ?? ''),
      end_date: String(item?.end_date ?? ''),
      overrides: Object.entries(
        (item?.daily_overrides ?? {}) as Record<string, number>
      )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, tokens]) => ({
          key: ++rowKey,
          date,
          tokens: String(tokens),
        })),
    }))
  } catch {
    return []
  }
}

function serializeRows(rows: SimulatedModelRow[]): string {
  return JSON.stringify(
    rows.map((row) => {
      const overrides = [...row.overrides].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      return {
        model_name: row.model_name.trim(),
        daily_tokens: Math.round(Number(row.daily_tokens) || 0),
        growth_pct: Number(row.growth_pct) || 0,
        ...(row.start_date ? { start_date: row.start_date } : {}),
        ...(row.end_date ? { end_date: row.end_date } : {}),
        ...(overrides.length > 0
          ? {
              daily_overrides: Object.fromEntries(
                overrides.map((o) => [o.date, Math.round(Number(o.tokens))])
              ),
            }
          : {}),
      }
    })
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
    const tokens = Number(row.daily_tokens || 0)
    if (
      !Number.isFinite(tokens) ||
      tokens < 0 ||
      (tokens === 0 && row.overrides.length === 0)
    ) {
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
    if (row.start_date && row.end_date && row.start_date > row.end_date) {
      return {
        key: 'Row {{line}}: start date must not be after end date',
        params: { line },
      }
    }
    const dates = new Set<string>()
    for (const override of row.overrides) {
      if (!override.date) {
        return {
          key: 'Row {{line}}: every dated value needs a date',
          params: { line },
        }
      }
      if (dates.has(override.date)) {
        return {
          key: 'Row {{line}}: duplicate date {{date}}',
          params: { line, date: override.date },
        }
      }
      dates.add(override.date)
      const value = Number(override.tokens)
      if (override.tokens === '' || !Number.isFinite(value) || value < 0) {
        return {
          key: 'Row {{line}}: tokens on {{date}} must be 0 or more',
          params: { line, date: override.date },
        }
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
  const [editingKey, setEditingKey] = useState<number | null>(null)
  const editingRow = rows.find((row) => row.key === editingKey) ?? null

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
                  'Daily tokens scale with the period (today ×1, week ×7, month ×30, year ×365). Growth is against the previous period and drives the rank change and trend lines. Start and end dates limit the days a model has usage; dated values set the exact tokens for a day (UTC). Vendors are matched from model metadata.'
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
                  {
                    key: ++rowKey,
                    model_name: '',
                    daily_tokens: '',
                    growth_pct: '0',
                    start_date: '',
                    end_date: '',
                    overrides: [],
                  },
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
              <table className='w-full min-w-[960px] text-sm'>
                <thead className='bg-muted/40 text-muted-foreground text-xs'>
                  <tr>
                    <th className='px-3 py-2 text-left font-medium'>{t('Model name')}</th>
                    <th className='px-3 py-2 text-left font-medium'>{t('Daily tokens')}</th>
                    <th className='px-3 py-2 text-left font-medium'>{t('Growth (%)')}</th>
                    <th className='px-3 py-2 text-left font-medium'>{t('Start date')}</th>
                    <th className='px-3 py-2 text-left font-medium'>{t('End date')}</th>
                    <th className='px-3 py-2 text-left font-medium'>{t('Dated values')}</th>
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
                      <td className='px-3 py-2'>
                        <Input
                          type='date'
                          value={row.start_date}
                          aria-label={t('Start date')}
                          onChange={(e) => updateRow(row.key, { start_date: e.target.value })}
                        />
                      </td>
                      <td className='px-3 py-2'>
                        <Input
                          type='date'
                          value={row.end_date}
                          aria-label={t('End date')}
                          onChange={(e) => updateRow(row.key, { end_date: e.target.value })}
                        />
                      </td>
                      <td className='px-3 py-2'>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={() => setEditingKey(row.key)}
                        >
                          <CalendarDays className='size-4' />
                          {row.overrides.length > 0
                            ? t('{{count}} days', { count: row.overrides.length })
                            : t('Set')}
                        </Button>
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
          <DailyOverridesDialog
            row={editingRow}
            onClose={() => setEditingKey(null)}
            onChange={(overrides) => {
              if (editingRow) updateRow(editingRow.key, { overrides })
            }}
          />
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

function DailyOverridesDialog(props: {
  row: SimulatedModelRow | null
  onClose: () => void
  onChange: (overrides: DailyOverrideRow[]) => void
}) {
  const { t } = useTranslation()
  const overrides = props.row?.overrides ?? []

  const update = (key: number, patch: Partial<DailyOverrideRow>) => {
    props.onChange(
      overrides.map((item) => (item.key === key ? { ...item, ...patch } : item))
    )
  }

  return (
    <Dialog
      open={props.row !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('Dated values')}
      description={t(
        'Exact tokens for {{model}} on specific days (UTC). They replace the daily average and apply even outside the start and end dates.',
        { model: props.row?.model_name.trim() || t('this model') }
      )}
      footer={
        <Button type='button' onClick={props.onClose}>
          {t('Done')}
        </Button>
      }
    >
      <div className='space-y-3'>
        {overrides.length === 0 ? (
          <p className='text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm'>
            {t('No dated values yet')}
          </p>
        ) : (
          <div className='space-y-2'>
            {overrides.map((item) => (
              <div key={item.key} className='flex items-center gap-2'>
                <Input
                  type='date'
                  className='w-44 shrink-0'
                  value={item.date}
                  aria-label={t('Date')}
                  onChange={(e) => update(item.key, { date: e.target.value })}
                />
                <Input
                  type='number'
                  min={0}
                  step={1}
                  value={item.tokens}
                  placeholder='500000000'
                  aria-label={t('Tokens')}
                  onChange={(e) => update(item.key, { tokens: e.target.value })}
                />
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  aria-label={t('Delete')}
                  onClick={() =>
                    props.onChange(overrides.filter((o) => o.key !== item.key))
                  }
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() =>
            props.onChange([...overrides, { key: ++rowKey, date: '', tokens: '' }])
          }
        >
          <Plus className='size-4' />
          {t('Add date')}
        </Button>
      </div>
    </Dialog>
  )
}
