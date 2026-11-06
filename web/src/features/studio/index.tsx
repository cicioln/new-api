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
import { Image, LayoutGrid, Video, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PublicHeader } from '@/components/layout'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { ReferenceImage } from './components/form-parts'
import { GalleryPanel } from './components/gallery-panel'
import { ImagePanel } from './components/image-panel'
import { VideoPanel } from './components/video-panel'
import { MAX_REFERENCE_IMAGES, newId, useStudioGroups } from './lib/options'

type StudioView = 'image' | 'video' | 'gallery'

const VIEWS: { value: StudioView; label: string; icon: LucideIcon }[] = [
  { value: 'image', label: 'AI images', icon: Image },
  { value: 'video', label: 'AI videos', icon: Video },
  { value: 'gallery', label: 'Gallery', icon: LayoutGrid },
]

export function Studio() {
  const { t } = useTranslation()
  const [view, setView] = useState<StudioView>('image')
  const imageGroups = useStudioGroups('image')
  const videoGroups = useStudioGroups('video')
  const [imageRefs, setImageRefs] = useState<ReferenceImage[]>([])
  const [videoRefs, setVideoRefs] = useState<ReferenceImage[]>([])

  const sendToVideo = async (src: string) => {
    try {
      const blob = await (await fetch(src)).blob()
      const file = new File([blob], `studio-${Date.now()}.png`, {
        type: blob.type || 'image/png',
      })
      const image = { id: newId(), file, url: URL.createObjectURL(file) }
      setVideoRefs((list) => {
        const next = [image, ...list]
        next
          .slice(MAX_REFERENCE_IMAGES)
          .forEach((old) => URL.revokeObjectURL(old.url))
        return next.slice(0, MAX_REFERENCE_IMAGES)
      })
      setView('video')
    } catch {
      toast.error(t('Could not load this image'))
    }
  }

  const groups =
    view === 'image' ? imageGroups : view === 'video' ? videoGroups : null

  return (
    <div className='bg-background text-foreground flex h-svh min-h-0 flex-col overflow-hidden'>
      <PublicHeader className='shrink-0' />
      <div className='flex min-h-0 flex-1 flex-col md:flex-row'>
        <aside className='bg-muted/30 flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:w-[220px] md:flex-col md:overflow-visible md:border-r md:border-b-0 md:p-3'>
          {VIEWS.map((item) => (
            <button
              key={item.value}
              type='button'
              aria-current={view === item.value ? 'page' : undefined}
              onClick={() => setView(item.value)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                view === item.value
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className='size-4 shrink-0' />
              {t(item.label)}
            </button>
          ))}
          <div className='hidden flex-1 md:block' />
          {groups && groups.groups.length > 1 && (
            <div className='ml-auto grid shrink-0 gap-1.5 md:ml-0 md:border-t md:pt-3'>
              <span className='text-muted-foreground hidden text-xs md:block'>
                {t('Group')}
              </span>
              <Select
                value={groups.group}
                onValueChange={(value) => {
                  if (value) groups.setGroup(String(value))
                }}
              >
                <SelectTrigger
                  aria-label={t('Group')}
                  size='sm'
                  className='bg-card h-8 w-full min-w-28'
                >
                  <SelectValue>
                    {groups.groups.find((item) => item.value === groups.group)
                      ?.label ?? groups.group}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {groups.groups.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </aside>

        <main className='relative flex min-h-0 min-w-0 flex-1 flex-col'>
          {/* Faint grid with a glow behind the composer. */}
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_50%_60%,black,transparent_75%)] bg-size-[48px_48px] opacity-40'
          />
          <div
            aria-hidden
            className='from-primary/10 pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-radial-[at_50%_100%] to-transparent to-70%'
          />
          <div
            className='relative flex min-h-0 flex-1 flex-col'
            hidden={view !== 'image'}
          >
            <ImagePanel
              group={imageGroups.group}
              references={imageRefs}
              onReferencesChange={setImageRefs}
              onToVideo={(src) => void sendToVideo(src)}
            />
          </div>
          <div
            className='relative flex min-h-0 flex-1 flex-col'
            hidden={view !== 'video'}
          >
            <VideoPanel
              group={videoGroups.group}
              references={videoRefs}
              onReferencesChange={setVideoRefs}
            />
          </div>
          {view === 'gallery' && (
            <div className='relative flex min-h-0 flex-1 flex-col'>
              <GalleryPanel onToVideo={(src) => void sendToVideo(src)} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
