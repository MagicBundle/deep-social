import type { SocialEvent } from '../types'
import { eventShareUrl } from './share'

// Client-side ICS generation — no backend, works for sim events and real
// pins alike. Times are derived from "starts in N minutes" at export time.

const pad = (n: number) => String(n).padStart(2, '0')

function icsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  )
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildIcs(e: SocialEvent): string {
  const start = new Date(Date.now() + e.startsInMin * 60_000)
  const end = new Date(start.getTime() + e.durationMin * 60_000)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Deep Social//Beta//EN',
    'BEGIN:VEVENT',
    `UID:${e.id}@deepsocial`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.venue)}`,
    `DESCRIPTION:${esc(`${e.description || ''}\n${eventShareUrl(e)}`.trim())}`,
    `GEO:${e.lat.toFixed(6)};${e.lng.toFixed(6)}`,
    `URL:${eventShareUrl(e)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(e: SocialEvent): void {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${e.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 40) || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
