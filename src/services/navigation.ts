import { Capacitor } from '@capacitor/core'

// Walking directions via the platform's own maps — we deliberately link out
// rather than render routes (no Directions API, no key, no tracking).
// Universal https links open the native app when installed and degrade to
// the browser; inside the iOS shell the maps:// scheme hands straight off
// to Apple Maps (Capacitor opens non-http schemes externally).

const isApplePlatform = () => /iPhone|iPad|Macintosh/.test(navigator.userAgent)

export function directionsUrl(lat: number, lng: number): string {
  const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`
  if (Capacitor.getPlatform() === 'ios') return `maps://?daddr=${coords}&dirflg=w`
  if (isApplePlatform()) return `https://maps.apple.com/?daddr=${coords}&dirflg=w`
  return `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=walking`
}

/** Platform-neutral link for sharing a destination with someone else
 *  (e.g. the guardian DM) — their platform is unknown, Google web works
 *  everywhere. */
export function neutralMapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
}

export function openDirections(lat: number, lng: number): void {
  const url = directionsUrl(lat, lng)
  if (url.startsWith('maps://')) {
    window.location.href = url // external-scheme handoff; webview stays put
  } else {
    window.open(url, '_blank', 'noopener')
  }
}
