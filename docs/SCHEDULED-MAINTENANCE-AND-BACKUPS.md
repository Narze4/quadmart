# Development maintenance and recovery

This setup is restricted to `quadmart-development`. The user chose the existing free Firebase/Cloudinary setup and a schedule running through Codex on their Mac. It is a development aid, not an always-on production recovery service. Keep the Mac awake, online and the desktop app running; local task permissions and an unexpired Firebase CLI login are required. Codex task runs use the account's normal usage allowance.

## Six-hour job

The installed launcher uses a private, frozen copy of the reviewed operations code and dependencies. It verifies the source manifest before starting, refuses emulator variables and terminates a run after eight minutes. This avoids running unfinished edits from the app checkout. Refresh the runtime and manifest deliberately when operations code changes. Credentials remain local; no privileged Auth credential was added to Vercel.

Each run obtains a 15-minute Firestore lease. Another worker skips an active lease, and an expired lease can recover. A run must capture a new encrypted backup, write it successfully, decrypt it and validate its checksum before any cleanup begins. Backup failures stop cleanup. Lease checks prevent an expired worker proceeding to another cleanup step.

The worker visits at most 25 private profiles, 25 deletion jobs and 25 old media registry records per run. Cursors persist in `systemOperations/developmentMaintenance`, which clients cannot read or write. Profile scanning positively checks Firebase Auth before queueing an externally deleted login. Missing/invalid membership and active moderator cases require review; network errors never count as missing accounts. Each deletion job advances at most 20 batches in a run. Failed jobs are revisited after the cursor wraps. Photo cleanup retains the existing 24-hour grace period, exact development namespace checks, transaction claims and live/archive/report evidence holds.

The safe report contains counts and phases, not emails, message text, raw SDK exceptions or credentials. A run with failures/manual-review cases exits unsuccessfully. The scheduled prompt also flags incomplete/stale jobs and a previous successful run older than 18 hours. The clock cannot alert while this same Mac/app is unavailable; an overdue period is detected when it next runs. Cursor-based backlog counts cover the current page, not the entire database.

Private local reports are `latest-launch.json` and `backups/latest-run.json`. The launch report also covers configuration errors, dependency failures and timeouts before the worker starts. A skipped overlapping run is not proof that the other worker succeeded; inspect its eventual report. No automatic email, Slack message or third-party alert destination is configured.

## Backup boundary

The backup covers **Firestore document data**, recursively including nested collections under missing parents. Collection discovery and every document page use one fixed `readTime` five seconds before capture starts. REST Firestore values are retained, including integers beyond JavaScript's safe range, timestamps, references, bytes and geo points. Source rules, indexes and Firebase config files are bundled as reference copies; these are repository versions, not a live export of IAM or platform settings.

The collector fails rather than truncate at 10,000 documents, 20,000 requests, 64 MiB or 30 minutes. The launcher has a stricter eight-minute process limit. These bounds suit the small development database; reconsider them and quota usage as data grows. Reads and discovery consume service quota. The run is not a replacement for managed Firestore backups.

Snapshots use authenticated AES-256-GCM encryption with a random 32-byte local key, random nonce, checksum validation and owner-only files/directories. No plaintext snapshot is written. Completed files have a `.qmb` suffix; incomplete files are never treated as valid backups. Only after verifying the new snapshot does retention keep the newest 28 completed backups (about seven days at an uninterrupted six-hour cadence). This is a development storage setting, not a privacy retention policy.

The encryption key and archives are on the same Mac. This protects files from casual disclosure but does **not** protect against loss of that Mac or compromise of its account. An independently protected off-device copy and separate recovery-key custody remain launch requirements. Backups may contain data removed by subsequent account deletion; a future cloud restore must reconcile the latest closure/moderation state before enabling access.

Not included: Firebase Auth login/password records, Cloudinary image bytes, deployed IAM/identity-provider configuration or billing settings. The backup includes image registry references only. A Firestore restore test does not prove complete service recovery, image recovery or password recovery. These need separate recovery plans before launch.

## Restore rehearsal

`restore-test` can write only to `demo-quadmart-restore` on `http://127.0.0.1:8180`. It refuses the normal local-test emulator, any cloud target and any nonempty target. The dedicated emulator has deny-all client rules. Restored documents use create-only preconditions; internal document references are remapped to the rehearsal project. Every restored document is independently read back and compared. A partial/failed target must be discarded, not overwritten.

The rehearsal makes no Auth accounts, sends no emails and performs no Cloudinary operation. It validates Firestore recovery in a disposable emulator; it does not implement an automatic cloud restore command. The local emulator is shut down after the rehearsal. Test snapshots and safe proof reports should be distinguished from the private backup files.

A weekly local rehearsal uses the most recent backup, requires it to be less than 18 hours old, starts its own isolated emulator and refuses an occupied port/nonempty database. Its safe result is `latest-rehearsal.json`. Java 21 and the cached official Firestore emulator are required. An eight-minute timeout aborts a stuck rehearsal; if interrupted, inspect and stop only its own emulator before retrying. The schedule reports failed rehearsals or a meaningful recovery, and stays quiet on routine success.

## Commands

Run these from an installed checkout/runtime with Node 22. Replace the uppercase paths with private absolute paths. Never pass credential values or backup-key bytes on the command line.

```sh
# Read/backup only; no database or provider mutation.
XDG_CONFIG_HOME=PRIVATE_CLI_CONFIG npm run operations -- --project quadmart-development --action run --directory PRIVATE_BACKUPS --key PRIVATE_KEY

# Approved development cleanup after a newly verified backup.
XDG_CONFIG_HOME=PRIVATE_CLI_CONFIG npm run operations -- --project quadmart-development --action run --apply --directory PRIVATE_BACKUPS --key PRIVATE_KEY --cloudinary-config PRIVATE_CLOUDINARY_JSON

# Safe last-run report; an older-than-18-hours report exits unsuccessfully.
npm run operations -- --action status --directory PRIVATE_BACKUPS --key PRIVATE_KEY

# Disposable restore rehearsal; this target must be empty.
firebase emulators:exec --config firebase.restore.json --only firestore --project demo-quadmart-restore "node scripts/operations.mjs --action restore-test --project demo-quadmart-restore --directory PRIVATE_BACKUPS --key PRIVATE_KEY --file BACKUP_FILENAME.qmb"
```

`test:backup`, `test:operations` and `test:restore` cover encryption/tampering, source/target guards, paging, missing parents, private permissions, retention, leases, interrupted runs, recent-backup gating, Auth failures, moderator protection, stale-job reporting and actual typed document restoration. CI also runs the pre-existing rules, backend, upload and marketplace flow checks.

## Before student invitations

Move scheduling and recovery to an always-on host; add independent missed-run alerts, least-privileged worker identity, protected off-device backups and a separate recovery key. Decide Auth and photo recovery procedures, test a cloud recovery environment, document recovery-time/data-loss targets and assign an operator. Set retention policy and audit restores for previously deleted/suspended accounts. This local schedule does not make the project launch-ready by itself.

Sources: [Firebase managed backup requirements](https://firebase.google.com/docs/firestore/backups), [fixed-time collection discovery](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listCollectionIds), [fixed-time document listing and missing parents](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listDocuments), [Codex local scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app).
