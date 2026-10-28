# Backend and local testing

The app now uses authenticated Next.js backend operations for profile provisioning, conversation creation, messages, sale completion and reviews. The browser reads campus-scoped public data and participant-only chats. Private account documents remain owner-only. Clients cannot write transactions, reputation, reviews, notifications or message previews.

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
- Listings are scoped by campusId and validated by rules. Dashboard and marketplace fetch up to 100 active campus listings; message views load the latest 100 messages. Further pagination remains future work.
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

Cloud test fixtures may be provisioned as explicitly verified synthetic development accounts without sending email. Such tests exercise hosted Auth, rules and the backend, but do not establish real student email delivery or ownership. Real email delivery remains a separate prelaunch check. Existing production data still needs a reviewed migration for campusId, UID-based identity and public profiles.

## Photo upload and delivery controls

The upload endpoint verifies a non-revoked Firebase ID token, supported university email verification and a provisioned profile before storing a photo. It accepts one JPG/PNG/WebP at a time, reads at most 3 MiB even without Content-Length, fully decodes at most 25 megapixels, rejects animation and mismatched file types, resizes to at most 1600 pixels, and re-encodes JPEG without EXIF/GPS metadata. Raw files and user-supplied file names are not uploaded.

Firestore transactions enforce 10 attempts per minute and 20 per UTC day per account, plus 200 attempts per UTC day across development. Invalid images and provider failures count against the budget. Idempotent successful retries return the same asset; concurrent requests cannot create duplicate stored objects. These are conservative pilot limits, not a complete abuse-prevention system.

Only the backend can write media registry and upload-budget records. Listing rules validate each image ID, exact app URL, ready status, owner and campus, up to five images. Legacy photo URLs need migration before production; existing no-photo listings remain valid.

Cloudinary uploads use the authenticated delivery type and server-generated IDs under quadmart/<Firebase-project>/<hashed-owner>/. The app keeps signed Cloudinary URLs on the server. /api/photos/<id> verifies current campus membership and returns JPEG bytes with private/no-store caching; signed-out, unverified and other-campus requests cannot read photos. Authenticated viewers can still save or screenshot images they can view.

Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET only in the Preview server environment, using a separate development Cloudinary product environment where available. After credentials are configured, enable QUADMART_ENABLE_UPLOADS in the protected Preview for the hosted upload/read test. Keep it disabled if configuration or validation is incomplete. The UI hides uploads while storage is disabled or unconfigured. Never expose the API secret via NEXT_PUBLIC_ variables or an unsigned upload preset. Failed/pending registry records retain their generated public IDs for reconciliation. Abandoned-upload and deleted-account asset cleanup still need an operational retention policy.

References: https://cloudinary.com/documentation/control_access_to_media and https://sharp.pixelplumbing.com/api-output/.

## Real email verification

Signup sends a Firebase verification email with a fixed authorized return URL (NEXT_PUBLIC_APP_URL, ending in /verify-email). Account creation and email sending are treated separately: a delivery failure leads to the resend page instead of trapping the student in an already-created-account error. That page only says an email was sent after a confirmed send, preserves the one-minute UX cooldown across refresh, and refreshes the ID token after verification. Firebase enforces service-level sending limits; the client cooldown itself is not a security boundary.

The actual mailbox test uses normal Firebase client signup with emailVerified=false. No administrator marks that account verified. The account is denied marketplace data until the recipient opens Firebase's emailed link. Synthetic accounts used in other development tests remain separate. University mailbox verification establishes email control, not current enrollment; the pilot must define eligibility for alumni/staff and eventual re-verification.

Reference: https://firebase.google.com/docs/auth/web/passing-state-in-email-actions.

## Remaining launch work

Photo code and local security tests are implemented, but development Cloudinary credentials and the real inbox confirmation are still pending. Uploads remain disabled until hosted storage validation is complete. Account deletion/abandoned-photo cleanup, blocking/reporting, suspension policy, broader abuse limits, pagination and backups remain launch tasks. Next.js was upgraded to 16.4.3 and compatible dependency fixes removed critical npm audit findings. The production dependency audit still reports seven high findings from two underlying transitive families (gRPC in Firebase's Node client and Zod in Vercel's CLI-config dependency); assess or patch these before public launch, without blindly downgrading Firebase or the OIDC SDK. A development deployment is not a claim of launch readiness.
