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

Existing project: quadmart-4410f. Separate project: quadmart-development, Standard Firestore in nam5, Spark plan. Cloud development still has deny-all initialization rules. Neither the new rules nor this app integration has been deployed to either cloud project.

To move this tested local integration into cloud development:

1. Register a development web app, enable Email/Password Auth and configure authorized development domains.
2. Set NEXT_PUBLIC_FIREBASE_* from that web app, and FIREBASE_ADMIN_PROJECT_ID=quadmart-development. NEXT_PUBLIC_USE_FIREBASE_EMULATORS and QUADMART_LOCAL must be absent/false. Never publish a build made with build:local.
3. Configure a trusted server identity via Application Default Credentials with only the permissions needed for Firestore and Auth verification. Keep credentials outside Git and client-prefixed environment variables. No service-account keys are included here.
4. Deploy firestore.rules and firestore.indexes.json explicitly to quadmart-development, then deploy the matching application. Wait for indexes to become ready; emulator tests do not verify deployed indexes.
5. Test real email delivery, hosting credentials, authorized domains and cloud queries before any production rollout. Legacy data needs a reviewed migration for campusId, UID-based identity and public profile projections; this change does not migrate existing cloud data.

## Remaining launch work

Photo uploads use Cloudinary and were not exercised in the two-account test (photos are optional). Upload authentication, content validation, rate limits and asset ownership still need hardening before public deployment. Account deletion cleanup, blocking/reporting, suspension policy, abuse limits, pagination, backups and dependency security advisories also remain separate launch tasks. This branch is locally integrated, not a claim that the whole service is production-ready.
