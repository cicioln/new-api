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
import { SendIcon, SquareIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'
import { ConfirmDialog } from '@/components/confirm-dialog'

import { getSubmittableInputText } from '../../lib'

type CompareComposerProps = {
  canSend: boolean
  isGenerating: boolean
  hasMessages: boolean
  onSubmit: (text: string) => void
  onStop: () => void
  onClear: () => void
}

export function CompareComposer(props: CompareComposerProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [clearOpen, setClearOpen] = useState(false)

  return (
    <>
      <PromptInput
        groupClassName='bg-card rounded-[10px]'
        onSubmit={(message) => {
          const submittable = getSubmittableInputText(
            message,
            props.isGenerating || !props.canSend
          )
          if (!submittable) return
          props.onSubmit(submittable)
          setText('')
        }}
      >
        <PromptInputTextarea
          className='min-h-16 px-4 pt-3 text-[13.5px]'
          disabled={props.isGenerating}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask anything')}
          value={text}
        />
        <PromptInputFooter className='px-3 pb-2.5'>
          <PromptInputButton
            aria-label={t('Clear chat history')}
            className='text-muted-foreground hover:text-destructive'
            disabled={props.isGenerating || !props.hasMessages}
            onClick={() => setClearOpen(true)}
          >
            <Trash2Icon size={16} />
          </PromptInputButton>
          {props.isGenerating ? (
            <PromptInputButton
              className='text-destructive'
              onClick={props.onStop}
              variant='secondary'
            >
              <SquareIcon className='fill-current' size={14} />
              <span>{t('Stop')}</span>
            </PromptInputButton>
          ) : (
            <PromptInputButton
              disabled={!props.canSend || !text.trim()}
              type='submit'
              variant='default'
            >
              <SendIcon size={14} />
              <span>{t('Send')}</span>
            </PromptInputButton>
          )}
        </PromptInputFooter>
      </PromptInput>

      <ConfirmDialog
        destructive
        desc={t(
          'All playground messages saved in this browser will be removed. This cannot be undone.'
        )}
        confirmText={t('Clear')}
        handleConfirm={() => {
          props.onClear()
          setClearOpen(false)
          toast.success(t('Conversation cleared'))
        }}
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t('Clear chat history?')}
      />
    </>
  )
}
