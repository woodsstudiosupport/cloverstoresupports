# Migration and compatibility

The published `registry.json` was used as the authoritative source. Its 17 named apps and blank historical row are retained, with `developerId` added only to named entries. All pre-existing fields remain equal. `reviews.json` and historical `apps/*.json` files are not modified by this migration.

The `apps/` directory contains known stale copies, a test listing absent from the published registry, and a non-JSON `apps/Test.json` containing `Null`. Rebuilding the registry from that directory would change published descriptions/developer labels and may restore removed listings. The validator intentionally validates the published catalogue and new submissions, not every historical file. Reconcile historical copies separately with a reviewed migration if desired.

Two published rows put a boolean `isBuiltin` inside `downloads`; the unnamed `id: "null"` row is also invalid under the new-app schema. These exact historical rows are fingerprinted in `compatibility.json`, ignoring the additive developerId field. A changed row no longer matches its exception and must be corrected before publication. The allowlist is maintainer-managed; never regenerate it from incoming submissions. The historical `test` review group is preserved although its app is not published.

Old clients can keep reading the original arrays/objects and ignore additional fields. New clients should use stable developer IDs, skip unnamed placeholders, treat non-string download values as invalid, and use neutral fallbacks when profile artwork is missing. Do not infer a verified developer or an APK signer from the label text or package prefix.

A new approved app publication updates both the registry row and the matching `apps/<id>.json`; it merges omitted existing metadata rather than dropping newer optional fields. Reviews are appended with a stable issue-based submission ID. Active publishers are serialized, but issue approvals are not a durable queue; if a queued run is cancelled or a writer races the push, retry the still-open issue after checking the latest state.
