if (process.env.VERCEL === '1') {
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' || process.env.QUADMART_LOCAL === 'true') {
    throw new Error('Never deploy an emulator build to Vercel');
  }
  if (process.env.VERCEL_ENV === 'preview' && (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'quadmart-development' ||
    process.env.FIREBASE_ADMIN_PROJECT_ID !== 'quadmart-development' ||
    process.env.QUADMART_CREDENTIAL_MODE !== 'vercel-oidc'
  )) throw new Error('Preview requires the isolated development Firebase configuration');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
};

export default nextConfig;
