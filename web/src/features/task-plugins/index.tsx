import { PlusSignIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings2, Store, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { handleServerError } from '@/lib/handle-server-error'

import {
  getTaskPluginEnabledOption,
  listTaskPlugins,
  setTaskPluginEnabledOption,
} from './api'
import { MarketplacePanel } from './components/marketplace-panel'
import { PluginDetailSheet } from './components/plugin-detail-sheet'
import { PluginsGrid } from './components/plugins-grid'
import { UploadDialog } from './components/upload-dialog'
import type { TaskPluginListItem } from './types'

export function TaskPlugins() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [detail, setDetail] = useState<TaskPluginListItem | null>(null)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [uploadKey, setUploadKey] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const enabledQuery = useQuery({
    queryKey: ['task-plugin-enabled'],
    queryFn: getTaskPluginEnabledOption,
  })
  const pluginsQuery = useQuery({
    queryKey: ['task-plugins'],
    queryFn: listTaskPlugins,
  })
  const enabledMutation = useMutation({
    mutationFn: setTaskPluginEnabledOption,
    onSuccess: (_, enabled) => {
      queryClient.setQueryData(['task-plugin-enabled'], enabled)
      toast.success(t('Task plugin setting updated'))
    },
    onError: (error) => handleServerError(error),
  })
  const openUpload = (key?: string) => {
    setUploadKey(key ?? null)
    setUploadOpen(true)
  }
  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Task Plugins')}</SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Connect drawing, video, music and other async task platforms.')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('Enable task plugins')}
                />
              }
            >
              <Settings2 className='text-muted-foreground' />
            </PopoverTrigger>
            <PopoverContent align='end' className='w-80'>
              <div className='space-y-2 text-sm'>
                <div className='flex items-center justify-between gap-3'>
                  <Label
                    htmlFor='task-plugin-enabled-switch'
                    className='font-medium'
                  >
                    {t('Enable task plugins')}
                  </Label>
                  <Switch
                    id='task-plugin-enabled-switch'
                    checked={enabledQuery.data ?? false}
                    disabled={
                      enabledQuery.isLoading || enabledMutation.isPending
                    }
                    onCheckedChange={(checked) => {
                      if (checked) enabledMutation.mutate(true)
                      else setConfirmDisable(true)
                    }}
                  />
                </div>
                <p className='text-muted-foreground'>
                  {t(
                    'When disabled, the entire task plugin system stops serving, including factory and custom plugins.'
                  )}
                </p>
                <p className='font-medium'>
                  {t('Factory and custom plugin behavior')}
                </p>
                <p className='text-muted-foreground'>
                  {t(
                    'Factory plugins cannot be deleted or disabled individually. A custom version can override them; deleting or disabling that version restores the factory plugin. Third-party-only platforms become unavailable when their plugin is deleted or disabled.'
                  )}
                </p>
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size='sm' />}>
              <HugeiconsIcon icon={PlusSignIcon} aria-hidden='true' />
              {t('Install plugin')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => setMarketplaceOpen(true)}>
                <Store />
                {t('Marketplace')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openUpload()}>
                <Upload />
                {t('Upload plugin')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <PluginsGrid
            onDetails={setDetail}
            onUpload={(key) => openUpload(key)}
          />
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <Sheet open={marketplaceOpen} onOpenChange={setMarketplaceOpen}>
        <SheetContent className='w-full gap-0 overflow-y-auto sm:max-w-4xl'>
          <SheetHeader className='border-b p-4 pr-12 sm:p-6'>
            <SheetTitle>{t('Marketplace')}</SheetTitle>
            <SheetDescription>
              {t(
                'Connect drawing, video, music and other async task platforms.'
              )}
            </SheetDescription>
          </SheetHeader>
          <div className='p-4 sm:p-6'>
            <MarketplacePanel />
          </div>
        </SheetContent>
      </Sheet>
      <PluginDetailSheet
        key={detail?.meta.key ?? ''}
        plugin={detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        initialKey={uploadKey ?? undefined}
      />
      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title={t('Disable task plugins?')}
        desc={
          <div className='space-y-2'>
            <p>
              {t(
                'Factory and custom plugins all stop serving immediately. In-flight tasks will be handled by timeout cleanup.'
              )}
            </p>
            <ul className='list-disc pl-5'>
              {(pluginsQuery.data ?? [])
                .filter((plugin) => plugin.source === 'override')
                .map((plugin) => (
                  <li key={plugin.meta.key}>
                    {plugin.meta.name} ({plugin.meta.key}):{' '}
                    {t('{{channels}} channels, {{tasks}} in-flight tasks', {
                      channels: plugin.channel_count,
                      tasks: plugin.in_flight_count,
                    })}
                  </li>
                ))}
            </ul>
          </div>
        }
        destructive
        handleConfirm={() =>
          enabledMutation.mutate(false, {
            onSuccess: () => setConfirmDisable(false),
          })
        }
        confirmText={t('Disable')}
      />
    </>
  )
}
