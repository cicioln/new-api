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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { ReferenceImage } from './components/form-parts'
import { ImagePanel } from './components/image-panel'
import { VideoPanel } from './components/video-panel'
import { MAX_REFERENCE_IMAGES, newId, useStudioGroups } from './lib/options'

type StudioTab = 'image' | 'text-video' | 'image-video'

const TABS: { value: StudioTab; label: string }[] = [
  { value: 'image', label: 'Text to image' },
  { value: 'text-video', label: 'Text to video' },
  { value: 'image-video', label: 'Image to video' },
]

export function Studio() {
  const { t } = useTranslation()
  const { groups, group, setGroup } = useStudioGroups()
  const [tab, setTab] = useState<StudioTab>('image')
  const [references, setReferences] = useState<ReferenceImage[]>([])

  const sendToVideo = async (src: string) => {
    try {
      const blob = await (await fetch(src)).blob()
      const file = new File([blob], `studio-${Date.now()}.png`, {
        type: blob.type || 'image/png',
      })
      const image = { id: newId(), file, url: URL.createObjectURL(file) }
      setReferences((list) => {
        const next = [image, ...list]
        next.slice(MAX_REFERENCE_IMAGES).forEach((old) => URL.revokeObjectURL(old.url))
        return next.slice(0, MAX_REFERENCE_IMAGES)
      })
      setTab('image-video')
    } catch {
      toast.error(t('Could not load this image'))
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Creative Studio')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Generate images and videos from prompts. Charges come from your wallet balance.')}
      </SectionPageLayout.Description>
      {groups.length > 0 && (
        <SectionPageLayout.Actions>
          <Select
            value={group}
            onValueChange={(value) => {
              if (value) setGroup(String(value))
            }}
          >
            <SelectTrigger aria-label={t('Group')} className='h-9 min-w-36'>
              <SelectValue>
                {groups.find((item) => item.value === group)?.label ?? group}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {groups.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SectionPageLayout.Actions>
      )}
      <SectionPageLayout.Content>
        <Tabs value={tab} onValueChange={(value) => setTab(value as StudioTab)}>
          <div className='mb-[18px] overflow-x-auto border-b'>
            <TabsList
              variant='line'
              className='min-w-max justify-start gap-0.5 p-0 group-data-horizontal/tabs:h-auto'
            >
              {TABS.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className='text-muted-foreground data-active:text-foreground flex-none px-3 py-[9px] text-[13.5px] font-normal group-data-horizontal/tabs:after:bottom-[-1px] data-active:font-medium'
                >
                  {t(item.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value='image' keepMounted>
            <ImagePanel group={group} onToVideo={(src) => void sendToVideo(src)} />
          </TabsContent>
          <TabsContent value='text-video' keepMounted>
            <VideoPanel
              group={group}
              mode='text'
              references={[]}
              onReferencesChange={() => {}}
            />
          </TabsContent>
          <TabsContent value='image-video' keepMounted>
            <VideoPanel
              group={group}
              mode='image'
              references={references}
              onReferencesChange={setReferences}
            />
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
