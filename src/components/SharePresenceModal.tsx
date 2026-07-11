import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface Props {
  userId: string
  name: string
  onClose: () => void
}

import { CANONICAL_ORIGIN } from '../services/share'

/** In-person handshake: shows a QR that encodes an HTTPS deep link. The other
 *  person points their phone camera at it (no in-app scanner needed) — the OS
 *  opens the link and the app fires a connection request. */
export function buildConnectLink(userId: string): string {
  return `${CANONICAL_ORIGIN}#/connect/${userId}`
}

export default function SharePresenceModal({ userId, name, onClose }: Props) {
  const link = buildConnectLink(userId)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the QR still works */
    }
  }

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer share-modal" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>📡 Share your presence</h3>
        <p className="composer-sub">
          Have someone point their camera at this code to send you a connection request — no app
          install, no typing.
        </p>

        <div className="qr-frame">
          <QRCodeSVG
            value={link}
            size={208}
            level="M"
            bgColor="#ffffff"
            fgColor="#0b0d12"
            marginSize={2}
          />
        </div>

        <p className="qr-name">{name}</p>

        <button className="btn-chat qr-copy" onClick={copy}>
          {copied ? 'Link copied ✓' : 'Copy link instead'}
        </button>
      </div>
    </div>
  )
}
