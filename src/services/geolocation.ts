import { Capacitor } from '@capacitor/core'

// Platform-abstracted geolocation: native uses @capacitor/geolocation
// (CoreLocation — cleaner permission UX and accuracy control inside the
// shell); web uses the browser API. Foreground only — background location
// ("Always") is deferred as an App Review risk not worth it for the beta.

export interface Coords {
  lat: number
  lng: number
}

export async function getCurrentPosition(): Promise<Coords | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      let perm = await Geolocation.checkPermissions()
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        perm = await Geolocation.requestPermissions()
      }
      if (perm.location !== 'granted') return null
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10_000 })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {
      return null
    }
  }
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8_000, maximumAge: 300_000 },
    )
  })
}

/** Follow position changes while the app is open. Returns an unsubscribe
 *  function. The caller applies its own significant-movement filter. */
export function watchPosition(onMove: (c: Coords) => void): () => void {
  if (Capacitor.isNativePlatform()) {
    let watchId: string | null = null
    let cancelled = false
    void import('@capacitor/geolocation').then(async ({ Geolocation }) => {
      if (cancelled) return
      watchId = await Geolocation.watchPosition({ enableHighAccuracy: false }, (pos) => {
        if (pos) onMove({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
    })
    return () => {
      cancelled = true
      if (watchId) {
        void import('@capacitor/geolocation').then(({ Geolocation }) =>
          Geolocation.clearWatch({ id: watchId! }),
        )
      }
    }
  }
  if (!('geolocation' in navigator)) return () => {}
  const id = navigator.geolocation.watchPosition(
    (p) => onMove({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => {},
    { enableHighAccuracy: false, maximumAge: 60_000 },
  )
  return () => navigator.geolocation.clearWatch(id)
}
