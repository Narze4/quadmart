# Development maintenance and recovery

This setup is restricted to `quadmart-development`. It uses existing free Firebase, Cloudinary and personal Google Drive storage and runs through Codex on the owner's Mac. No billing upgrade or privileged Vercel credential is needed. Keep the Mac awake, online and the desktop app running; local permissions, connected Drive and an unexpired Firebase CLI login are required. Codex runs use the account's normal usage allowance. This is not an always-on production recovery service.

## Six-hour workflow

The private launcher verifies a pinned source manifest and runs with an eight-minute timeout. `prepare` captures and validates an encrypted complete bundle. The scheduled task uploads it through the connected Google Drive tool into the configured private folder, verifies owner-only permissions and parent, downloads the file, and registers a receipt only when the bytes match and decrypt correctly. Only then may `apply BACKUP_FILENAME` perform cleanup. Both capture and verified receipt must be less than 30 minutes old. Failed capture, upload, download, privacy checks or decryption stop cleanup.

Cleanup obtains a 15-minute Firestore lease; overlapping work skips and expired leases can recover. The worker visits at most 25 private profiles, 25 deletion jobs and 25 old media records per run. Cursors persist in client-inaccessible `systemOperations/developmentMaintenance`. Each deletion job advances at most 20 batches per run. Auth network errors never count as a missing account; active moderator and invalid membership cases require review. Photo deletion keeps its 24-hour grace period, exact namespace checks, transactional claims and live/archive/report evidence holds.

Safe reports contain counts and stages, never emails, messages, credential values or raw SDK errors. Failures, stale/incomplete jobs and an 18-hour overdue interval are reported in the chat. Ordinary successes stay quiet. An offline Mac cannot notify until it next runs. A skipped overlap is not evidence that another run succeeded. No external messages or emails are sent.

## Contents and limits

A version 2 encrypted bundle contains:

- Firestore documents, including nested collections with missing parents. Collection discovery and every page use one fixed `readTime` five seconds before capture starts. REST value types, large integers, timestamps, references, bytes and geo points are preserved. Rules/indexes/Firebase config are repository reference copies.
- Firebase email/password accounts: stable user IDs, email verification and disabled status, profile fields, custom claims, creation/sign-in metadata, exportable password hashes and salts, and the project's modified SCRYPT parameters. Missing hashes, unsupported providers, tenant accounts or enrolled MFA stop the backup. No plaintext passwords or active refresh tokens are backed up.
- Actual authenticated JPEG bytes for registered photos, with independent SHA-256 checksums, dimensions and provider identifiers. Deleted records are skipped. A missing unfinished/failed upload is explicitly recorded; a missing ready/blocked/deleting image fails the capture. The source-upload digest is not reused for the sanitized stored JPEG.

Auth is exported twice around photo capture and compared; hash parameters are also checked again. Firestore and Auth/provider state are not one atomic transaction. Quiesce writes and reconcile account closure/moderation history before a real disaster restore. Unregistered provider assets, IAM, billing, provider account configuration and active sessions are outside this backup.

Bounds fail closed at 10,000 documents/accounts, 20,000 Firestore requests, 1,000 photos, 4 MiB per photo, 32 MiB photo bytes or 64 MiB total plaintext. The collector limit is 30 minutes and the launcher limit is eight. Reads and image downloads consume provider quotas. Reassess these limits before inviting students or adding authentication methods.

## Encryption, storage and recovery key

Bundles use AES-256-GCM with a random 32-byte key, random nonce, authenticated envelope and per-content checksums. No plaintext snapshot is saved. Private directories are mode 0700 and files 0600. A missing key is an error; scheduled runs never generate a replacement. Latest 28 completed local bundles are retained. Incomplete files are not accepted.

Only encrypted `.qmb` files go to the dedicated private Google Drive folder. The key stays separate in the owner's password manager (confirmed October 28, 2026). Google Drive files must have exactly the expected owner permission and no shared access. Metadata alone is not proof of recovery: every successful offsite receipt records the checksum of downloaded ciphertext and validated decrypted contents.

Offsite archives are retained until the operator chooses a retention policy; the task does not permanently delete Drive files. Before uploads, it checks the folder inventory and a 1 GiB development budget. A partial/ambiguous listing, budget or provider quota failure stops the upload and cleanup and alerts the operator. No paid storage is enabled. The task removes only obsolete local download-cache files after a successful verification. Backups may include records later deleted; data retention and restoration of closed accounts need a launch policy.

Private state lives under the installed operations directory: `backup.key`, `offsite-config.json`, `backups/`, `offsite-downloads/`, `latest-launch.json`, `latest-rehearsal.json`, and `backups/latest-offsite.json`. Do not commit, attach or paste these private files. Source manifests and reports must not include credentials.

## Restore rehearsal and manual disaster procedure

The weekly Sunday 11 a.m. local rehearsal downloads the latest verified Drive file again and checks its metadata and ciphertext against the receipt. It requires a capture younger than 18 hours, starts its own empty `demo-quadmart-restore` emulators on loopback Firestore 8180 and Auth 9199, and shuts them down afterward. Occupied ports fail; do not stop an unidentified process.

Firestore restore refuses cloud, normal development emulator and nonempty targets. It uses create-only writes, remaps internal references, and independently compares every document. Auth imports retain password hash/salt and metadata but disable every restored account. Photos restore to an empty private temporary folder, are checked byte-for-byte and decoded for dimensions, then removed. Emulator Auth import does **not** prove actual password sign-in; a separate disposable development-cloud test covers that. Neither weekly rehearsal nor the CLI automatically writes restored data into cloud services.

If the Mac is lost:

1. Recover the reviewed source/runtime and dependencies on a trusted replacement. Download an encrypted backup from the private Drive folder. Keep it and any recovery note in a mode-0700 directory.
2. Export the recovery-key note from the password manager to a mode-0600 local text file. Run `node scripts/recover-backup-key.mjs PRIVATE_NOTE ABSENT_KEY_PATH`. It writes the raw key with mode 0600, prints only its fingerprint, and refuses an existing destination. Compare the fingerprint with the saved note and remove the temporary note. Never put key bytes in a command or chat.
3. Decrypt and rehearse the backup only in the isolated local emulators using the command below. Verify account/photo/document counts and checksums. A tampered bundle or wrong key must fail.
4. Provision a separate recovery cloud environment and review current closure, suspension, verification and moderator state. Re-establish IAM, email templates, domains and provider configuration. Restore accounts quarantined; no account should be re-enabled solely because it appeared in an old backup. Auth hashes must use the saved SCRYPT parameters. Restore authenticated images with original IDs and create-only/overwrite-disabled uploads. Reconcile registry references before enabling access.
5. Test real password sign-in and the complete marketplace flow before switching traffic. A fresh device/cloud disaster exercise, operator ownership, retention and recovery-time/data-loss targets remain pre-invitation work.

## Commands

Use Node 22, Java 21 and private absolute paths. Never pass credential/key bytes in command arguments. `PRIVATE_HOME` below denotes the installed private directory.

```sh
node scripts/run-scheduled-maintenance.mjs PRIVATE_HOME prepare
# Connector: upload .qmb, verify metadata, fetch raw download reference.
# Save only that temporary reference to a private input JSON, then:
node scripts/download-offsite.mjs PRIVATE_DOWNLOAD_INPUT PRIVATE_DOWNLOAD_DIRECTORY
node scripts/operations.mjs --action register-offsite --directory PRIVATE_BACKUPS --key PRIVATE_KEY --file BACKUP_FILENAME.qmb --download PRIVATE_DOWNLOADED_FILE --metadata PRIVATE_DRIVE_METADATA --offsite-config PRIVATE_OFFSITE_CONFIG
node scripts/run-scheduled-maintenance.mjs PRIVATE_HOME apply BACKUP_FILENAME.qmb
node scripts/run-scheduled-restore.mjs PRIVATE_HOME

# Manual isolated rehearsal on a recovered bundle; no cloud writes.
firebase emulators:exec --config firebase.restore.json --only auth,firestore --project demo-quadmart-restore "node scripts/operations.mjs --action restore-test --project demo-quadmart-restore --directory PRIVATE_BACKUPS --key PRIVATE_KEY --file BACKUP_FILENAME.qmb"
```

`test:backup`, `test:operations` and `test:restore` exercise encryption, tampering, private files, pagination, missing hashes/providers, image scope/bytes, offsite privacy/checksum/freshness gates, recovery-key import, worker leases and empty-target document/account restoration. CI also runs rules, uploads, safety, abuse, cleanup and production-build marketplace flows.

Sources: [Firebase password import](https://firebase.google.com/docs/auth/admin/import-users), [Auth export and SCRYPT parameters](https://firebase.google.com/docs/cli/auth), [Cloudinary authenticated downloads](https://cloudinary.com/documentation/image_upload_api_reference), [Firestore fixed-time discovery](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listCollectionIds), [Codex local scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app).
