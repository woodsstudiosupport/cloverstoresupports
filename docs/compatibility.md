# Catalogue consistency

The published registry contains 17 named apps. Each has a matching, complete `apps/<id>.json` record, including its stable developer ID. The validator checks both representations so they cannot silently drift apart.

Historical per-app records were preserved under `archive/previous-app-records/` before reconciliation. Three source records that were never in the published registry—Arcade, Testbuilt and Test—were moved to `archive/unpublished-apps/`. They were not silently republished. The review group for the unpublished Test app remains under `archive/reviews.json`; published-app review groups remain in the root reviews file.

The old unnamed placeholder is archived rather than displayed as an app. The misplaced boolean `downloads.isBuiltin` values for Core Library and the dock overlay were moved to the root `isBuiltin` field. Download maps now contain only URL strings. No named published app or published-app review was removed.

`compatibility.json` now has empty legacy exception lists: the active catalogue passes strict validation without grandfathered malformed rows. Historical records are not read by store clients and are excluded from active catalogue validation.

Missing developer profile artwork remains unspecified rather than being presented as an official logo. `catalogue.json.profileDefaults` supplies generic local icon/banner assets for compatible clients. These defaults do not imply publisher verification.

The publishing workflow stages both the updated registry and its per-app record, then validates the complete result before committing. Review retries use issue-based submission IDs. If a queued run is cancelled or a writer races a push, review the latest state and retry the still-open issue. Client features and backend services remain subject to the feature roadmap.
