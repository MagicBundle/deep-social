import type { CapacitorConfig } from '@capacitor/cli'

// The iOS (and later Android) shell wraps the SAME dist/ the web deploy
// uses — `npm run build` emits base '/' output, which is exactly what the
// shell serves; the GitHub Pages workflow passes its /deep-social/ base
// separately. Keep it that way.
const config: CapacitorConfig = {
  // Bundle id — placeholder reverse-DNS; can be renamed any time BEFORE the
  // first App Store Connect upload (it becomes permanent there).
  appId: 'io.github.magicbundle.deepsocial',
  appName: 'Deep Social',
  webDir: 'dist',
}

export default config
