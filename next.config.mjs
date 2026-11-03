import { validateCloudDeployment } from './lib/cloud-targets.mjs';
if (process.env.VERCEL === '1') validateCloudDeployment(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Firebase Admin and the federated client must share one Firestore module so
  // FieldValue transforms keep their prototype identity after server bundling.
  serverExternalPackages: ['@google-cloud/firestore', 'google-auth-library'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
};

export default nextConfig;
