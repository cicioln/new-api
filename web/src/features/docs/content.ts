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

// Documentation text. Long-form copy lives here as { en, zh } pairs rather
// than in the locale files; Chinese locales read zh, all others read en.

export type Localized = { en: string; zh: string }

export function pick(text: Localized, zh: boolean): string {
  return zh ? text.zh : text.en
}

export type CodeLang = 'bash' | 'python' | 'json' | 'javascript'

export type GuideBlock =
  | { kind: 'h'; text: Localized }
  | { kind: 'p'; text: Localized }
  | { kind: 'list'; items: Localized[] }
  | { kind: 'callout'; text: Localized }
  | { kind: 'code'; lang: CodeLang; code: (base: string) => string }
  | { kind: 'table'; head: Localized[]; rows: (string | Localized)[][] }

export type Guide = {
  id: string
  title: Localized
  intro: Localized
  blocks: GuideBlock[]
}

export const GUIDES: Guide[] = [
  {
    id: 'welcome',
    title: { en: 'Getting started', zh: '欢迎使用' },
    intro: {
      en: 'One API key reaches every model on this site through OpenAI-compatible endpoints. Pick a model in the catalog on the left to see its parameters and examples.',
      zh: '一个 API Key 即可通过 OpenAI 兼容接口调用本站所有模型。在左侧模型目录里选一个模型，查看它的参数和调用示例。',
    },
    blocks: [
      { kind: 'h', text: { en: 'Steps', zh: '接入步骤' } },
      {
        kind: 'list',
        items: [
          { en: 'Sign up and top up your wallet.', zh: '注册账号并充值。' },
          {
            en: 'Create a token on the Tokens page in the console. You can limit it to certain models, groups and IPs.',
            zh: '在控制台「令牌」页面创建令牌，可以限制可用模型、分组和 IP。',
          },
          {
            en: 'Point your client at the base URL below and send the token as a Bearer header.',
            zh: '把客户端的 Base URL 改为下面的地址，并用 Bearer 头带上令牌。',
          },
          {
            en: 'Use the model name exactly as listed in the catalog.',
            zh: '请求里的 model 填目录中列出的模型名，大小写一致。',
          },
        ],
      },
      { kind: 'h', text: { en: 'Base URL', zh: 'Base URL' } },
      { kind: 'code', lang: 'bash', code: (base) => `${base}/v1` },
      { kind: 'h', text: { en: 'First request', zh: '第一个请求' } },
      {
        kind: 'code',
        lang: 'bash',
        code: (base) =>
          [
            `curl ${base}/v1/chat/completions \\`,
            `  -H "Authorization: Bearer $NEW_API_KEY" \\`,
            `  -H "Content-Type: application/json" \\`,
            `  -d '{"model": "muse", "messages": [{"role": "user", "content": "Hello"}]}'`,
          ].join('\n'),
      },
      {
        kind: 'callout',
        text: {
          en: 'Any OpenAI SDK works: set base_url to the address above and api_key to your token.',
          zh: '任何 OpenAI SDK 都可以直接使用：base_url 填上面的地址，api_key 填你的令牌。',
        },
      },
    ],
  },
  {
    id: 'endpoints',
    title: { en: 'Endpoints and authentication', zh: '调用入口' },
    intro: {
      en: 'Every request carries the token in the Authorization header. Which endpoint to call depends on the model type.',
      zh: '所有请求都在 Authorization 头里带令牌。调用哪个接口取决于模型类型。',
    },
    blocks: [
      { kind: 'h', text: { en: 'Authentication', zh: '身份验证' } },
      {
        kind: 'code',
        lang: 'bash',
        code: () => 'Authorization: Bearer <YOUR_API_KEY>',
      },
      { kind: 'h', text: { en: 'Endpoints', zh: '接口一览' } },
      {
        kind: 'table',
        head: [
          { en: 'Purpose', zh: '用途' },
          { en: 'Method and path', zh: '方法与路径' },
          { en: 'Mode', zh: '方式' },
        ],
        rows: [
          [
            { en: 'Chat', zh: '对话' },
            'POST /v1/chat/completions',
            { en: 'Sync or stream', zh: '同步或流式' },
          ],
          [
            { en: 'Generate images', zh: '生成图片' },
            'POST /v1/images/generations',
            { en: 'Sync', zh: '同步' },
          ],
          [
            { en: 'Edit images', zh: '改图' },
            'POST /v1/images/edits',
            { en: 'Sync, multipart', zh: '同步，multipart' },
          ],
          [
            { en: 'Submit a video', zh: '提交视频' },
            'POST /v1/videos',
            { en: 'Async task', zh: '异步任务' },
          ],
          [
            { en: 'Query a video', zh: '查询视频' },
            'GET /v1/videos/{id}',
            { en: 'Polling', zh: '轮询' },
          ],
          [
            { en: 'Download a video', zh: '下载视频' },
            'GET /v1/videos/{id}/content',
            { en: 'Binary', zh: '二进制' },
          ],
          [
            { en: 'List models', zh: '模型列表' },
            'GET /v1/models',
            { en: 'Sync', zh: '同步' },
          ],
        ],
      },
      {
        kind: 'callout',
        text: {
          en: 'Each model page lists the endpoint it accepts. Calling a model on the wrong endpoint fails.',
          zh: '每个模型页面都写明了它接受的接口。用错接口会直接报错。',
        },
      },
    ],
  },
  {
    id: 'tasks',
    title: { en: 'Async tasks and polling', zh: '任务与轮询' },
    intro: {
      en: 'Video generation takes minutes, so it runs as a task: submit, poll, then download.',
      zh: '视频生成需要几分钟，因此以任务方式运行：先提交，再轮询，最后下载。',
    },
    blocks: [
      { kind: 'h', text: { en: 'Flow', zh: '流程' } },
      {
        kind: 'list',
        items: [
          {
            en: 'POST /v1/videos returns an id with status queued.',
            zh: 'POST /v1/videos 返回任务 id，状态为 queued。',
          },
          {
            en: 'Query GET /v1/videos/{id} every 5 to 10 seconds until status is completed or failed.',
            zh: '每 5 到 10 秒查询一次 GET /v1/videos/{id}，直到状态变为 completed 或 failed。',
          },
          {
            en: 'When completed, download the file from GET /v1/videos/{id}/content.',
            zh: '完成后从 GET /v1/videos/{id}/content 下载文件。',
          },
        ],
      },
      { kind: 'h', text: { en: 'Status values', zh: '状态取值' } },
      {
        kind: 'table',
        head: [
          { en: 'status', zh: 'status' },
          { en: 'Meaning', zh: '含义' },
        ],
        rows: [
          ['queued', { en: 'Waiting to start', zh: '排队中' }],
          [
            'in_progress',
            {
              en: 'Generating; progress is 0 to 100',
              zh: '生成中，progress 为 0 到 100',
            },
          ],
          [
            'completed',
            { en: 'Done; the file can be downloaded', zh: '已完成，可以下载' },
          ],
          [
            'failed',
            {
              en: 'Failed; see error.message',
              zh: '失败，原因见 error.message',
            },
          ],
        ],
      },
      { kind: 'h', text: { en: 'Example response', zh: '响应示例' } },
      {
        kind: 'code',
        lang: 'json',
        code: () =>
          JSON.stringify(
            {
              id: 'task_abc123',
              object: 'video',
              model: 'muse-video',
              status: 'in_progress',
              progress: 40,
              created_at: 1762400000,
            },
            null,
            2
          ),
      },
      {
        kind: 'callout',
        text: {
          en: 'Failed tasks are refunded. Finished videos may be deleted after the retention period set by the site, so download them soon.',
          zh: '失败的任务会退款。已完成的视频可能在站点设置的保留期后被删除，请尽快下载。',
        },
      },
    ],
  },
  {
    id: 'faq',
    title: { en: 'Tokens, groups and FAQ', zh: '令牌、分组与 FAQ' },
    intro: {
      en: 'Groups decide which channels serve a token and at what price ratio.',
      zh: '分组决定令牌走哪些线路，以及按什么倍率计费。',
    },
    blocks: [
      { kind: 'h', text: { en: 'Groups', zh: '分组' } },
      {
        kind: 'p',
        text: {
          en: 'A token belongs to one group. A model is available to the token only if the model is enabled for that group. The price shown in the catalog is multiplied by the group ratio.',
          zh: '每个令牌属于一个分组。只有模型在该分组中启用时，令牌才能调用它。目录中的价格会乘以分组倍率。',
        },
      },
      { kind: 'h', text: { en: 'Common errors', zh: '常见错误' } },
      {
        kind: 'table',
        head: [
          { en: 'HTTP status', zh: 'HTTP 状态码' },
          { en: 'Cause', zh: '原因' },
        ],
        rows: [
          ['401', { en: 'Missing or invalid token', zh: '令牌缺失或无效' }],
          [
            '403',
            {
              en: 'Token not allowed to use this model or group, or the balance is used up',
              zh: '令牌无权使用该模型或分组，或余额不足',
            },
          ],
          [
            '400',
            {
              en: 'Invalid parameters; the message names the field',
              zh: '参数错误，错误信息会指出字段',
            },
          ],
          [
            '429',
            {
              en: 'Rate limit reached; retry later',
              zh: '触发限流，请稍后重试',
            },
          ],
          [
            '5xx',
            {
              en: 'Upstream failure; retrying usually helps',
              zh: '上游失败，重试通常可以解决',
            },
          ],
        ],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Model documentation
// ---------------------------------------------------------------------------

export type ParamDoc = {
  name: string
  type: string
  required?: boolean
  values?: string
  desc: Localized
}

export type ExampleDoc = {
  title: Localized
  lang: CodeLang
  code: (base: string, model: string) => string
}

export type ModelDoc = {
  summary: Localized
  notes: Localized
  facts: { label: Localized; value: Localized }[]
  endpoints: { method: string; path: string; desc: Localized }[]
  params: ParamDoc[]
  rules: Localized[]
  callouts: Localized[]
  examples: ExampleDoc[]
}

const MUSE_CHAT: ModelDoc = {
  summary: {
    en: 'Text chat with optional images in the question. Streams like the OpenAI chat API.',
    zh: '文本对话，提问时可以附带图片。流式输出与 OpenAI 对话接口一致。',
  },
  notes: {
    en: 'Images are read only from the last user message, at most 4, 10 MB each. Images or videos the model makes during chat are not returned; use muse-image or muse-video for those. Sampling parameters such as temperature are ignored.',
    zh: '只读取最后一条用户消息里的图片，最多 4 张，每张不超过 10 MB。对话中模型生成的图片或视频不会返回，出图请用 muse-image，出视频请用 muse-video。temperature 等采样参数不生效。',
  },
  facts: [
    {
      label: { en: 'Input', zh: '输入' },
      value: { en: 'Text, images', zh: '文本、图片' },
    },
    { label: { en: 'Output', zh: '输出' }, value: { en: 'Text', zh: '文本' } },
    {
      label: { en: 'Streaming', zh: '流式' },
      value: { en: 'Supported', zh: '支持' },
    },
    {
      label: { en: 'Reference images', zh: '参考图' },
      value: { en: 'Up to 4', zh: '最多 4 张' },
    },
  ],
  endpoints: [
    {
      method: 'POST',
      path: '/v1/chat/completions',
      desc: { en: 'OpenAI chat completions', zh: 'OpenAI 对话接口' },
    },
  ],
  params: [
    {
      name: 'messages',
      type: 'array',
      required: true,
      desc: {
        en: 'The conversation. Earlier turns are sent as context. Content can be a string or an array of text and image_url parts.',
        zh: '对话内容。之前的轮次会作为上下文一起发送。content 可以是字符串，也可以是 text 与 image_url 组成的数组。',
      },
    },
    {
      name: 'stream',
      type: 'boolean',
      values: 'true / false',
      desc: {
        en: 'Stream the answer as server-sent events.',
        zh: '以 SSE 流式返回回答。',
      },
    },
    {
      name: 'image_url',
      type: 'object',
      values: '≤ 4',
      desc: {
        en: 'An image part: an HTTPS URL or a data URL. Only images in the last user message are used.',
        zh: '图片内容，填 HTTPS 地址或 data URL。只使用最后一条用户消息里的图片。',
      },
    },
  ],
  rules: [
    {
      en: 'At most 4 images per request, each up to 10 MB.',
      zh: '每次请求最多 4 张图片，每张不超过 10 MB。',
    },
    {
      en: 'Messages must contain some text.',
      zh: '消息中必须包含文字。',
    },
  ],
  callouts: [
    {
      en: 'Call this model only on POST /v1/chat/completions.',
      zh: '本模型只走 POST /v1/chat/completions。',
    },
  ],
  examples: [
    {
      title: { en: 'Text chat', zh: '文本对话' },
      lang: 'bash',
      code: (base, model) =>
        [
          `curl ${base}/v1/chat/completions \\`,
          `  -H "Authorization: Bearer $NEW_API_KEY" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{`,
          `    "model": "${model}",`,
          `    "stream": true,`,
          `    "messages": [{"role": "user", "content": "用三句话介绍杭州西湖"}]`,
          `  }'`,
        ].join('\n'),
    },
    {
      title: { en: 'Ask about an image', zh: '看图提问' },
      lang: 'python',
      code: (base, model) =>
        [
          'from openai import OpenAI',
          '',
          `client = OpenAI(base_url="${base}/v1", api_key="<YOUR_API_KEY>")`,
          '',
          'response = client.chat.completions.create(',
          `    model="${model}",`,
          '    messages=[{',
          '        "role": "user",',
          '        "content": [',
          '            {"type": "text", "text": "这张图里有什么？"},',
          '            {"type": "image_url", "image_url": {"url": "https://example.com/cat.png"}},',
          '        ],',
          '    }],',
          ')',
          'print(response.choices[0].message.content)',
        ].join('\n'),
    },
  ],
}

const MUSE_IMAGE: ModelDoc = {
  summary: {
    en: 'Text to image, or edit with up to 4 reference images. Images come back at the model’s native size.',
    zh: '文生图，或用最多 4 张参考图改图。图片按模型原生尺寸返回。',
  },
  notes: {
    en: 'Give size as an aspect ratio such as 16:9. A pixel size such as 1024x1024 is reduced to its ratio. 1:1 is about 1600×1600 and 16:9 about 2048×1152; images are not upscaled. Put reference image URLs in images; style and things to avoid go in style and negative_prompt.',
    zh: 'size 填画面比例，例如 16:9；填像素（如 1024x1024）会被换算成比例。1:1 约 1600×1600，16:9 约 2048×1152，不会再放大。参考图地址放 images，风格和不要出现的内容分别写在 style 和 negative_prompt。',
  },
  facts: [
    {
      label: { en: 'Output', zh: '输出' },
      value: { en: 'Image, native size', zh: '图片，原生尺寸' },
    },
    {
      label: { en: '1:1 size', zh: '1:1 尺寸' },
      value: { en: 'About 1600×1600', zh: '约 1600×1600' },
    },
    {
      label: { en: 'Reference images', zh: '参考图' },
      value: { en: 'Up to 4', zh: '最多 4 张' },
    },
    {
      label: { en: 'Billing', zh: '计费' },
      value: { en: 'Per returned image', zh: '按实际返回张数' },
    },
  ],
  endpoints: [
    {
      method: 'POST',
      path: '/v1/images/generations',
      desc: {
        en: 'Text to image, or reference images as URLs in images',
        zh: '文生图；参考图以地址放在 images 里',
      },
    },
    {
      method: 'POST',
      path: '/v1/images/edits',
      desc: {
        en: 'Reference images uploaded as files, multipart form',
        zh: '参考图以文件上传，multipart 表单',
      },
    },
  ],
  params: [
    {
      name: 'prompt',
      type: 'string',
      required: true,
      desc: {
        en: 'What to draw: subject, scene, light and composition. With reference images, say what to keep and what to change.',
        zh: '画面内容：写清主体、场景、光线和构图。带参考图时写明要保留什么、改什么。',
      },
    },
    {
      name: 'size',
      type: 'string',
      values: '1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3',
      desc: {
        en: 'Aspect ratio. A pixel size is reduced to its ratio. Leave it out to let the model decide.',
        zh: '画面比例。填像素会换算成比例。不传则由模型决定。',
      },
    },
    {
      name: 'n',
      type: 'integer',
      values: '≥ 1',
      desc: {
        en: 'Number of images, default 1. The model may return fewer; you pay only for the images returned.',
        zh: '张数，默认 1。模型返回的张数可能少于 n，只按实际返回的张数计费。',
      },
    },
    {
      name: 'aspect_ratio',
      type: 'string',
      values: '1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3',
      desc: {
        en: 'Same as size given as a ratio. Used when size is empty.',
        zh: '与 size 填比例等效，size 为空时生效。',
      },
    },
    {
      name: 'images',
      type: 'array',
      values: '≤ 4',
      desc: {
        en: 'Reference images as HTTPS URLs or data URLs. Works on /v1/images/generations.',
        zh: '参考图，HTTPS 地址或 data URL 组成的数组，可直接用于 /v1/images/generations。',
      },
    },
    {
      name: 'style',
      type: 'string',
      desc: {
        en: 'Free-text style, for example photorealistic, anime, cinematic, 3d. Leave it out to follow the prompt.',
        zh: '风格，自由文本，例如 photorealistic 写实、anime 动漫、cinematic 电影、3d。不传则只按提示词。',
      },
    },
    {
      name: 'negative_prompt',
      type: 'string',
      desc: {
        en: 'What should not appear, kept apart from prompt. For example blurry, watermark, extra fingers, text.',
        zh: '不要出现在画面里的内容，和 prompt 分开写。例如 blurry, watermark, extra fingers, text。',
      },
    },
    {
      name: 'response_format',
      type: 'string',
      values: 'b64_json / url',
      desc: {
        en: 'b64_json returns Base64 (default); url returns a link valid for 7 days.',
        zh: 'b64_json 返回 Base64（默认）；url 返回图片直链，有效期 7 天。',
      },
    },
    {
      name: 'image',
      type: 'file',
      values: '≤ 4',
      desc: {
        en: '/v1/images/edits only. Reference image files as multipart fields named image or image[].',
        zh: '仅 /v1/images/edits。参考图文件，multipart 字段名为 image 或 image[]。',
      },
    },
  ],
  rules: [
    {
      en: 'Reference images go in images (URLs) on /v1/images/generations, or as files on /v1/images/edits.',
      zh: '参考图可以用 images 传地址给 /v1/images/generations，也可以用文件传给 /v1/images/edits。',
    },
    {
      en: 'At most 4 reference images, each up to 10 MB.',
      zh: '参考图最多 4 张，每张不超过 10 MB。',
    },
  ],
  callouts: [
    {
      en: 'Image generation is synchronous: the request waits until the image is ready, usually under a minute.',
      zh: '生图为同步接口，请求会等到图片生成完成，通常在一分钟内。',
    },
  ],
  examples: [
    {
      title: { en: 'Text to image', zh: '文生图' },
      lang: 'bash',
      code: (base, model) =>
        [
          `curl ${base}/v1/images/generations \\`,
          `  -H "Authorization: Bearer $NEW_API_KEY" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{`,
          `    "model": "${model}",`,
          `    "prompt": "清晨的森林，阳光穿过薄雾，写实摄影",`,
          `    "size": "16:9",`,
          `    "style": "photorealistic",`,
          `    "negative_prompt": "watermark, text"`,
          `  }' | python -c "import sys, json, base64; open('out.png', 'wb').write(base64.b64decode(json.load(sys.stdin)['data'][0]['b64_json']))"`,
        ].join('\n'),
    },
    {
      title: { en: 'Reference image by URL', zh: '参考图（地址）' },
      lang: 'bash',
      code: (base, model) =>
        [
          `curl ${base}/v1/images/generations \\`,
          `  -H "Authorization: Bearer $NEW_API_KEY" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{`,
          `    "model": "${model}",`,
          `    "prompt": "把背景换成海边日落，人物保持不变",`,
          `    "images": ["https://example.com/photo.png"],`,
          `    "response_format": "url"`,
          `  }'`,
          '',
          '# {"data": [{"url": "https://.../muse/media/..."}], ...}',
        ].join('\n'),
    },
    {
      title: { en: 'Reference image as a file', zh: '参考图（文件上传）' },
      lang: 'bash',
      code: (base, model) =>
        [
          `curl ${base}/v1/images/edits \\`,
          `  -H "Authorization: Bearer $NEW_API_KEY" \\`,
          `  -F model=${model} \\`,
          `  -F prompt="把背景换成海边日落，人物保持不变" \\`,
          `  -F image=@photo.png`,
        ].join('\n'),
    },
    {
      title: { en: 'Python', zh: 'Python' },
      lang: 'python',
      code: (base, model) =>
        [
          'import base64',
          'from openai import OpenAI',
          '',
          `client = OpenAI(base_url="${base}/v1", api_key="<YOUR_API_KEY>")`,
          '',
          'result = client.images.generate(',
          `    model="${model}",`,
          '    prompt="A watercolor cat by the window",',
          '    size="1:1",',
          ')',
          'with open("cat.png", "wb") as f:',
          '    f.write(base64.b64decode(result.data[0].b64_json))',
        ].join('\n'),
    },
  ],
}

const MUSE_VIDEO: ModelDoc = {
  summary: {
    en: 'Short video from a prompt, 1 to 10 seconds. You can also give a first frame, a last frame, or up to 4 reference images.',
    zh: '单段短视频，1 到 10 秒。可以只写提示词，也可以带首帧、尾帧或最多 4 张参考图。',
  },
  notes: {
    en: 'Length goes in duration (number) or seconds (string), at most 10. Use first_image_url for the first frame and last_image_url for the last; the first frame can be sent alone. Reference images go in reference_image_urls, up to 4. Generation takes a few minutes; poll the task. Realistic violence, weapons or explosions may fail.',
    zh: '时长填 duration（数字）或 seconds（字符串），最多 10 秒。首帧用 first_image_url，尾帧用 last_image_url，可以只传首帧。参考图用 reference_image_urls，最多 4 张。生成需要几分钟，请轮询任务。写实暴力、枪械或爆炸可能生成失败。',
  },
  facts: [
    {
      label: { en: 'Length', zh: '成片时长' },
      value: { en: '1–10 s', zh: '1–10 秒' },
    },
    {
      label: { en: 'Reference images', zh: '参考素材' },
      value: { en: 'Up to 4 images', zh: '最多 4 张图片' },
    },
    {
      label: { en: 'Mode', zh: '调用方式' },
      value: { en: 'Async task', zh: '异步任务' },
    },
    {
      label: { en: 'Output', zh: '输出' },
      value: { en: 'MP4, native resolution', zh: 'MP4，原生清晰度' },
    },
  ],
  endpoints: [
    {
      method: 'POST',
      path: '/v1/videos',
      desc: { en: 'Submit a task', zh: '提交任务' },
    },
    {
      method: 'GET',
      path: '/v1/videos/{id}',
      desc: { en: 'Query status and progress', zh: '查询状态和进度' },
    },
    {
      method: 'GET',
      path: '/v1/videos/{id}/content',
      desc: { en: 'Download the MP4', zh: '下载 MP4' },
    },
  ],
  params: [
    {
      name: 'prompt',
      type: 'string',
      required: true,
      desc: {
        en: 'What happens in the video: subject, action and mood.',
        zh: '视频内容：写清主体、动作和氛围。',
      },
    },
    {
      name: 'aspect_ratio',
      type: 'string',
      values: '16:9 / 9:16 / 1:1 / 4:3 / 3:4',
      desc: {
        en: 'Frame shape. 16:9 is landscape, 9:16 portrait. size is also accepted, as a ratio or pixels.',
        zh: '成片画幅。16:9 是横屏，9:16 是竖屏。也可以用 size，填比例或像素均可。',
      },
    },
    {
      name: 'duration',
      type: 'integer',
      values: '1–10',
      desc: {
        en: 'Length in seconds, as a number. seconds as a string also works.',
        zh: '成片秒数，传数字。也可以用字符串形式的 seconds。',
      },
    },
    {
      name: 'camera_movement',
      type: 'string',
      desc: {
        en: 'Free-text camera move, for example pan_left, zoom_in, orbit, tracking_shot, static, or a sentence.',
        zh: '运镜，自由文本，例如 pan_left 向左摇、zoom_in 推进、orbit 环绕、tracking_shot 跟拍、static 固定机位，也可以直接写一句。',
      },
    },
    {
      name: 'style',
      type: 'string',
      desc: {
        en: 'Free-text style, for example cinematic, anime, cyberpunk, realistic.',
        zh: '画面风格，自由文本，例如 cinematic 电影、anime 动漫、cyberpunk 赛博朋克、realistic 写实。',
      },
    },
    {
      name: 'negative_prompt',
      type: 'string',
      desc: {
        en: 'Flaws or elements to avoid, kept apart from prompt. For example blurry, watermark, text.',
        zh: '不要出现的瑕疵或元素，和 prompt 分开写。例如 blurry, watermark, text。',
      },
    },
    {
      name: 'first_image_url',
      type: 'string',
      desc: {
        en: 'First frame image URL (HTTPS or data URL).',
        zh: '首帧图片地址（HTTPS 或 data URL）。',
      },
    },
    {
      name: 'last_image_url',
      type: 'string',
      desc: {
        en: 'Last frame image URL. Needs first_image_url.',
        zh: '尾帧图片地址。需要同时提供首帧。',
      },
    },
    {
      name: 'reference_image_urls',
      type: 'array',
      values: '≤ 4',
      desc: {
        en: 'Reference image URLs. images and input_reference are also accepted.',
        zh: '参考图地址数组。也兼容 images 和 input_reference。',
      },
    },
  ],
  rules: [
    {
      en: 'The first frame can be sent alone; a last frame needs a first frame.',
      zh: '可以只提供首帧；提供尾帧时必须同时提供首帧。',
    },
    {
      en: 'Frames and reference images together hold at most 4 images, each up to 10 MB.',
      zh: '首尾帧与参考图合计最多 4 张，每张不超过 10 MB。',
    },
    {
      en: 'More than 10 seconds is rejected with invalid_seconds.',
      zh: '超过 10 秒会被拒绝，错误码 invalid_seconds。',
    },
  ],
  callouts: [
    {
      en: 'Video only goes through POST /v1/videos, then poll GET /v1/videos/{id}.',
      zh: '视频只走 POST /v1/videos，再轮询 GET /v1/videos/{id}。',
    },
    {
      en: 'Failed tasks are refunded. Download finished videos soon; the site may delete them after its retention period.',
      zh: '失败的任务会退款。完成后请尽快下载，站点可能在保留期后删除视频。',
    },
  ],
  examples: [
    {
      title: { en: 'Minimal request', zh: '最小请求' },
      lang: 'json',
      code: (_base, model) =>
        JSON.stringify(
          { model, prompt: '温暖的午后，阳光洒在窗台上，猫在打盹。' },
          null,
          2
        ),
    },
    {
      title: { en: 'Submit', zh: '提交任务' },
      lang: 'bash',
      code: (base, model) =>
        [
          `curl ${base}/v1/videos \\`,
          `  -H "Authorization: Bearer $NEW_API_KEY" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{`,
          `    "model": "${model}",`,
          `    "prompt": "热气球从山谷的晨雾中缓缓升起",`,
          `    "duration": 8,`,
          `    "aspect_ratio": "16:9",`,
          `    "camera_movement": "zoom_in"`,
          `  }'`,
          '',
          '# {"id": "task_abc123", "object": "video", "status": "queued", ...}',
        ].join('\n'),
    },
    {
      title: { en: 'Poll and download', zh: '轮询与下载' },
      lang: 'bash',
      code: (base) =>
        [
          `curl ${base}/v1/videos/task_abc123 \\`,
          `  -H "Authorization: Bearer $NEW_API_KEY"`,
          '',
          '# When "status" is "completed":',
          `curl -o video.mp4 ${base}/v1/videos/task_abc123/content \\`,
          `  -H "Authorization: Bearer $NEW_API_KEY"`,
        ].join('\n'),
    },
    {
      title: { en: 'Image to video in Python', zh: 'Python 图生视频' },
      lang: 'python',
      code: (base, model) =>
        [
          'import os, time, requests',
          '',
          `url = "${base}/v1/videos"`,
          'headers = {"Authorization": f"Bearer {os.environ[\'NEW_API_KEY\']}"}',
          '',
          'video = requests.post(url, headers=headers, json={',
          `    "model": "${model}",`,
          '    "prompt": "让画面中的人物转身微笑",',
          '    "seconds": "5",',
          '    "images": ["https://example.com/portrait.png"],',
          '}).json()',
          '',
          'while video["status"] in ("queued", "in_progress"):',
          '    time.sleep(8)',
          '    video = requests.get(f"{url}/{video[\'id\']}", headers=headers).json()',
          '',
          'if video["status"] != "completed":',
          '    raise RuntimeError(video.get("error"))',
          '',
          'content = requests.get(f"{url}/{video[\'id\']}/content", headers=headers)',
          'open("video.mp4", "wb").write(content.content)',
        ].join('\n'),
    },
  ],
}

/** Hand-written docs for a model, or undefined to fall back to generic docs. */
export function curatedModelDoc(
  modelName: string,
  endpointTypes: string[]
): ModelDoc | undefined {
  if (!/muse/i.test(modelName)) return undefined
  if (endpointTypes.includes('openai-video')) return MUSE_VIDEO
  if (endpointTypes.includes('image-generation')) return MUSE_IMAGE
  if (endpointTypes.includes('openai')) return MUSE_CHAT
  return undefined
}
