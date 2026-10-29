# Marketplace and message loading

The marketplace previously read only the newest 100 active campus listings and applied all filters to that truncated set. Chat detail also stopped at the newest 100 messages; the inbox listened to every conversation.

The marketplace now loads up to 24 matching listings per action, using document-snapshot cursors and an explicit document-ID tie breaker. Category and condition are database filters; newest/price ordering happens in Firestore across the entire matching collection. Title substring and price-range matching preserve the existing behavior. Because Firestore does not provide substring search, a request scans at most four 25-document batches. An empty batch can still have a continuation cursor. The screen says that only the current batch is empty and offers Continue searching; it reports a complete search only after the cursor reaches the end. A dedicated search service remains a future improvement for larger campuses.

Filter changes are debounced by 300 ms and replace the feed. In-flight responses from the old filter, identity or retry cannot populate the new results. Failed additional pages retain existing results and their cursor; retry does not duplicate items. An invalid price range is shown before results. Listing totals describe loaded results, not an invented total for the campus.

The inbox and conversation view keep a live head of 30 items (31 queried for lookahead), then fetch older pages on demand. Timestamp ties use document IDs, and duplicate items are merged by ID. When new activity moves the live boundary, the visible cache stays within the number of requested pages. A burst/disconnect with no overlap resets the window and discards in-flight old-history pages so a hidden gap cannot be skipped. Loaded history can be fetched again from the new cursor. A complete live result removes obsolete cached entries.

Conversation history preserves the scroll offset when older messages are inserted. New messages follow the bottom only when the reader was already near it or just sent a message. Conversation changes remount the view so names, draft/send state and message history do not carry between threads. Access failures clear retained private messages and show recovery instructions. No campus, verification, participant, block or suspension rule was weakened.

`npm run test:pagination` runs the controller and query tests. `npm run test:integration` now includes the browser regression after the buying/selling HTTP checks, using the same production build and isolated emulators; install Chromium with `npx playwright install chromium` for local use. CI installs Chromium and its Linux dependencies. Optional screenshots go only to `QUADMART_SCREENSHOT_DIRECTORY`.

Validation uses pure controller tests for retries/races/live rollover, Firestore emulator tests with more than 100 listings and tied timestamps, and a browser regression against synthetic local data. New development composite indexes cover category/condition combinations with newest and both price orders, plus participant/last-message inbox order. Confirm index readiness before publishing a deployment that uses these queries.

This pass covers marketplace, inbox and chat history. Dashboard search, notifications, seller listings, purchases and profile reviews still need their own query/pagination review; do not claim that all application reads are bounded. Existing write quotas and the full buying/selling checks remain in place.

Reference: [Firestore document-snapshot cursors](https://firebase.google.com/docs/firestore/query-data/query-cursors), [ordering and limits](https://firebase.google.com/docs/firestore/query-data/order-limit-data).
