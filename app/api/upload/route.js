import { v2 as cloudinary } from 'cloudinary'
import { backend } from '@/lib/server/firebase-admin.mjs'
import { uploadPhoto, UploadError } from '@/lib/server/uploads.mjs'

import { requestTrace } from '@/lib/server/telemetry.mjs'

export const runtime = 'nodejs'
export const maxDuration = 30

export function GET() {
  const enabled = process.env.QUADMART_ENABLE_UPLOADS === 'true' &&
    !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET
  return Response.json({ enabled }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request) {
  const trace = requestTrace('upload')
  if (process.env.QUADMART_ENABLE_UPLOADS !== 'true') {
    return trace.finish(Response.json({ error: 'Photo uploads are not available yet. You can publish without photos.', requestId: trace.requestId }, { status: 503 }))
  }
  try {
    const services = backend()
    const projectId = process.env.QUADMART_LOCAL === 'true' ? 'demo-quadmart' : process.env.FIREBASE_ADMIN_PROJECT_ID
    const storeImage = (bytes, publicId) => {
      const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env
      if (!cloud_name || !api_key || !api_secret) throw new Error('Image storage is not configured')
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({
          cloud_name, api_key, api_secret, public_id: publicId,
          // Dynamic folders do not follow public_id paths. Keep the restricted
          // development key's uploads inside its explicitly shared asset folder.
          asset_folder: `quadmart/${projectId}`,
          resource_type: 'image', type: 'authenticated', format: 'jpg',
          allowed_formats: ['jpg'], overwrite: false, timeout: 15000,
        }, (error, result) => error ? reject(error) : resolve(result)).end(bytes)
      })
    }
    const result = await uploadPhoto(request, { ...services, storeImage, projectId })
    return trace.finish(Response.json({ ...result, requestId: trace.requestId }))
  } catch (error) {
    const known = error instanceof UploadError
    return trace.finish(Response.json({ error: known ? error.message : `Unable to upload this photo. Please try again. Reference: ${trace.requestId}`, requestId: trace.requestId }, { status: known ? error.status : 500 }), { error })
  }
}
