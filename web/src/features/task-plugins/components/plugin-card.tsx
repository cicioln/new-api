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
import { Eye, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { resolveLocalizedText } from '@/lib/localized-text'

import type { TaskPluginListItem } from '../types'
import { PluginIcon } from './plugin-icon'

type PluginCardProps = {
  plugin: TaskPluginListItem
  switchDisabled: boolean
  onToggle: (enabled: boolean) => void
  onDetails: () => void
  onUpload: () => void
  onDelete: () => void
}

/**
 * One installed plugin: identity and enable switch on top, the plugin's own
 * description, then its serving state with the configuration menu. Manifest
 * detail (models, billing parameters, source) lives in the detail sheet.
 */
export function PluginCard(props: PluginCardProps) {
  const { t, i18n } = useTranslation()
  const meta = props.plugin.meta
  const description = resolveLocalizedText(meta.description, i18n.language)

  let status = (
    <span>
      {props.plugin.enabled
        ? t('Enabled · {{count}} channels bound', {
            count: props.plugin.channel_count,
          })
        : t('Plugin not enabled')}
    </span>
  )
  if (props.plugin.runtime_status === 'compile_failed') {
    status = (
      <span className='text-destructive' title={props.plugin.runtime_error}>
        {t('Compilation failed')}
      </span>
    )
  }

  return (
    <div className='bg-card flex min-w-0 flex-col gap-3 rounded-[10px] border p-4'>
      <div className='flex items-center gap-3'>
        <span className='shrink-0'>
          <PluginIcon
            plugin={{ ...meta, hasIcon: props.plugin.has_icon }}
            size={34}
          />
        </span>
        <div className='min-w-0'>
          <div className='truncate text-sm font-semibold'>{meta.name}</div>
          <small
            className='text-muted-foreground text-xs'
            aria-label={`${t('Active version')} ${meta.version}`}
          >
            {meta.version ? `v${meta.version}` : '—'}
          </small>
        </div>
        <Switch
          aria-label={t('Enable plugin {{key}}', { key: meta.key })}
          checked={props.plugin.enabled}
          disabled={props.switchDisabled}
          onCheckedChange={props.onToggle}
          className='data-checked:bg-success data-unchecked:bg-border ml-auto px-px data-[size=default]:h-5 data-[size=default]:w-[34px]'
        />
      </div>
      {description ? (
        <p className='text-muted-foreground line-clamp-2 text-[13px] leading-[1.6]'>
          {description}
        </p>
      ) : null}
      <div className='text-muted-foreground mt-auto flex items-center justify-between gap-2 text-xs'>
        {status}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant='outline' size='sm' />}>
            {t('Configure')}
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={props.onDetails}>
              <Eye />
              {t('Details')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onUpload}>
              <Upload />
              {t('Upload new version')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={props.plugin.source === 'factory'}
              variant='destructive'
              onClick={props.onDelete}
            >
              <Trash2 />
              {t('Delete active custom version')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
