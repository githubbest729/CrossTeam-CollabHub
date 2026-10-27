# CrossTeam CollabHub PWA
Offline-first SCADA cross-team hub (Al Gurg Automation and Controls, Dubai).

Run: serve this folder over HTTPS or localhost (`python -m http.server 8080`) and open http://localhost:8080.

v2 adds: new-project modal, archive manager (restore), searchable/paginated vault with preview/download/delete, project switcher, readable dependencies, QA sign-off, resolved-blocker history, storage analytics, backup reminder, demo reset.

v4: real seeded engineering files (CSV/JSON/SQL) with searchable preview, hours/AED logging, blocker project column+filter, synced milestone status/checklists, readable store names, QA/HSE printable sign-off certificate.

v5: wider layout, compact action icons + hash badges, dark scrollbars, seeded files stored as IndexedDB chunks, styled file pickers, status-coloured selects, workflow map, guided tour, settings drawer, mobile card tables.

Modules: Dashboard, Asset Vault (OPFS/IndexedDB, SHA-256, tag inspector), Milestones, Blockers, QA/HSE Gate (Annexure-SCT-HR-001), Data (archive, gzip snapshot export/import).
Storage: IndexedDB `CollabHubDB_v1`, `navigator.storage.persist()`, quota bar. Snapshots exclude binary attachments.
Note: the service worker uses root-relative `/icons/*` static routing; adjust if hosted in a sub-path. Set real package fingerprints in `.well-known/assetlinks.json` if wrapping as TWA.
