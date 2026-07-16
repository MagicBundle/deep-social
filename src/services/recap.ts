import type { HistoryEvent } from '../types'
import { interestFor } from '../data/mock'
import { backdrop, buildFigures, monthLong } from './skyLayout'

// Shareable monthly recap: the user's latest constellation rendered as a
// 1080×1920 (Instagram-Story format) PNG. Pure SVG composed as a string,
// rasterized through an offscreen <canvas> — no dependencies, no network,
// nothing leaves the device until the user picks a share target.

const W = 1080
const H = 1920

export interface RecapStats {
  friends: number
  photos: number
}

/** The month the recap is about: the most recent one with meetups. */
export function recapMonth(
  months: [string, HistoryEvent[]][],
): [string, HistoryEvent[]] | null {
  if (!months.length) return null
  const sorted = [...months].sort((a, b) => a[0].localeCompare(b[0]))
  return sorted[sorted.length - 1]
}

function buildRecapSvg(month: [string, HistoryEvent[]], stats: RecapStats): string {
  const [key, events] = month
  const { figures } = buildFigures([[key, events]])
  const f = figures[0]

  // Center the figure's bounding box on the card's hero area and scale it
  // up (capped, so one-star months don't become a single giant blob).
  const xs = f.stars.map((s) => s.x)
  const ys = f.stars.map((s) => s.y)
  const bw = Math.max(Math.max(...xs) - Math.min(...xs), 60)
  const bh = Math.max(Math.max(...ys) - Math.min(...ys), 60)
  const cx0 = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy0 = (Math.max(...ys) + Math.min(...ys)) / 2
  const scale = Math.min(660 / bw, 560 / bh, 4.5)
  const tx = (x: number) => 540 + (x - cx0) * scale
  const ty = (y: number) => 880 + (y - cy0) * scale

  const dust = backdrop(H, 130, W)
    .map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${(d.r * 1.6).toFixed(2)}" fill="#fff" opacity="${d.o.toFixed(2)}"/>`)
    .join('')

  const line =
    f.stars.length > 1
      ? `<polyline points="${f.stars.map((s) => `${tx(s.x).toFixed(1)},${ty(s.y).toFixed(1)}`).join(' ')}" fill="none" stroke="${f.color}" stroke-opacity="0.4" stroke-width="3.5"/>`
      : ''

  const stars = f.stars
    .map((s) => {
      const c = interestFor(s.ev.category).color
      const x = tx(s.x).toFixed(1)
      const y = ty(s.y).toFixed(1)
      const r = Math.min(Math.max(s.r * scale * 0.85, 9), 22)
      return (
        `<circle cx="${x}" cy="${y}" r="${(r * 2.6).toFixed(1)}" fill="${c}" opacity="0.16"/>` +
        `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${c}"/>` +
        `<circle cx="${x}" cy="${y}" r="${(r * 0.45).toFixed(1)}" fill="#fff" opacity="0.9"/>`
      )
    })
    .join('')

  const font = `-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif`
  const n = events.length
  const statsLine = `${n} meetup${n === 1 ? '' : 's'} · ${stats.friends} friend${stats.friends === 1 ? '' : 's'} · ${stats.photos} vibe photo${stats.photos === 1 ? '' : 's'}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="120%">
      <stop offset="0%" stop-color="#151b30"/>
      <stop offset="55%" stop-color="#0a0d17"/>
      <stop offset="100%" stop-color="#06080f"/>
    </radialGradient>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${dust}
  <rect x="492" y="150" width="96" height="96" rx="26" fill="url(#brand)"/>
  <text x="540" y="219" text-anchor="middle" font-family="${font}" font-size="56" fill="#fff">◍</text>
  <text x="540" y="330" text-anchor="middle" font-family="${font}" font-size="58" font-weight="800">
    <tspan fill="#ffffff">Deep</tspan><tspan fill="#67e8f9">Social</tspan>
  </text>
  <text x="540" y="408" text-anchor="middle" font-family="${font}" font-size="30" letter-spacing="7" fill="#8b93a7">${monthLong(key).toUpperCase()}</text>
  ${line}
  ${stars}
  <text x="540" y="1300" text-anchor="middle" font-family="${font}" font-size="70" font-weight="800" fill="${f.color}">${f.name}</text>
  <text x="540" y="1452" text-anchor="middle" font-family="${font}" font-size="38" fill="#cdd3e0">${statsLine}</text>
  <text x="540" y="1790" text-anchor="middle" font-family="${font}" font-size="28" fill="#8b93a7">your city's social layer, live</text>
</svg>`
}

/** Render the recap card to a PNG blob (1080×1920). */
export async function renderRecapPng(
  month: [string, HistoryEvent[]],
  stats: RecapStats,
): Promise<Blob> {
  const svg = buildRecapSvg(month, stats)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('svg decode failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    canvas.getContext('2d')!.drawImage(img, 0, 0, W, H)
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('png encode failed'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Hand the PNG to the OS share sheet when possible; download otherwise.
 *  Returns how it was delivered so the caller can word the toast. */
export async function shareRecapImage(blob: Blob): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], 'deep-social-recap.png', { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch {
      // user dismissed the sheet — treat as done, no fallback download
      return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'deep-social-recap.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
