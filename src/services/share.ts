import type { SocialEvent } from '../types'
import { remotePinId } from '../sim/engine'

/** The app's public web home — share/QR links must encode this even inside
 *  the Capacitor shell (where location.origin is capacitor://). */
export const CANONICAL_ORIGIN = 'https://magicbundle.github.io/deep-social/'

/** Stable public URL for an event: real pins deep-link by their server id,
 *  demo-world events by their seed id (identical for every visitor). */
export function eventShareUrl(e: SocialEvent): string {
  const raw = remotePinId(e.id)
  return raw ? `${CANONICAL_ORIGIN}#/pin/${raw}` : `${CANONICAL_ORIGIN}#/event/${e.id}`
}

function shareText(e: SocialEvent): string {
  return `${e.title} — ${e.venue}. Join me on Deep Social:`
}

/** Native share sheet when available (iOS/Android/mobile web), WhatsApp
 *  composer as fallback. Returns how it was shared, for the toast. */
export async function shareEvent(e: SocialEvent): Promise<'shared' | 'whatsapp'> {
  const url = eventShareUrl(e)
  const text = shareText(e)
  if (navigator.share) {
    try {
      await navigator.share({ title: e.title, text, url })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err // user cancelled
      // fall through to WhatsApp on any other failure
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener')
  return 'whatsapp'
}
