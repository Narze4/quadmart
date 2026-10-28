# Account deletion and photo cleanup

Development implementation, October 28, 2026. This is an engineering retention boundary, not a finalized privacy/retention policy. Agree on retention, support ownership and maintenance scheduling before inviting students.

## Student flow

Settings explains what will be removed and retained, asks for the current password, and requires explicit deletion confirmation. The server validates a sign-in within five minutes using the verified token's auth_time; refreshing an old token alone is insufficient. It derives the UID from the token and rejects client-supplied target IDs. Active moderators must transfer responsibility before closing their account.

The first transaction writes a permanent private accountLifecycle tombstone, creates a resumable accountDeletions job, and replaces the public name with Deleted student. Existing sessions immediately lose marketplace access. Server operations check closure for the actor and contacted party; photo access checks the owner. A moderator cannot restore a closed seller's archived listing. Suspension/reinstatement cannot erase the separate closure tombstone.

The browser then advances bounded database batches (25 records per transaction) and a checkpoint together. It removes listings, own notifications and block records, removes the private profile/saved items, and replaces the participant name in conversations. Completed trades, reviews, message history, incoming blocks and moderation evidence remain. Public reputation aggregates and a minimal public profile remain to support those records. Private archives may include original listing details. Do not describe this as deletion of every piece of personal data.

Only after database cleanup reaches the Auth phase does the Firebase client delete its own login. No Firebase Auth administrator privilege is added to the Preview runtime. If interrupted, the closed account sees a dedicated continuation screen on sign-in; it cannot re-provision its profile. The browser performs at most 20 batches per pass. Larger histories, rate limiting, network failures or an expired recent-login window can require Continue deletion, reauthentication or operator recovery.

The completion page states which records remain and that photos are cleaned separately. Listings may remain visible until the listing batches finish; contact, mutation and ordinary photo access stop when the closure marker commits. Downloaded copies/screenshots cannot be recalled by deleting storage.

## Photo cleanup

The cleaner defaults to dry-run and supports only demo-quadmart or quadmart-development. Actual provider deletion is enabled only for development through the CLI. It considers registered media at least 24 hours old. This settling period is for abandoned uploads/retries; it is not a legal retention period.

Every candidate must have the exact server-generated public ID under quadmart/<project>/<hashed-owner>/<media-id>. Unknown paths, missing timestamps, blocked media and recent uploads are held. The cleaner transaction checks live listings, private listing archives and all report snapshots, including resolved reports. Any reference preserves the photo. A claim changes its registry status to deleting before calling Cloudinary; listing creation cannot attach a claimed photo. Upload finalization now checks both account state and pending registry state transactionally.

Cloudinary deletion uses authenticated image type and requests CDN invalidation. Only confirmed ok/not-found results allow the registry to become a minimal deleted tombstone. Provider failure leaves a resumable claim. A crash after provider deletion can safely retry. Tombstones preserve request/digest identity so an old upload request cannot recreate a removed object. Provider invalidation can take time; the application endpoint already refuses claimed/deleted media.

A scan returns at most 25 candidates and a nextCursor. Follow the cursor to avoid repeatedly scanning old tombstones; restart from the beginning on a later maintenance sweep. Accounts and media tombstones, retry ledgers, reputation/history and moderation records are deliberately not purged automatically.

## Operator maintenance

Use Node 22 and the existing Firebase CLI login. The script refuses production and mismatched emulator settings. The operator's Firebase CLI authorization remains local; no token is printed or copied to Vercel. It uses the installed firebase-tools token helper, so test compatibility when upgrading that dependency.

Examples (dry-run unless --apply is present):

```sh
npm run maintenance -- --project quadmart-development --action account --uid ACCOUNT_UID
npm run maintenance -- --project quadmart-development --action account --uid ACCOUNT_UID --apply
npm run maintenance -- --project quadmart-development --action missing-auth --uid ACCOUNT_UID
npm run maintenance -- --project quadmart-development --action missing-auth --uid ACCOUNT_UID --apply
npm run maintenance -- --project quadmart-development --action media
npm run maintenance -- --project quadmart-development --action media --cursor MEDIA_ID
npm run maintenance -- --project quadmart-development --action media --media MEDIA_ID --apply
```

Account maintenance requires an existing deletion request and processes at most 20 batches per invocation. It can finish a failed/interrupted Auth deletion and mark the job complete; an already-removed login is treated idempotently. A normal successful browser deletion leaves the checkpoint at auth until operator reconciliation confirms it is gone.

Missing-auth mode handles a login removed outside QuadMart's flow. It positively checks Firebase Auth: only auth/user-not-found qualifies. Network/permission failures never authorize cleanup. It checks the existing private profile/campus and queues the same closure flow only with --apply. Active-moderator and malformed-profile cases require manual review. Run account maintenance after queueing. Firebase clients can call their own Auth delete API directly; there is no deployed Auth-deletion trigger in this Spark setup.

Photo --apply requires the existing restricted development CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the process environment. Load them using an approved local secret mechanism; never paste them into command arguments, source, logs or a public environment variable. Pass --media for a specifically reviewed asset or --cursor to page a reviewed sweep. The folder restriction and exact namespace check both apply.

Set XDG_CONFIG_HOME when using a custom Firebase CLI cache; QUADMART_FIREBASE_CLI_CONFIG can point to an existing private CLI config file. Emulator account maintenance requires both loopback Auth and Firestore emulators. The scripts print only job stage/outcome and candidate IDs, not profile contents or credentials.

## Scheduling and remaining limits

The local development worker and six-hour Codex schedule are described in [Scheduled maintenance and backups](SCHEDULED-MAINTENANCE-AND-BACKUPS.md). It captures a verified encrypted Firestore backup before bounded account/photo sweeps and records failures. It depends on the Mac/app being available and is not an always-on service. No paid service, additional runtime IAM grant, automatic evidence erasure or production deployment was added. Independent monitoring, off-device and Auth/photo recovery, and a retention policy remain launch requirements. Do not broaden the web runtime's privileges merely to bypass these operational requirements.

## Validation

Run test:cleanup together with rules, uploads, safety, abuse, observability, credentials and production HTTP integration. Scenarios include stale/forged deletion requests, moderator protection, concurrent closure/publication, multi-page recovery, preserved counterpart records, Auth failures, missing-Auth reconciliation, media references, grace periods, exact project paths, provider retries, concurrency and upload completion after closure.

References: [Firebase client deletion and recent authentication](https://firebase.google.com/docs/auth/web/manage-users#delete_a_user), [Firebase Admin user management](https://firebase.google.com/docs/auth/admin/manage-users), [Cloudinary deletion](https://cloudinary.com/documentation/delete_assets), [Cloudinary CDN invalidation](https://cloudinary.com/documentation/invalidate_cached_media_assets_on_the_cdn).
