import { Capacitor } from '@capacitor/core'
import { getSupabase, isBackendConfigured } from './supabase'

export type NotifyKind = 'dm' | 'friend_request' | 'friend_accepted'

/** Fire-and-forget push to another user via the `push` Edge Function. Works
 *  from web and native (a web sender can still push a mobile recipient).
 *  No-ops silently if the backend or the function isn't available. */
export function notify(to: string, kind: NotifyKind, preview?: string): void {
  if (!isBackendConfigured() || !to) return
  try {
    void getSupabase()
      .functions.invoke('push', { body: { to, kind, preview } })
      .catch(() => {})
  } catch {
    /* ignore */
  }
}

// Native push registration (receive side). No-ops on the web and degrades
// gracefully in the simulator (no APNs token issues there). The send side is
// a Supabase Edge Function added once the APNs auth key is configured.

export interface PushTap {
  type?: string // 'dm' | 'friend' | 'guardian' | ...
  friendId?: string
  [k: string]: unknown
}

let registeredToken: string | null = null

export async function registerPush(onTap: (data: PushTap) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return

    await PushNotifications.removeAllListeners()

    await PushNotifications.addListener('registration', (t) => {
      registeredToken = t.value
      getSupabase()
        .rpc('register_push_token', { p_token: t.value, p_platform: 'ios' })
        .then(({ error }) => {
          if (error) console.warn('[push] token save failed:', error.message)
        })
    })

    await PushNotifications.addListener('registrationError', (e) => {
      console.warn('[push] registration error:', JSON.stringify(e))
    })

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      onTap((action.notification.data ?? {}) as PushTap)
    })

    await PushNotifications.register()
  } catch (e) {
    console.warn('[push] init failed:', e)
  }
}

/** Best-effort cleanup on sign-out so a shared device stops receiving the
 *  previous user's notifications. */
export async function unregisterPush(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !registeredToken) return
  try {
    await getSupabase().rpc('unregister_push_token', { p_token: registeredToken })
  } catch {
    /* ignore */
  }
  registeredToken = null
}
