---
owner: operations
status: draft
updated_at: 2026-05-21
---

# Admin Playbook

## Access Model

- Admin entry appears in frontend only for users with `admin:access`.
- Data entry appears in frontend for users with `data:read`.
- Admin users can still access frontend game as regular players.
- `super_admin` can access both Admin and Data pages.
- `data_admin` can access Data page only.

## Primary Admin Actions (V1)

1. Update jackpot increment amount (KES per second).
2. Update YouTube live source.
3. Trigger or import draw result (MVP path).
4. Review draw history and entry states.

## Permission Matrix (Draft)

- `admin:access`: show admin entry in frontend
- `draw:manage`: modify jackpot increment and draw operations
- `live:manage`: update YouTube live configuration
- `users:read`: read player and entry overview
- `data:read`: access prediction records and invite status data views

## Data Endpoints

- `GET /api/data/winners`
- `GET /api/data/winners/csv`
- `GET /api/data/invite-stats`
- `GET /api/data/invite-stats/csv`

Data endpoints require JWT + `data:read` permission and do not apply IP allowlist guard.

The initial Data PIN defaults from `DATA_PIN` on first bootstrap and falls back to `1234` if the env value is missing or invalid.

## Operational Notes

- Changes to live config should propagate quickly to frontend.
- Jackpot increment changes must be auditable.
- Winning notifications for `super_admin` are handled internally and skip external callback confirmation API.
- Rule 6 matching logic cannot be overridden from admin UI.
