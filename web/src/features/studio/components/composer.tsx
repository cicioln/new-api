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
import { LoaderCircle, Plus, SendHorizontal, X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  MAX_REFERENCE_BYTES,
  MAX_REFERENCE_IMAGES,
  newId,
} from '../lib/options'
import type { ReferenceImage } from './form-parts'

/**
 * The prompt box pinned to the bottom of a studio view: reference images,
 * the prompt, a toolbar of settings, the estimate and the send button.
 */
export function Composer(props: {
  id: string
  prompt: string
  onPromptChange: (value: string) => void
  placeholder: string
  references: ReferenceImage[]
  onReferencesChange: (images: ReferenceImage[]) => void
  toolbar: ReactNode
  estimate?: string
  canSubmit: boolean
  submitting: boolean
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const room = MAX_REFERENCE_IMAGES - props.references.length

  const accept = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    if (images.some((file) => file.size > MAX_REFERENCE_BYTES)) {
      toast.error(t('Each image must be 10 MB or smaller'))
    }
    const usable = images.filter((file) => file.size <= MAX_REFERENCE_BYTES)
    if (usable.length > room) {
      toast.error(
        t('At most {{count}} reference images', { count: MAX_REFERENCE_IMAGES })
      )
    }
    const added = usable.slice(0, Math.max(room, 0)).map((file) => ({
      id: newId(),
      file,
      url: URL.createObjectURL(file),
    }))
    if (added.length > 0)
      props.onReferencesChange([...props.references, ...added])
  }

  const remove = (id: string) => {
    const removed = props.references.find((image) => image.id === id)
    if (removed) URL.revokeObjectURL(removed.url)
    props.onReferencesChange(
      props.references.filter((image) => image.id !== id)
    )
  }

  return (
    <div
      className='bg-card border-primary/40 ring-primary/10 mx-auto grid w-full max-w-[900px] gap-2.5 rounded-2xl border p-3 shadow-xl ring-4'
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        accept(Array.from(event.dataTransfer.files))
      }}
      onPaste={(event) => {
        if (event.clipboardData.files.length > 0) {
          accept(Array.from(event.clipboardData.files))
        }
      }}
    >
      <div className='flex flex-wrap gap-2'>
        {props.references.map((image) => (
          <div
            key={image.id}
            className='relative size-14 overflow-hidden rounded-lg border'
          >
            <img src={image.url} alt='' className='size-full object-cover' />
            <button
              type='button'
              aria-label={t('Remove image')}
              onClick={() => remove(image.id)}
              className='absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white'
            >
              <X className='size-3' />
            </button>
          </div>
        ))}
        {room > 0 && (
          <button
            type='button'
            aria-label={t('Add image')}
            onClick={() => input.current?.click()}
            className='bg-muted/40 text-muted-foreground hover:bg-muted flex size-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[11px]'
          >
            <Plus className='size-4' />
            {t('Reference image')}
          </button>
        )}
        <input
          ref={input}
          type='file'
          accept='image/*'
          multiple
          hidden
          onChange={(event) => {
            accept(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
      </div>
      <textarea
        id={props.id}
        aria-label={t('Prompt')}
        value={props.prompt}
        placeholder={props.placeholder}
        rows={3}
        onChange={(event) => props.onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault()
            if (props.canSubmit) props.onSubmit()
          }
        }}
        className='placeholder:text-muted-foreground max-h-48 min-h-16 w-full resize-none bg-transparent px-1 text-[14.5px] outline-none'
      />
      <div className='flex flex-wrap items-center gap-2 border-t pt-2.5'>
        {props.toolbar}
        <span className='flex-1' />
        {props.estimate && (
          <span className='text-muted-foreground text-xs'>
            {t('Estimated cost')}{' '}
            <span className='text-foreground font-mono tabular-nums'>
              {props.estimate}
            </span>
          </span>
        )}
        <button
          type='button'
          aria-label={t('Generate')}
          title={t('Generate')}
          disabled={!props.canSubmit}
          onClick={props.onSubmit}
          className='from-primary focus-visible:ring-ring/50 flex size-9 items-center justify-center rounded-xl bg-linear-to-br to-violet-500 text-white outline-none focus-visible:ring-3 disabled:opacity-40'
        >
          {props.submitting ? (
            <LoaderCircle className='size-4 animate-spin' />
          ) : (
            <SendHorizontal className='size-4' />
          )}
        </button>
      </div>
    </div>
  )
}
