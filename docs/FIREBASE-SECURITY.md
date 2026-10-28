# Local security foundation — not a production deployment

This branch is the first security milestone. It does NOT yet migrate the current UI to the new data contract. Do not deploy these rules to the existing app: account creation, profile reads, message sends, sale completion and reviews still need the coordinated changes listed below.

## Environments

- Existing project: quadmart-4410f (unchanged).
- Separate cloud development project: quadmart-development.
- Local disposable emulator project: demo-quadmart (the default alias).

No production credentials are required for tests. No deployment workflow is included.

## Run local tests

Use Node 22 and Java 21, then:

```sh
npm ci
npm run test:rules
```

The script explicitly targets demo-quadmart and runs the official Firestore emulator. Tests refuse to run without a loopback emulator endpoint. Fixtures are fake users and get cleared only inside the emulator. Rules tests mock verified auth claims; they do not prove the real signup/email verification flow works. The emulator also does not validate deployed composite index availability.

For an environment that restricts writes to your home directory:

```sh
XDG_CONFIG_HOME=/private/tmp/quadmart-config FIREBASE_EMULATORS_PATH=/private/tmp/quadmart-emulators npm run test:rules
```

`npm run emulators` starts local Auth and Firestore. The existing web app does not yet connect to those emulators automatically. Do not point it at production to test this branch.

## Contract

- Verified email at one of seven supported universities is required for protected data. Subdomains share a canonical campusId, e.g. students.emory.edu becomes emory.edu. Campus membership is derived from signed Firebase claims, not an editable profile field. This verifies mailbox access, not current enrollment.
- Private users/{uid} documents are owner-readable only. Owners can update displayName (80 characters) and savedListings (200 entries). Account provisioning and sensitive fields are backend-owned.
- publicProfiles/{uid} is a separate backend-maintained, campus-readable projection. It must contain no private email or saved items. Do not mirror an entire users document.
- Listings include immutable campusId, sellerUid, sellerEmail and createdAt. Validated title, price, category, condition, description and up to five Cloudinary image URLs are required. Real upload ownership verification remains future backend work.
- Listing queries must include campusId; owner listing queries include campusId and sellerUid. Rules do not filter broad queries.
- Conversations live at conversations/{id}. Creation validates an active same-campus listing and exactly the requesting buyer plus the listing seller. Participants are immutable.
- Message creates contain text, senderUid and createdAt; body size is limited to 4000 characters. Edits/deletes are denied. Only participants read or send. Inbox queries filter participants with array-contains.
- Trusted backend owns previews, notifications, sale records, reviews and reputation. Notification recipients can only mark a notification read.
- All unmatched paths are denied, including the old /messages collection.

## Required before cloud deployment or end-to-end claims

1. Add authenticated backend account provisioning after email verification. Validate campus and claims; recover missing profiles on retry. Remove client signup writes to scores and user documents.
2. Add a campusId to new listings and update all marketplace/dashboard/profile/owner queries. Plan any legacy-data migration separately; do not silently expose unscoped documents.
3. Move public-profile reads to publicProfiles and stop querying private users by email. Sync display-name changes through the backend projection.
4. Change chat payloads to senderUid, enforce participant queries, and generate message previews/notifications in trusted backend code. The old client preview/notification writes will be denied.
5. Implement authenticated, idempotent server operations for sale completion and transaction-linked reviews, using atomic writes. Remove direct client counter and score updates. These operations are intentionally denied until implemented, rather than leaving unsafe fallback writes.
6. Secure /api/upload with token verification, content validation, per-user quotas and server-owned upload metadata. Firestore image URL validation does not secure that endpoint.
7. Bind the app to local Auth/Firestore using explicit emulator-only settings. Add a separate development env template and a production-project guard. Existing .env.local configuration is not changed by this branch.
8. Deploy to development only after those changes, then test real signup, verification, two-user chat, trade/review retries, and every required index.
9. Address blocked/suspended accounts, account cleanup, reporting, abuse limits and dependency advisories before a student pilot. These rules do not implement those systems.

## Deployment discipline

No cloud rules or data were changed by running local tests. Keep default alias demo-quadmart. Any future deployment must name the development project explicitly and confirm matching application compatibility. Do not deploy this draft over quadmart-4410f.

Development cloud setup: created on October 27, 2026 on the no-cost Spark plan, with a Standard (default) Firestore database in user-approved nam5 (United States). The database starts in production mode (deny all client reads/writes). Optional Analytics, Gemini and paid scheduled backups were not enabled. No app environment, production deployment or production database was modified.
