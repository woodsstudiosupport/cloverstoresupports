# Future developer portal

This change prepares catalogue data and a moderated issue workflow. It does not deploy a website, sign-in service, APK storage service, review API, reporting API, notification service or device pairing.

## Publishing flow

1. A developer signs in to the portal through a server-controlled identity provider.
2. The server associates their authenticated account with one or more stable developer IDs. Repository/profile display names are not an authentication mechanism.
3. They edit profile artwork/links and app listings, upload release artefacts to approved storage, and inspect validation errors in a draft workspace.
4. The server checks developer ownership, required metadata, file size/checksums, APK package/version/signers where applicable, compatibility claims and permitted URLs. Supplier exceptions are maintained separately by Woods Studio.
5. A submission enters a moderation queue. Approved changes are committed with an expected branch/file SHA; conflicts are retried against current data, never resolved by blindly replacing the whole catalogue.
6. The published JSON feeds Clover Store and developer pages. Rejections have a reason and draft history. Maintain an audit trail for publication, profile ownership, review moderation and verification changes.

Use a GitHub App installed only on the catalogue repository, with the smallest needed repository permissions. Its credentials belong on the server. Never ship GitHub write tokens or App private keys in an APK, HTML, JavaScript bundle, public JSON or a public issue. Public issues are visible to everyone; never submit credentials, private contact data or unpublished confidential artefacts there.

The backend must enforce authenticated ownership and server-side moderation/validation even if the browser already validates fields. Restrict artefact size/types and protect URL-fetching/inspection workers from SSRF and untrusted APK parsing. Add abuse controls, quotas and request limits before public registration. Choose durable artefact storage rather than relying on a developer's temporary download URL.

## Required services before connected features are enabled

- Review create/edit/delete: authenticated or carefully designed anonymous identity, per-app limits, moderation and deletion rules; repository data is the public output, not the authentication database.
- Developer follows/notifications: local-only follows can work without a server; cross-device follows and push delivery need consent, account storage and unsubscribe controls.
- Reports: authenticated/rate-limited intake, private moderation data and a response process. Do not publish sensitive reports directly to the catalogue.
- Cross-device handoff: explicit device pairing, scoped permissions, delivery acknowledgement, revocation and account recovery.
- Portal status: authenticated drafts, queued/rejected/published states and audit history. A GitHub issue number alone does not prove profile ownership.

These endpoints are explicitly `null` in `catalogue.json.services`. Clients must present unavailable states until real endpoints exist. Changing a URL to non-null alone does not implement a service.

## Maintainer approval today

App, developer and review issues may be published after a write/maintain/admin collaborator adds `approved`. The workflow checks the actor, parses one JSON block without executing it, validates data/relationships, commits, pushes, then acknowledges publication. Verification and supplier policy cannot be set through submission payloads. Other data such as release metadata can be added through reviewed pull requests using the documented schemas.

Ensure repository Actions settings permit the workflow's requested content/issue permissions. Branch protection may require replacing direct workflow pushes with a PR-based publisher later; do not disable branch protection just to make publication succeed. If approval fails, keep the issue open, inspect logs and retry after correcting the issue. This repository does not automatically merge metadata pull requests.
