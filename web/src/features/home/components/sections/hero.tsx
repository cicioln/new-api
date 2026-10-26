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
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'

import { useHomeFlow, type HomeFlowData } from '../../hooks/use-home-flow'
import { getGroupHealth, type GroupHealth } from './health'

type Node = { x: number; y: number; hit: number }
type SourceNode = Node & { label: string; hint: string }
type GroupNode = Node & { index: number }
type Packet = {
  s: SourceNode
  d: GroupNode
  leg: number
  t: number
  v: number
}

type FlowText = {
  systemName: string
  gateway: string
  loading: string
  error: string
  empty: string
  noData: string
  models: (count: number) => string
  tipGo: string
}

const SOURCE_HINTS = [
  'Cherry Studio · LobeChat',
  'Cursor · Claude Code',
  'OpenAI SDK · Dify · n8n',
]

const HEALTH_COLOR: Record<GroupHealth, string> = {
  ok: '--success',
  degraded: '--warning',
  failing: '--destructive',
  idle: '--subtle-foreground',
}

/**
 * Request flow canvas: clients send packets to the gateway, which routes them
 * to each group and back. Groups come from `/api/home/groups`.
 */
export function Hero() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const flow = useHomeFlow()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const text: FlowText = {
    systemName: systemName || 'New API',
    gateway: t('Unified AI Gateway'),
    loading: t('Loading groups…'),
    error: t('Failed to load groups'),
    empty: t('No groups available'),
    noData: t('No traffic in the last hour'),
    models: (count) => t('{{count}} models', { count }),
    tipGo: t('Click to view this group →'),
  }
  const sources = [t('Chat clients'), t('IDE plugins'), t('SDK calls')]
  const flowRef = useRef<HomeFlowData>(flow)
  const textRef = useRef(text)
  const sourcesRef = useRef(sources)
  const refreshRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    flowRef.current = flow
    textRef.current = text
    sourcesRef.current = sources
  })

  useEffect(() => {
    refreshRef.current()
  }, [flow.groups, flow.status, flow.noPerf, systemName, t])

  useEffect(() => {
    const el = canvasRef.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const cv: HTMLCanvasElement = el
    const g = ctx
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0
    let H = 0
    let hub = { x: 0, y: 0 }
    let src: SourceNode[] = []
    let dst: GroupNode[] = []
    let pk: Packet[] = []
    let pulse = 0
    let acc = 0
    let prev = 0
    let dash = 0
    let gd = 64
    let br = 0
    let hov: number | null = null
    let raf = 0

    const cssv = (name: string) =>
      getComputedStyle(cv).getPropertyValue(name).trim()
    const live = () => {
      const s = flowRef.current.status
      return s === 'ready' && flowRef.current.groups.length > 0
    }
    const health = (i: number) => {
      const f = flowRef.current
      return f.noPerf ? 'idle' : getGroupHealth(f.groups[i].successRate)
    }

    function layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = cv.clientWidth
      H = cv.clientHeight
      cv.width = W * dpr
      cv.height = H * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Clients hug the left, groups the right, gateway in the middle, all
      // inside the shared 1600px content width (px-4 / md:px-7 gutters).
      const sm = W < 640
      const gutter = W < 768 ? 16 : 28
      const bl = Math.max(gutter, (W - 1600) / 2 + gutter)
      br = W - bl
      let sx = bl + 150
      let dx = Math.max(sx + 300, br - 270)
      if (sm) {
        sx = bl + 6
        dx = br - 132
      }
      hub = { x: (sx + dx) / 2, y: H / 2 }
      const gs = Math.min(H * 0.2, 120)
      const groups = flowRef.current.groups
      gd = Math.min((H - 80) / Math.max(groups.length - 1, 1), 64)
      if (!live()) pk = []
      const names = sourcesRef.current
      src = names.map((label, i) => ({
        x: sx,
        y: H / 2 + (i - (names.length - 1) / 2) * gs,
        label,
        hint: SOURCE_HINTS[i],
        hit: src[i]?.hit ?? 0,
      }))
      dst = (live() ? groups : []).map((_, i) => ({
        x: dx,
        y: H / 2 + (i - (groups.length - 1) / 2) * gd,
        index: i,
        hit: 0,
      }))
      pk = pk.filter((p) => dst.includes(p.d))
    }

    function hitDst(x: number, y: number) {
      for (const d of dst) {
        if (x > d.x - 24 && Math.abs(y - d.y) < gd / 2) return d.index
      }
      return null
    }
    function pos(e: MouseEvent) {
      const r = cv.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    function pt(a: Node | typeof hub, b: Node | typeof hub, t: number) {
      const mx = (a.x + b.x) / 2
      const u = 1 - t
      return {
        x:
          u * u * u * a.x +
          3 * u * u * t * mx +
          3 * u * t * t * mx +
          t * t * t * b.x,
        y:
          u * u * u * a.y +
          3 * u * u * t * a.y +
          3 * u * t * t * b.y +
          t * t * t * b.y,
      }
    }
    function curve(a: Node | typeof hub, b: Node | typeof hub) {
      const mx = (a.x + b.x) / 2
      g.beginPath()
      g.moveTo(a.x, a.y)
      g.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y)
      g.stroke()
    }
    function rr(x: number, y: number, w: number, h: number, r: number) {
      g.beginPath()
      g.roundRect(x, y, w, h, r)
    }
    function spawn() {
      if (!live() || !dst.length) return
      pk.push({
        s: src[(Math.random() * src.length) | 0],
        d: dst[(Math.random() * dst.length) | 0],
        leg: 0,
        t: 0,
        v: 0.9 + Math.random() * 0.6,
      })
    }
    // leg 0 client→gateway, 1 gateway→group, 2 group→gateway, 3 gateway→client
    function ends(p: Packet) {
      const legs = [
        [p.s, hub],
        [hub, p.d],
        [p.d, hub],
        [hub, p.s],
      ] as const
      return legs[p.leg]
    }
    function step(dt: number) {
      acc += dt
      while (acc > 0.18) {
        acc -= 0.18
        spawn()
      }
      pk = pk.filter((p) => {
        p.t += dt * p.v * (p.leg === 1 || p.leg === 2 ? 1.1 : 1.3)
        if (p.t < 1) return true
        p.t = 0
        p.leg++
        if (p.leg === 1 || p.leg === 3) pulse = 1
        if (p.leg === 2) p.d.hit = 1
        if (p.leg === 4) {
          p.s.hit = 1
          return false
        }
        return true
      })
      pulse = Math.max(0, pulse - dt * 2.5)
      dash += dt * 24
      for (const n of [...src, ...dst]) n.hit = Math.max(0, n.hit - dt * 3)
    }

    function draw() {
      const tx = textRef.current
      const f = flowRef.current
      const ink = cssv('--foreground')
      const bg = cssv('--background')
      const line = cssv('--input')
      const mute = cssv('--subtle-foreground')
      const ac = cssv('--primary')
      const ft = getComputedStyle(cv).fontFamily
      const mo = cssv('--font-mono')
      const sm = W < 640
      const dim = (i: number) => (hov !== null && i !== hov ? 0.18 : 1)
      g.clearRect(0, 0, W, H)
      g.lineWidth = 1
      g.strokeStyle = line
      for (const s of src) curve(s, hub)
      if (f.status === 'loading') {
        g.fillStyle = cssv('--muted')
        for (let k = 0; k < 5; k++) {
          const yy = hub.y + (k - 2) * 56
          rr(
            sm ? br - 132 : Math.max(hub.x + 150, br - 270),
            yy - 10,
            sm ? 120 : 220,
            20,
            6
          )
          g.fill()
        }
      }
      for (const d of dst) {
        const st = health(d.index)
        g.globalAlpha = dim(d.index)
        // Failing groups: moving dashed line in the status color
        if (st === 'failing') {
          g.setLineDash([5, 5])
          g.lineDashOffset = -dash
          g.strokeStyle = cssv(HEALTH_COLOR.failing)
        } else g.strokeStyle = hov === d.index ? ac : line
        g.lineWidth = hov === d.index ? 1.6 : 1
        curve(hub, d)
        g.setLineDash([])
      }
      g.globalAlpha = 1
      // Packets: accent on the way out, group status color on the way back
      g.lineCap = 'round'
      g.lineWidth = 2
      for (const p of pk) {
        const [a0, b0] = ends(p)
        const a = pt(a0, b0, Math.max(0, p.t - 0.05))
        const q = pt(a0, b0, p.t)
        g.globalAlpha = dim(p.d.index)
        g.strokeStyle = p.leg < 2 ? ac : cssv(HEALTH_COLOR[health(p.d.index)])
        g.beginPath()
        g.moveTo(a.x, a.y)
        g.lineTo(q.x, q.y)
        g.stroke()
      }
      g.globalAlpha = 1
      g.lineCap = 'butt'
      g.textBaseline = 'middle'
      for (const s of src) {
        g.fillStyle = bg
        g.strokeStyle = s.hit ? ac : line
        g.lineWidth = 1.5
        g.beginPath()
        g.arc(s.x, s.y, 6 + s.hit * 2, 0, 7)
        g.fill()
        g.stroke()
        g.textAlign = sm ? 'left' : 'right'
        g.fillStyle = ink
        g.font = `600 13px ${ft}`
        g.fillText(s.label, sm ? s.x - 6 : s.x - 16, s.y - (sm ? 20 : 8))
        if (!sm) {
          g.fillStyle = mute
          g.font = `11px ${ft}`
          g.fillText(s.hint, s.x - 16, s.y + 10)
        }
      }
      g.textAlign = 'left'
      for (const d of dst) {
        const o = f.groups[d.index]
        const st = health(d.index)
        const c = cssv(HEALTH_COLOR[st])
        const x0 = d.x + 16
        const mw = br - x0
        const da = dim(d.index)
        const glow =
          st === 'failing'
            ? 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(dash / 4))
            : 0.25 + d.hit * 0.35
        g.globalAlpha = glow * da
        g.fillStyle = c
        g.beginPath()
        g.arc(d.x, d.y, 9 + d.hit * 3, 0, 7)
        g.fill()
        g.globalAlpha = da
        g.beginPath()
        g.arc(d.x, d.y, 5, 0, 7)
        g.fill()
        const nm = o.desc || o.group
        const ty = sm ? d.y : d.y - 16
        g.fillStyle = ink
        g.font = `600 13px ${ft}`
        g.fillText(nm, x0, ty)
        const nw = g.measureText(nm).width
        g.fillStyle = o.ratio < 1 ? ac : mute
        g.font = `11px ${mo}`
        g.fillText(`×${o.ratio.toFixed(1)}`, x0 + nw + 6, ty)
        if (sm) continue
        // Model list: show as many as fit, fold the rest into +N
        const total = Math.max(o.modelTotal, o.models.length)
        let ml = ''
        for (
          let k = Math.min(o.models.length, d.index === 0 ? 2 : 3);
          k >= 0;
          k--
        ) {
          const more = total > k ? ` +${total - k}` : ''
          ml = o.models.slice(0, k).join(' · ') + more
          if (g.measureText(ml).width <= mw) break
        }
        g.fillStyle = d.hit ? ink : cssv('--muted-foreground')
        g.fillText(ml.trim(), x0, d.y + 1)
        g.font = `10.5px ${mo}`
        if (o.successRate === null || f.noPerf) {
          g.fillStyle = mute
          g.fillText(tx.noData, x0, d.y + 16)
          continue
        }
        const u = `1h ${o.successRate.toFixed(1)}%`
        g.fillStyle = st === 'ok' ? mute : c
        g.fillText(u, x0, d.y + 16)
        const rest = [
          '',
          o.avgLatencyMs === null
            ? null
            : `${(o.avgLatencyMs / 1000).toFixed(2)}s`,
          o.avgTps === null ? null : `${o.avgTps.toFixed(1)} t/s`,
        ]
          .filter((v) => v !== null)
          .join(' · ')
        g.fillStyle = mute
        g.fillText(rest, x0 + g.measureText(u).width, d.y + 16)
      }
      g.globalAlpha = 1
      g.textAlign = 'center'
      if (pulse) {
        g.strokeStyle = ac
        g.lineWidth = 2
        g.globalAlpha = pulse * 0.6
        const r = 46 + (1 - pulse) * 40
        rr(hub.x - r, hub.y - r, r * 2, r * 2, 20 + (1 - pulse) * 10)
        g.stroke()
        g.globalAlpha = 1
      }
      g.fillStyle = ink
      rr(hub.x - 36, hub.y - 36, 72, 72, 18)
      g.fill()
      g.fillStyle = bg
      g.font = `500 30px ${mo}`
      g.fillText('N', hub.x, hub.y + 2)
      g.fillStyle = ac
      g.strokeStyle = bg
      g.lineWidth = 4
      rr(hub.x + 22, hub.y + 22, 22, 22, 7)
      g.stroke()
      g.fill()
      g.fillStyle = ink
      g.font = `600 14px ${ft}`
      g.fillText(tx.systemName, hub.x, hub.y + 62)
      g.fillStyle = mute
      g.font = `12px ${ft}`
      g.fillText(tx.gateway, hub.x, hub.y + 81)
      if (!live()) {
        const msg = { loading: tx.loading, error: tx.error }[
          f.status as 'loading' | 'error'
        ]
        g.fillStyle = f.status === 'error' ? cssv('--destructive') : mute
        g.font = `13px ${ft}`
        g.fillText(msg ?? tx.empty, hub.x, hub.y + 112)
      }
      if (hov !== null) {
        const d = dst.find((n) => n.index === hov)
        if (d) tip(d, ink, mute, ac, ft, mo)
      }
    }

    // Hover card: the group's model list, placed left of the node
    function tip(
      d: GroupNode,
      ink: string,
      mute: string,
      ac: string,
      ft: string,
      mo: string
    ) {
      const tx = textRef.current
      const o = flowRef.current.groups[d.index]
      const ns = o.models
      const lh = 20
      const pad = 14
      g.font = `12px ${mo}`
      let w = 0
      for (const n of ns) w = Math.max(w, g.measureText(n).width)
      w = Math.max(w + 24, 168) + pad * 2
      const h = pad * 2 + 22 + ns.length * lh + 24
      let x = d.x - 28 - w
      if (x < 8) x = Math.min(d.x + 16, W - w - 8)
      const y = Math.max(8, Math.min(d.y - h / 2, H - h - 8))
      g.save()
      g.shadowColor = 'rgba(0,0,0,.18)'
      g.shadowBlur = 24
      g.shadowOffsetY = 8
      g.fillStyle = cssv('--card')
      rr(x, y, w, h, 10)
      g.fill()
      g.restore()
      g.strokeStyle = cssv('--border')
      g.lineWidth = 1
      rr(x + 0.5, y + 0.5, w - 1, h - 1, 10)
      g.stroke()
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillStyle = ink
      g.font = `600 13px ${ft}`
      g.fillText(
        `${o.desc || o.group} · ${tx.models(o.modelTotal)}`,
        x + pad,
        y + pad + 8
      )
      g.font = `12px ${mo}`
      ns.forEach((n, i) => {
        const yy = y + pad + 22 + i * lh + lh / 2
        g.fillStyle = mute
        g.beginPath()
        g.arc(x + pad + 3, yy, 3, 0, 7)
        g.fill()
        g.fillStyle = ink
        g.fillText(n, x + pad + 14, yy)
      })
      g.fillStyle = ac
      g.font = `12px ${ft}`
      g.fillText(tx.tipGo, x + pad, y + h - pad - 4)
    }

    function frame(ts: number) {
      raf = requestAnimationFrame(frame)
      if (cv.clientWidth !== W || cv.clientHeight !== H) layout()
      const dt = prev ? Math.min((ts - prev) / 1000, 0.05) : 0
      prev = ts
      step(dt)
      draw()
    }

    const onMove = (e: MouseEvent) => {
      const [x, y] = pos(e)
      const h = hitDst(x, y)
      if (h !== hov) {
        hov = h
        cv.style.cursor = h === null ? '' : 'pointer'
        if (still) draw()
      }
    }
    const onLeave = () => {
      hov = null
      cv.style.cursor = ''
      if (still) draw()
    }
    const onClick = (e: MouseEvent) => {
      const [x, y] = pos(e)
      const h = hitDst(x, y)
      if (h !== null && live()) {
        const group = flowRef.current.groups[h].group
        void navigate({ to: '/pricing', search: { group } })
      }
    }
    cv.addEventListener('mousemove', onMove)
    cv.addEventListener('mouseleave', onLeave)
    cv.addEventListener('click', onClick)

    refreshRef.current = () => {
      layout()
      if (still) draw()
    }
    const onResize = () => {
      layout()
      draw()
    }
    if (still) {
      layout()
      for (let i = 0; i < 400; i++) step(0.02)
      draw()
      window.addEventListener('resize', onResize)
    } else raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      cv.removeEventListener('mousemove', onMove)
      cv.removeEventListener('mouseleave', onLeave)
      cv.removeEventListener('click', onClick)
      refreshRef.current = () => undefined
    }
  }, [navigate])

  return (
    <div className='relative h-[calc(100vh-61px)] min-h-[480px] overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] before:[mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_75%)] before:bg-[size:56px_56px] before:opacity-60 max-[1100px]:h-[620px] max-[1100px]:min-h-0 max-[640px]:h-[520px]'>
      <canvas
        ref={canvasRef}
        className='absolute inset-0 block size-full'
        aria-label={t(
          'Client requests are routed by the gateway to each group; hover a group to see its models and click to open the model square'
        )}
      />
    </div>
  )
}
