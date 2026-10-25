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
import { XIcon } from 'lucide-react'
import { useEffect, useMemo, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { MESSAGE_ROLES, MESSAGE_STATUS } from '../../constants'
import { useChatHandler, usePlaygroundConversation } from '../../hooks'
import type { MessageStateUpdater } from '../../lib'
import type {
  Message,
  ModelOption,
  ParameterEnabled,
  PlaygroundConfig,
} from '../../types'
import { PlaygroundChat } from '../chat/playground-chat'

export type CompareCardController = {
  send: (text: string) => void
  stop: () => void
  clear: () => void
}

type CompareCardProps = {
  id: string
  model: string
  models: ModelOption[]
  onModelChange: (model: string) => void
  onRemove?: () => void
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  messages: Message[]
  updateMessages: (updater: MessageStateUpdater) => void
  controllers: RefObject<Map<string, CompareCardController>>
  onGeneratingChange: (id: string, generating: boolean) => void
}

const TAG_CLASS_NAME =
  'inline-flex h-[22px] shrink-0 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap'

export function CompareCard(props: CompareCardProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const config = useMemo(
    () => ({ ...props.config, model: props.model }),
    [props.config, props.model]
  )

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled: props.parameterEnabled,
    onMessageUpdate: props.updateMessages,
  })

  const {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  } = usePlaygroundConversation({
    messages: props.messages,
    updateMessages: props.updateMessages,
    sendChat,
  })

  const controllers = props.controllers
  const updateMessages = props.updateMessages
  useEffect(() => {
    const map = controllers.current
    map.set(props.id, {
      send: handleSendMessage,
      stop: stopGeneration,
      clear: () => {
        handleEditOpenChange(false)
        updateMessages([])
      },
    })
    return () => {
      map.delete(props.id)
    }
  }, [
    controllers,
    props.id,
    handleSendMessage,
    stopGeneration,
    handleEditOpenChange,
    updateMessages,
  ])

  const onGeneratingChange = props.onGeneratingChange
  useEffect(() => {
    onGeneratingChange(props.id, isGenerating)
  }, [onGeneratingChange, props.id, isGenerating])
  useEffect(
    () => () => onGeneratingChange(props.id, false),
    [onGeneratingChange, props.id]
  )

  const lastMessage = props.messages.at(-1)
  const lastReply =
    lastMessage?.from === MESSAGE_ROLES.ASSISTANT ? lastMessage : undefined

  let tag: { label: string; className: string } | null = null
  if (lastReply?.status === MESSAGE_STATUS.ERROR) {
    tag = {
      label: t('Failed'),
      className: 'bg-destructive/10 text-destructive',
    }
  } else if (lastReply?.status === MESSAGE_STATUS.COMPLETE) {
    const seconds = ((lastReply.durationMs ?? 0) / 1000).toFixed(1)
    tag = {
      label: t('Done · {{seconds}}s', { seconds }),
      className: 'bg-success/12 text-success',
    }
  } else if (lastReply) {
    tag = {
      label: t('Generating...'),
      className: 'bg-primary/12 text-primary',
    }
  }

  let caption = t('Send a prompt to compare model outputs.')
  if (lastReply?.usage) {
    caption = t('{{value}} tokens', {
      value: formatNumber(lastReply.usage.completion_tokens, locale),
    })
  } else if (lastReply) {
    caption = t('Responding...')
  }

  return (
    <section
      aria-label={props.model}
      className='bg-card flex min-w-0 flex-col rounded-[10px] border p-[18px]'
    >
      <div className='flex items-center justify-between gap-2'>
        <Select
          value={props.model}
          onValueChange={(value) => {
            if (value) props.onModelChange(value)
          }}
          disabled={isGenerating}
        >
          <SelectTrigger
            aria-label={t('Select model')}
            className='h-auto min-w-0 border-0 bg-transparent p-0 text-sm font-semibold shadow-none dark:bg-transparent'
          >
            <SelectValue placeholder={t('Select model')} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align='start'>
            <SelectGroup>
              {props.models.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className='flex shrink-0 items-center gap-1'>
          {tag && (
            <span className={cn(TAG_CLASS_NAME, tag.className)}>
              {tag.label}
            </span>
          )}
          {props.onRemove && (
            <Button
              aria-label={t('Remove comparison')}
              disabled={isGenerating}
              onClick={props.onRemove}
              size='icon-xs'
              variant='ghost'
            >
              <XIcon aria-hidden='true' />
            </Button>
          )}
        </div>
      </div>
      <p className='text-muted-foreground mt-0.5 text-[12.5px]'>{caption}</p>

      {props.messages.length > 0 && (
        <div className='mt-3.5 flex h-[min(26rem,55vh)] min-h-0 flex-col text-[13.5px]'>
          <PlaygroundChat
            contentClassName='py-1'
            messages={props.messages}
            onRegenerateMessage={handleRegenerateMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            isGenerating={isGenerating}
            editingKey={editingMessageKey}
            onCancelEdit={handleEditOpenChange}
            onSaveEdit={(newContent) => applyEdit(newContent, false)}
            onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
          />
        </div>
      )}
    </section>
  )
}
