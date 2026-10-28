# Reporting, blocking and moderation

## Student controls

Report a listing or user from a listing, profile or conversation. A report requires a reason and 10-2000 characters of detail. Conversation reports include the last ten messages from that conversation; the API verifies that the reporter and reported account are both participants. Listing title/description/price/photo IDs are captured at report time. Reports and evidence are accessible only through the moderator API, never directly through Firestore. Reporters see a limited status/outcome in Safety center; reported users do not receive reporter identity or evidence.

Reports use idempotent request IDs, one open report per reporter/target, and a transactional budget of five new reports per UTC day. After a report is resolved, a new incident may be reported. This is a conservative development limit, not complete abuse prevention.

Blocking prevents conversation creation, messages in both directions (including existing conversations) and new trades between the accounts. Checks occur inside the transaction which writes the operation. Existing conversation history and completed-trade reviews remain available as records. Only the blocker can remove their block, through the Safety center or the same safety controls. Blocking does not hide every public campus listing or remove past reviews.

## Moderator access

The server checks a private moderators/<uid> document with active=true and campusIds containing the actor's verified campus. Normal clients cannot read/write roles, reports, block records, moderation events or archives. A token claim, profile field or client-side button does not grant authority. Role revocation takes effect on the next API request without a token refresh. The initial development role belongs only to the verified owner account and is limited to Emory. No role-management endpoint is exposed in the app.

The /moderation page is linked from the account menu for moderators. Queue reads are campus-scoped and paginated, 25 reports per page. Decisions require a 10-1000 character note. Optimistic report versions reject stale decisions. Every decision appends a moderationEvents record with actor, target, report, action, note, version and server timestamp. Moderator accounts and self-moderation require separate owner review and cannot be suspended through this interface.

Actions:

- Close without action: resolve the report, retaining evidence and the decision.
- Remove listing: atomically move its current contents to removedListings, delete the public document and block its registered photos. Its seller cannot recreate that document ID. Moderators can still view reported photos for review.
- Restore listing: restore the private archive only if it belongs to that decision and no live replacement exists. Photos remain blocked while another removal also references them.
- Suspend account: set server-owned account state. All market operations, direct Firestore marketplace access, uploads and ordinary photo delivery check suspension even with an existing verified token. Existing listings are not automatically archived; moderators must review/remove them separately. Photos owned by suspended accounts are withheld from ordinary viewers.
- Reinstate account: reverse only the suspension associated with that report. Another suspension cannot accidentally be cleared by an older decision.

Suspension is application-level; it does not delete or disable the Firebase Auth account. A suspended user can still authenticate to see the restriction and contact support. The active app observes its own restriction document. Already viewed/downloaded data cannot be recalled.

## Development deployment and tests

Uses only quadmart-development and the protected security/firestore-rules Vercel Preview. Firestore rules include server-owned moderation paths and suspension checks. Two reports indexes support reporter history and the moderator queue; verify READY in the cloud because emulators do not enforce composite indexes.

Run npm run test:safety (11 scenarios), npm run test:rules (44 scenarios), npm run test:uploads (13 scenarios), and npm run test:integration (63 checkpoints). The last command builds and exercises the production HTTP routes with disposable local Auth/Firestore emulators. Test fixtures never require production credentials. CI also runs lint, credential tests and the production dependency audit.

The safety tests exercise concurrent reporting limits, evidence access, block enforcement, forged roles, role revocation, suspension/reinstatement, stale decisions, archived listing restoration and overlapping photo removals. The HTTP flow verifies report -> decision -> denial -> restoration end to end.

## Before inviting students

Define prohibited items, escalation/appeal handling, response expectations and report retention with the founding team. Confirm who monitors the support inbox. Server spam budgets and privacy-safe operational logs are implemented (see ABUSE-AND-OPERATIONS.md). Edge protection, automatic alerts, cleanup scheduling/retention (see ACCOUNT-AND-PHOTO-CLEANUP.md), pagination outside the moderation queue, backup/restore preparation, production migration and final phone/pilot testing remain separate launch tasks. Do not treat this development implementation as production launch approval.
