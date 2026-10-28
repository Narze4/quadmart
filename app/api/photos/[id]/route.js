import { v2 as cloudinary } from 'cloudinary'
import { backend } from '@/lib/server/firebase-admin.mjs'
import { authorizePhoto, readPhoto, UploadError } from '@/lib/server/uploads.mjs'

import { requestTrace } from '@/lib/server/telemetry.mjs'

export const runtime = 'nodejs'
export async function GET(request, { params }) {
  const trace = requestTrace('photo')
  try {
    const { id } = await params
    const asset = await authorizePhoto(request, id, backend())
    // Signed storage URLs stay on the server. The browser receives only JPEG bytes
    // after a fresh account/campus check; no public CDN URL bypasses that check.
    const url = cloudinary.url(asset.publicId, {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      type: 'authenticated', resource_type: 'image', format: 'jpg', secure: true, sign_url: true,
    })
    const upstream = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) })
    if (!upstream.ok || !upstream.headers.get('content-type')?.startsWith('image/jpeg')) throw new Error('Photo storage unavailable')
    const bytes = await readPhoto(upstream)
    return trace.finish(new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }))
  } catch (error) {
    const status = error instanceof UploadError ? error.status : 503
    return trace.finish(Response.json({ error: status === 503 ? 'Photo temporarily unavailable.' : error.message, requestId: trace.requestId }, { status }), { error })
  }
}
