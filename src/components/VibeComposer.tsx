import { useRef, useState } from 'react'
import { processImage } from '../services/media'

interface Props {
  eventTitle: string
  onPost: (image: Blob) => Promise<void>
  onClose: () => void
}

type Stage = 'pick' | 'ready' | 'posting'

export default function VibeComposer({ eventTitle, onPost, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('pick')
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const processed = await processImage(file)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setBlob(processed)
      setPreviewUrl(URL.createObjectURL(processed))
      setStage('ready')
    } catch (e) {
      setError((e as Error).message)
      setStage('pick')
    }
  }

  const post = async () => {
    if (!blob) return
    setStage('posting')
    setError(null)
    try {
      await onPost(blob)
      // parent closes on success
    } catch (e) {
      setError((e as Error).message)
      setStage('ready')
    }
  }

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer vibe-composer" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>📸 Check the vibe</h3>
        <p className="composer-sub">
          Add a photo from <strong>{eventTitle}</strong> so people can see what it's like right
          now. Photos are compressed and stripped of metadata before upload.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        {previewUrl ? (
          <div className="vibe-preview">
            <img src={previewUrl} alt="Vibe preview" />
            <small>
              {blob ? `${Math.max(1, Math.round(blob.size / 1024))} KB ready to post` : ''}
            </small>
          </div>
        ) : (
          <button className="vibe-drop" onClick={() => fileRef.current?.click()}>
            <span>📷</span>
            Choose a photo
          </button>
        )}

        {error && <p className="login-status error">{error}</p>}

        <div className="composer-actions">
          {previewUrl && stage !== 'posting' && (
            <button className="btn-chat" onClick={() => fileRef.current?.click()}>
              Pick another
            </button>
          )}
          <button className="btn-chat" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-join"
            disabled={stage !== 'ready'}
            onClick={() => void post()}
          >
            {stage === 'posting' ? 'Posting…' : 'Post vibe 📸'}
          </button>
        </div>
      </div>
    </div>
  )
}
