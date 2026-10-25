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
import { useTranslation } from 'react-i18next'

import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { Dialog } from '@/components/dialog'

import { buildChatCompletionPayload } from '../../lib'
import type { ParameterEnabled, PlaygroundConfig } from '../../types'

type CodeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
}

export function CodeDialog(props: CodeDialogProps) {
  const { t } = useTranslation()
  const payload = buildChatCompletionPayload(
    [
      {
        key: 'example',
        from: 'user',
        versions: [{ id: 'example', content: 'Hello' }],
      },
    ],
    props.config,
    props.parameterEnabled
  )
  const body = { ...payload, group: undefined }
  const code = [
    `curl ${window.location.origin}/v1/chat/completions \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Authorization: Bearer $NEW_API_KEY" \\`,
    `  -d '${JSON.stringify(body, null, 2)}'`,
  ].join('\n')

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('View code')}
      description={t(
        'Call the same model with your API key using these settings.'
      )}
    >
      <CodeBlock code={code} language='bash' defaultCollapsed={false}>
        <CodeBlockCopyButton />
      </CodeBlock>
    </Dialog>
  )
}
