# Backend and local testing

The app now uses authenticated Next.js backend operations for profile provisioning, listing publication/reservation, conversation creation, messages, sale completion and reviews. The browser reads campus-scoped public data and participant-only chats. Private account documents remain owner-only. Clients cannot write transactions, reputation, reviews, notifications or message previews.

## Local setup

Requirements: Node 22, Java 21, npm.

```sh
npm ci
npm run emulators
# In a second terminal:
npm run dev:local
```

Local scripts force demo-quadmart and loopback Auth/Firestore endpoints. No production credentials are needed. The backend rejects partial emulator configuration and checks matching browser/server project IDs outside local mode.

```sh
npm run test:rules
npm run test:uploads
npm run test:safety
npm run test:cleanup
npm run test:abuse
npm run test:observability
npm run test:credentials
npm run test:integration
```

Stop separately running emulators before invoking these commands. The integration command builds the app in local mode, starts disposable emulators and a Next production server on port 3100, runs the full HTTP/Firestore trade, then stops its server. Tests intentionally clear only the demo-quadmart emulator database and Auth users; do not run them against a manually populated emulator session you want to keep.

If filesystem permissions prevent Firebase cache writes, prefix emulator/test commands with:

```sh
XDG_CONFIG_HOME=/private/tmp/quadmart-config FIREBASE_EMULATORS_PATH=/private/tmp/quadmart-emulators npm run test:integration
```

## Implemented behavior

- Verified supported university email is required by both the API and rules. Server-derived campusId handles supported subdomains.
- Verification triggers idempotent private/public profile provisioning before protected screens receive the signed-in user. Profile names update through the API; public profiles omit email and saved items. New reputation displays New.
- Listings are scoped by campusId; publication and reservation updates are validated by the backend with transactional quotas, retry records and version checks. Rules deny direct client creation/updates. Dashboard queries are bounded; marketplace and account collections use 24-item cursor pages, while inbox/message history keeps a live 30-item head with older-page loading. See PAGED-READS.md for lookahead, search and retry behavior.
- Conversation IDs derive from listing and buyer, preventing duplicate chat creation on retries. The server verifies listing ownership, campus and availability.
- Message IDs derive from sender and a per-send request ID. One transaction writes the message, preview and recipient notification. Browser retries reuse the request ID.
- Sale IDs equal listing IDs. A transaction validates seller ownership and the contacted buyer, marks sold, records the trade, increments both profiles once and creates review notifications. Off-platform sales have no buyer or review eligibility. This records an exchange; it does not process payment or prove physical handoff.
- Reviews derive their recipient and role from the completed transaction. Each participant may review once per trade. Rating, review, reputation aggregate and transaction review flag update atomically. Replaying the identical review succeeds; changing an already submitted review returns a conflict.
- Chat participants cannot add outsiders or forge messages through direct database writes. Clients cannot inflate counters or create notifications.

## Development cloud setup

Production remains quadmart-4410f. Development is quadmart-development (377519547132), Standard Firestore in nam5, Spark plan. The development web app is registered, Email/Password Auth is enabled, and the rules/indexes in this branch have been deployed explicitly to development. No production rules or data were changed.

Vercel project narze4s-projects/quadmart uses development Firebase in its Preview environment. Production environment variables and main were left untouched. The stable branch URL is https://quadmart-git-security-firestore-rules-narze4s-projects.vercel.app and is an authorized development Auth domain.

The Preview environment contains the web-app NEXT_PUBLIC_FIREBASE_* configuration plus FIREBASE_ADMIN_PROJECT_ID=quadmart-development. Next.js embeds the public values at build time, so changing them requires a fresh deployment. Vercel builds reject emulator flags and a preview pointing at another Firebase project. Local emulator commands still use demo-quadmart.

Vercel Preview also sets NODE_OPTIONS=--experimental-require-module, required for Firebase Admin 14 and its jwks-rsa/jose dependencies on Vercel. This is Vercel's documented runtime option: https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration. Standard Protection keeps the preview restricted to Vercel team members.

Server authentication uses Vercel OIDC and Google Workload Identity Federation:

- Service account: quadmart-preview@quadmart-development.iam.gserviceaccount.com.
- Project roles: roles/datastore.user and roles/firebaseauth.viewer. These allow backend database operations and checking whether Auth tokens were revoked. The identity cannot administer Auth users, deploy rules, or manage IAM.
- Pool/provider: projects/377519547132/locations/global/workloadIdentityPools/quadmart-preview/providers/vercel.
- Issuer: https://oidc.vercel.com/narze4s-projects; audience: https://vercel.com/narze4s-projects.
- Provider condition requires the exact subject owner:narze4s-projects:project:quadmart:environment:preview AND project_id prj_9xZTvLfaS6wXCG9R00TyFVM4icai. The exact subject receives roles/iam.workloadIdentityUser on this service account.
- QUADMART_CREDENTIAL_MODE=vercel-oidc and the two GCP identifiers in .env.development.example select this identity. No service-account key is created or stored. Google tokens refresh automatically.
- The Firebase Auth credential and Firestore GoogleAuth client share the same refreshing federated client. Outside Vercel preview, the existing ADC path remains available.

Deploy development rules with npm run deploy:rules:development. Always check deployed index readiness; the emulator does not enforce composite-index availability. Run npm run test:credentials and npm run test:integration for local regression coverage.

Cloud test fixtures may be provisioned as explicitly verified synthetic development accounts without sending email. Such tests exercise hosted Auth, rules and the backend, but do not establish real student email delivery or ownership. The separate real-mailbox verification check is complete, as described below. Existing production data still needs a reviewed migration for campusId, UID-based identity and public profiles.

## Photo upload and delivery controls

The upload endpoint verifies a non-revoked Firebase ID token, supported university email verification and a provisioned profile before storing a photo. It accepts one JPG/PNG/WebP at a time, reads at most 3 MiB even without Content-Length, fully decodes at most 25 megapixels, rejects animation and mismatched file types, resizes to at most 1600 pixels, and re-encodes JPEG without EXIF/GPS metadata. Raw files and user-supplied file names are not uploaded.

Firestore transactions enforce 10 attempts per minute and 20 per UTC day per account, plus 200 attempts per UTC day across development. Invalid images and provider failures count against the budget. Idempotent successful retries return the same asset; concurrent requests cannot create duplicate stored objects. These are conservative pilot limits, not a complete abuse-prevention system.

Only the backend can write media registry and upload-budget records. The listing API validates each image ID, exact app URL, ready status, owner and campus inside its transaction, up to five distinct images. Legacy photo URLs need migration before production; existing no-photo listings remain valid.

Cloudinary uploads use the authenticated delivery type and server-generated IDs under quadmart/<Firebase-project>/<hashed-owner>/. The dynamic asset_folder is explicitly set to quadmart/<Firebase-project> and checked in the provider response; public ID paths alone do not place assets in a Cloudinary folder. The app keeps signed Cloudinary URLs on the server. /api/photos/<id> verifies current campus membership and returns JPEG bytes with private/no-store caching; signed-out, unverified and other-campus requests cannot read photos. Authenticated viewers can still save or screenshot images they can view.

Development storage is configured in the existing Free cloud digi5pklj, using a dedicated API key named QuadMart Development Preview. Its global role is Media Library User, with the Manager folder role only on quadmart/quadmart-development. This is folder isolation within the existing cloud, not a separate Cloudinary product environment. The owner approved this scope; no plan upgrade was made. The existing admin credential was used temporarily to assign the folder role, then its temporary local copy was removed. A real request to upload outside the shared folder was denied.

CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are Secret variables scoped only to the security/firestore-rules Preview branch. QUADMART_ENABLE_UPLOADS=true is a Config override on that branch; the general Preview default remains false and Production is unchanged. Never enable uploads on another deployment until its storage permissions and delivery are validated. The UI hides uploads while storage is disabled or unconfigured. Never expose the API secret via NEXT_PUBLIC_ variables or an unsigned upload preset. Failed/pending registry records retain their generated public IDs for reconciliation. Resumable account deletion and guarded abandoned-photo cleanup are implemented; six-hour Mac-hosted scheduling is implemented. Team-approved retention and reliable launch operations remain open. See ACCOUNT-AND-PHOTO-CLEANUP.md.

References: https://cloudinary.com/documentation/control_access_to_media, https://cloudinary.com/documentation/dam_admin_permissions, https://cloudinary.com/documentation/image_upload_api_reference and https://sharp.pixelplumbing.com/api-output/.

## Real email verification

Signup sends a Firebase verification email with a fixed authorized return URL (NEXT_PUBLIC_APP_URL, ending in /verify-email). Account creation and email sending are treated separately: a delivery failure leads to the resend page instead of trapping the student in an already-created-account error. That page only says an email was sent after a confirmed send, preserves the one-minute UX cooldown across refresh, and refreshes the ID token after verification. Firebase enforces service-level sending limits; the client cooldown itself is not a security boundary.

The actual mailbox test used normal Firebase client signup with emailVerified=false. The owner opened Firebase's emailed link, and a fresh sign-in/token now confirms emailVerified=true in quadmart-development. No administrator verified this account. Hosted account setup created private/public profiles; same-campus listing reads succeed while other-campus listings and another user's private profile remain denied. The signed-in dashboard also loads successfully. Synthetic accounts used in other development tests remain separate. University mailbox verification establishes email control, not current enrollment; the pilot must define eligibility for alumni/staff and eventual re-verification.

Reference: https://firebase.google.com/docs/auth/web/passing-state-in-email-actions.

## Remaining launch work

Development photo uploads are enabled and validated with real Cloudinary storage, seller publication, buyer image rendering and rejection of unauthenticated photo requests. Local security tests also cover unverified and cross-campus access, quotas and forged ownership. Real university mailbox verification is confirmed. See PHOTO-VERIFICATION-TEST-RESULTS.txt for the exact distinction between hosted and local checks. Reporting, bidirectional blocking, reversible listing removal, account suspension and the private moderation queue are implemented; see SAFETY-AND-MODERATION.md. Local six-hour maintenance, encrypted database/login/photo backups to private Drive, and weekly isolated recovery tests are implemented; see SCHEDULED-MAINTENANCE-AND-BACKUPS.md. Development edge rejection/recovery and cursor pagination are also implemented and tested. See LAUNCH-READINESS.txt for current evidence and open invitation gates, including physical devices, owner-completed email actions, operational coverage, cloud disaster recovery and team policies. Server quotas and privacy-safe request logging are implemented; see ABUSE-AND-OPERATIONS.md. A development deployment is not a claim of launch readiness.

Next.js is pinned to 16.4.3 and sharp is at 0.35.5. Scoped npm overrides replace Firebase's pinned Node gRPC dependency with @grpc/grpc-js 1.14.6 and Vercel CLI-config's pinned Zod with 4.6.7, without downgrading Firebase or the OIDC SDK. These overrides deliberately exceed the parent packages' old pins and must remain covered by rules, credential and integration checks; remove them once upstream dependencies select patched versions. The production audit reports zero findings on October 27, 2026. The full development dependency audit still has eight moderate findings through OpenTelemetry and uuid; the production-only audit excludes this tooling. CI runs the production audit at the high severity threshold so newly reported high/critical findings block changes. An audit result is a dependency snapshot, not a guarantee of application security.

Upstream details: https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j and https://github.com/grpc/grpc-node/releases/tag/@grpc%2Fgrpc-js@1.14.6 cover the gRPC fixes; https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 covers the Zod fix.
