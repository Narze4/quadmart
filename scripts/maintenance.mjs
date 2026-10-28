import { parseArgs } from 'node:util';
import { v2 as cloudinary } from 'cloudinary';
import { maintenanceServices } from './maintenance-services.mjs';
import { reconcileAccountClosure, queueMissingAuthAccount } from '../lib/server/account-closure.mjs';
import { mediaCleanupPage, cleanMedia } from '../lib/server/media-cleanup.mjs';
const { values } = parseArgs({ options: { project: { type: 'string' }, action: { type: 'string' }, uid: { type: 'string' }, media: { type: 'string' }, cursor: { type: 'string' }, apply: { type: 'boolean', default: false } } });
let services;
try {
  if (!['account', 'media', 'missing-auth'].includes(values.action)) throw new Error('Choose --action account, media or missing-auth');
  services = await maintenanceServices(values.project);
  const { db, auth } = services;
  if (values.action === 'missing-auth') {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(values.uid ?? '')) throw new Error('Explicit account UID required');
    console.log(JSON.stringify({ project: values.project, apply: values.apply, action: values.action, ...await queueMissingAuthAccount(db, auth, values.uid, { apply: values.apply }) }));
  } else if (values.action === 'account') {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(values.uid ?? '')) throw new Error('Explicit account UID required');
    const ref = db.doc(`accountDeletions/${values.uid}`), job = await ref.get();
    if (!job.exists) throw new Error('A deletion request is required before maintenance');
    let state = { phase: job.data().phase };
    if (values.apply) for (let batch = 0; batch < 20 && state.phase !== 'complete'; batch++) state = await reconcileAccountClosure(db, auth, values.uid);
    console.log(JSON.stringify({ project: values.project, apply: values.apply, action: 'account', ...state }));
  } else {
    const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
    if (values.apply && (values.project !== 'quadmart-development' || !cloud_name || !api_key || !api_secret)) throw new Error('Development storage credentials required for apply');
    const destroyImage = publicId => cloudinary.uploader.destroy(publicId, { cloud_name, api_key, api_secret, resource_type: 'image', type: 'authenticated', invalidate: true, timeout: 15000 });
    const options = { projectId: values.project, apply: values.apply, cursor: values.cursor, destroyImage };
    const result = values.media ? await cleanMedia(db, values.media, options) : await mediaCleanupPage(db, options);
    console.log(JSON.stringify({ project: values.project, apply: values.apply, action: 'media', ...result }));
  }
} catch {
  // Never dump SDK exception objects, credential paths, or response bodies.
  console.error('Maintenance did not complete. Check the explicit development project, arguments, credentials and requested job. Rerun without --apply to inspect safely.');
  process.exitCode = 1;
} finally { await services?.close(); }
