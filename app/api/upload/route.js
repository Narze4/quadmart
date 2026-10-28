import { v2 as cloudinary } from 'cloudinary'
import { backend } from '@/lib/server/firebase-admin.mjs'
import { uploadPhoto, UploadError } from '@/lib/server/uploads.mjs'

export const runtime = 'nodejs'
export const maxDuration = 30

export function GET() {
  const enabled = process.env.QUADMART_ENABLE_UPLOADS === 'true' &&
    !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET
  return Response.json({ enabled }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request) {
  if (process.env.QUADMART_ENABLE_UPLOADS !== 'true') {
    return Response.json({ error: 'Photo uploads are not available yet. You can publish without photos.' }, { status: 503 })
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
          resource_type: 'image', type: 'authenticated', format: 'jpg',
          allowed_formats: ['jpg'], overwrite: false, timeout: 15000,
        }, (error, result) => error ? reject(error) : resolve(result)).end(bytes)
      })
    }
    const result = await uploadPhoto(request, { ...services, storeImage, projectId })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof UploadError) return Response.json({ error: error.message }, { status: error.status })
    console.error('Photo upload failed', error.code ?? error.name)
    return Response.json({ error: 'Unable to upload this photo. Please try again.' }, { status: 500 })
  }
}
