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

Production remains quadmart-4410f. Development is quadmart-development (377519547132), Standard Firestore in nam5, Spark plan. The development web app is registered, Email/Password Auth is enabled, and the rules/indexes in this branch have been deployed explicitly to development. No production rules or data were changed.

Vercel project narze4s-projects/quadmart uses development Firebase in its Preview environment. Production environment variables and main were left untouched. The stable branch URL is https://quadmart-git-security-firestore-rules-narze4s-projects.vercel.app and is an authorized development Auth domain.

The Preview environment contains the web-app NEXT_PUBLIC_FIREBASE_* configuration plus FIREBASE_ADMIN_PROJECT_ID=quadmart-development. Next.js embeds the public values at build time, so changing them requires a fresh deployment. Vercel builds reject emulator flags and a preview pointing at another Firebase project. Local emulator commands still use demo-quadmart.

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

## Remaining launch work

Photo uploads use Cloudinary and are disabled by default; the development preview explicitly sets QUADMART_ENABLE_UPLOADS=false. Photos are optional and were not exercised in the two-account test. Upload authentication, content validation, rate limits and asset ownership still need hardening before public deployment. Account deletion cleanup, blocking/reporting, suspension policy, abuse limits, pagination, backups and dependency security advisories also remain separate launch tasks. A development deployment is not a claim that the whole service is production-ready. npm audit currently reports unresolved dependency advisories, including Next.js; resolve or assess them before a public launch.
