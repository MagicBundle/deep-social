// Client-side image processing for Vibe Checks. Everything runs through a
// canvas re-encode before upload, which in one pass:
//   - downscales to MAX_DIM (egress cost control),
//   - re-encodes to JPEG (format normalization — no HEIC surprises),
//   - strips ALL metadata including EXIF GPS (privacy: photos taken at home
//     must not leak home coordinates onto a public pin).

const MAX_DIM = 1200
const JPEG_QUALITY = 0.82
const MAX_INPUT_BYTES = 15 * 1024 * 1024
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024 // matches the storage bucket cap

export async function processImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image is too large (max 15 MB before processing)')
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image'))
      el.src = url
    })

    // Browsers apply EXIF orientation when drawing, so the re-encode is
    // upright without carrying the original metadata.
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable in this browser')
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Image encoding failed'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
    if (blob.size > MAX_OUTPUT_BYTES) {
      throw new Error('Image is still too large after compression')
    }
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
