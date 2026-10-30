# QuadMart

QuadMart is a campus resale marketplace built with Next.js and Firebase. The current development branch connects to an isolated backend and remains under review before student invitations.

Start with [Launch readiness](docs/LAUNCH-READINESS.txt) for completed checks and the remaining owner/device decisions. [Draft PR #1](https://github.com/Narze4/quadmart/pull/1) records validation for the exact published commit. Dated test reports describe their own test run, not an ongoing health guarantee.

## Run locally

Use Node 22, Java 21 and npm. Install dependencies and start the disposable Firebase emulators:

```sh
npm ci
npm run emulators
```

In a second terminal, run:

```sh
npm run dev:local
```

Open http://127.0.0.1:3000. These scripts force the demo-quadmart project and loopback Auth/Firestore endpoints. No production credentials are required. Do not copy cloud server credentials into browser configuration.

## Validate changes

```sh
npm run lint
npm run test:integration
```

Stop separately running emulators first. The integration command builds the app, starts disposable Auth/Firestore emulators and a local server, runs the two-account trade and browser regression suites, then shuts down its server. It clears the demo-quadmart fixtures; use a separate session from any emulator data you want to keep. CI additionally runs rules, upload, abuse, cleanup, backup/restore, credential, session and pagination tests plus the production dependency audit.

## Development boundaries and operations

- Firebase development: quadmart-development. Local tests: demo-quadmart; recovery rehearsal: demo-quadmart-restore.
- The security/firestore-rules Vercel Preview uses the development backend. Its stable hostname is required for App Check. Keep preview access protection enabled.
- Production quadmart-4410f and main are outside this development rollout. Production migration, the invitation hostname and public release require a separate reviewed plan.
- [Backend configuration and rules](docs/FIREBASE-SECURITY.md)
- [Pagination and account-page behavior](docs/PAGED-READS.md)
- [Abuse protection and operations](docs/ABUSE-AND-OPERATIONS.md)
- [Moderation](docs/SAFETY-AND-MODERATION.md) and [account/photo cleanup](docs/ACCOUNT-AND-PHOTO-CLEANUP.md)
- [Scheduled maintenance and encrypted recovery](docs/SCHEDULED-MAINTENANCE-AND-BACKUPS.md)
- [Physical-phone acceptance checklist](docs/PHONE-ACCEPTANCE-CHECKLIST.txt)

Recovery keys, credential files, raw account exports and downloaded backup contents stay outside the repository. The free development maintenance setup requires the Mac to be awake and online; it cannot independently report its own outage.
