import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: 'digi5pklj',
  api_key: '896871294671279',
  api_secret: 'FUa_leG2xcC6QAXROJ_syal4QBw',
})

export async function POST(request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('images')

    if (!files.length) {
      return Response.json({ error: 'No files provided' }, { status: 400 })
    }

    const urls = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        return new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: 'quadmart/listings', resource_type: 'image' },
            (error, result) => {
              if (error) reject(error)
              else resolve(result.secure_url)
            }
          ).end(buffer)
        })
      })
    )

    return Response.json({ urls })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
