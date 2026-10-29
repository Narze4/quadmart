# Abuse limits and operational logs

Development implementation, October 29, 2026. These controls are preparation for a student pilot, not a launch-readiness or complete denial-of-service guarantee.

## Enforced budgets

Every verified, supported-university request to `/api/market` consumes an attempt before body parsing or business validation. Unauthenticated/unverified requests do not allocate quota documents. Per-operation budgets count only committed changes. Counters live in private Firestore documents shared by all server instances; the operation and its debit commit in one transaction.

| Per-account operation | Per UTC minute | Per UTC day |
| --- | ---: | ---: |
| Market API attempts, including failed requests/retries | 120 | 2,000 |
| Photo upload attempts, including invalid files/retries | 20 | 80 |
| Authenticated photo requests | 120 | 1,000 |
| New listings | 6 | 20 |
| Reservation/availability changes | 30 | 300 |
| New conversations | 10 | 50 |
| New messages | 30 | 500 |
| Actual profile changes/initialization | 10 | 50 |
| Saved-item changes | 30 | 300 |
| Notification acknowledgement batches (up to 30 IDs) | 20 | 200 |

These are fixed windows, so adjacent-window bursts are possible. A 429 response includes `Retry-After`, `retryAfterSeconds`, and a readable wait time. Counts do not reset by deleting a listing, signing out, changing the client clock, or changing server instances. Separate accounts have separate limits, plus the shared development ceilings below. One document per account/bucket stores current counters; this does not create a new document every minute.

Existing upload budgets (10/minute, 20/day/account, 200/day/development) and new-report budgets (5/day/account) remain in place with their own retry messages. Sales and reviews are bound to valid, unique trades and also consume the general API attempt budget. Safety actions consume that general budget too; students who hit it must wait before another API action. It does not block local sign-out.

## Shared development ceilings and bounded reads

Market API attempts also share 600/minute and 6,000/day across accounts. Upload attempts share 60/minute and 400/day; photo requests share 600/minute and 6,000/day. Account and shared counters are checked and committed atomically. If either is exhausted neither counter is debited. Upload attempts are counted before MIME validation/body reads/decoding/storage. Photo requests are counted before asset lookup and Cloudinary download. Invalid photo IDs and unverified callers are rejected before creating a counter.

These ceilings protect expensive work after verification. They are not spending guarantees: failed token checks, rejected counter reads and authorized direct Firestore reads still consume resources. An attacker can exhaust a shared ceiling and deny legitimate users until the next window; these conservative values are for development and require pilot traffic review.

Firestore list rules now require a positive limit and reject nonzero offsets: listings, profiles, reviews and transactions cap at 25; conversations and messages at 31; notifications at 100. Cursors preserve pagination. Single-document reads retain the same authorization. This prevents one unlimited query, not repeated authorized queries or scraping over many pages.

Photo 429s retain a retry control that waits for Retry-After and requires an explicit click. There is no automatic retry loop. Message rate limits preserve the draft. See ABUSE-AND-PHONE-TEST-RESULTS.txt for earlier browser coverage and PHONE-ACCEPTANCE-CHECKLIST.txt for physical-device checks. The phone suite also tests interrupted saved requests, actual saved/notification quota rejection and recovery, and notification ownership isolation.

A Vercel Hobby rule named "Development API burst limit" is saved and enabled: exact host `quadmart-git-security-firestore-rules-narze4s-projects.vercel.app`, request path starting `/api/`, 300 requests per IP per 60-second fixed window, returning 429. No upgrade or new paid service was enabled. It covers that alias only, not every immutable deployment URL. Two bounded external probes followed Vercel sign-in redirects and therefore did not test rate-limit enforcement. A direct no-redirect probe confirmed HTTP 302 to vercel.com. Keep preview access protection enabled and verify authenticated edge rejection before relying on this rule for invitations. Shared campus networks may need a different IP threshold for a pilot.

References: [Firestore query rules](https://firebase.google.com/docs/firestore/security/rules-query), [Vercel rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

## Listing and retry contract

`listingCreate` accepts only title, description, numeric price, supported category/condition, up to five distinct registered photo IDs, and a stable request ID. The backend derives seller, campus, status, time and photo URLs. It reads every photo inside the transaction, checking readiness, exact URL, owner and campus.

A private retry record binds the request ID to normalized contents. Identical concurrent retries return one listing and debit once, including when the listing quota is exhausted. Reusing the ID with different contents is a conflict. Replaying a deleted or moderator-removed listing cannot recreate it. Retry records must not be removed by a future cleanup job while retries could resurrect a listing. The form retains the request ID for unchanged contents during retries in the same mounted form; refreshing/closing the tab loses that in-memory state.

`listingState` accepts active/reserved, the version the seller saw, and a stable request ID. It checks ownership and campus, rejects sold/removed listings, and updates the version atomically. Identical completed retries succeed; stale tabs cannot overwrite a later status. Existing listings without a version start at zero. The UI shows errors and refreshes listings after a conflict.

Rules deny direct listing creation/updates and profile-name edits, so direct SDK calls cannot bypass these server limits. Owners may still directly delete their own unsold listing; this grants no quota refund. Saved-item changes and notification acknowledgements are server-only too. Each uses the general API attempt budget, plus an atomic change budget. Saves accept only a listing ID and desired boolean state, validate same-campus availability on addition, cap membership at 200 even under concurrency, and permit removal of missing legacy entries. Acknowledgements validate ownership of every requested notification before changing any flag, reject more than 30 input IDs, and preserve all other fields. Identical unchanged actions do not rewrite records or consume their change budget; they still consume the general API attempt budget. The client scopes these actions to the account that initiated them and shows readable 429 feedback. This is desired-state idempotence, not an ordering guarantee between opposing actions from different tabs.

Unchanged profile initialization performs no profile writes or operation debit. Message and conversation retries preserve their existing deterministic IDs and skip the operation debit after validating access. Blocked/suspended accounts still cannot replay operations to escape enforcement.

## Diagnosing a failure

1. Ask for the displayed reference or the `X-Request-ID` from the failed response, plus the approximate time and action. Never request a password, token, full private chat or signed photo URL.
2. In Vercel, select the QuadMart development Preview deployment and open runtime Logs. Search for the request ID. Each `quadmart_api` entry includes a generated request ID, route, allowlisted operation name, HTTP status and duration. Server failures include only an allowlisted dependency code or `internal`.
3. Repeated 429s indicate an account or shared budget was reached. Do not raise or reset limits before checking the expected usage. Repeated 5xx responses require checking Firebase/Cloudinary availability and the deployment configuration, then reproducing with synthetic accounts locally.
4. Verify a fix with the emulator tests and a development Preview check before considering production rollout.

Application log records deliberately omit actor IDs, emails, message/listing/report text, request bodies, URLs, tokens, arbitrary exception messages and stacks. Response bodies and headers use private/no-store. Upload and photo routes use the same projection. Provider/platform access logs are separate and must be reviewed before launch; this projection does not control logs emitted by infrastructure or third-party libraries.

No external alert service, notification recipient, billing change or automatic monitor was configured. Runtime logs provide diagnostics but nobody is automatically paged. Agree on support ownership, review cadence, retention, alert thresholds and a response process before invitations.

## Test and rollout commands

Run `npm run test:abuse`, `npm run test:observability`, `npm run test:rules`, `npm run test:uploads`, `npm run test:safety`, `npm run test:credentials`, `npm run test:integration`, and `npm run lint`. CI includes all these checks plus the production dependency audit. Server validation scenarios replaced obsolete client-creation tests; a smaller rules-test count reflects moving validation to the actual write boundary.

Deploy Firestore rules explicitly to `quadmart-development` and deploy the matching Preview code. Old open browser tabs must reload; old clients using direct listing writes will be denied by the tightened rules. No index changes are needed for this milestone. Production `quadmart-4410f` and `main` remain outside this development rollout.

## Remaining limits

Verified attackers can still incur token-verification, rejected-request and Firestore quota-read costs. Signup and direct authorized reads are outside the API attempt budgets. Saved-item updates and notification read markers now pass through the protected API. Direct authorized reads are size-bounded but not frequency-limited. App Check/CAPTCHA evaluation, authenticated edge enforcement testing, monitoring/alerts, physical-phone testing and the student eligibility/support policy remain invitation gates. Pagination and encrypted backup/restore plus Mac-hosted maintenance have separate implemented workflows; their latest receipts and drill results must be checked before launch. The Mac must be awake and available. The deletion and cleanup tools are documented in ACCOUNT-AND-PHOTO-CLEANUP.md. Cloudinary and Firebase service quotas also apply.
