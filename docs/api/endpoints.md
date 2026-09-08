---
owner: backend
status: draft
updated_at: 2026-05-21
---

# API Endpoints (V1 Draft)

## Auth

### POST /auth/register
- Purpose: Register with Kenyan phone number and password.
- Auth: Public
- Request: `{ phone, password }`
- Response: `{ user: { id, phone, role, permissions, walletBalanceKES, walletCurrency }, accessToken, refreshToken }`
- Error Cases: invalid phone format, duplicate phone.

### POST /auth/login
- Purpose: Login with shared account.
- Auth: Public
- Request: `{ phone, password }`
- Response: `{ user: { id, phone, role, permissions, walletBalanceKES, walletCurrency }, accessToken, refreshToken }`
- Error Cases: invalid credentials.

### POST /auth/refresh
- Purpose: Rotate access token.
- Auth: Refresh token
- Request: `{ refreshToken }`
- Response: `{ user: { id, phone, role, permissions, walletBalanceKES, walletCurrency }, accessToken, refreshToken }`
- Error Cases: expired/invalid refresh token.

### GET /auth/me
- Purpose: Return active profile and permissions.
- Auth: Access token
- Response: `{ id, phone, role, permissions, canAccessAdmin, walletBalanceKES, walletCurrency }`

## User/Game

### GET /game/state
- Purpose: Return live game state payload for frontend.
- Auth: Public
- Response:
	- `jackpot: { amount, currency }`
	- `draw.stream`: latest pushed numbers (today)
	- `draw.history`: per-day number history
	- `resultPolicy`: runtime behavior metadata

### POST /game/entries
- Purpose: Submit 4-digit selection.
- Auth: User
- Request: `{ numbers: [n1,n2,n3,n4] }`
- Response: `{ id, numbers, status, placedAt, validFrom, expiresAt }`
- Notes: users can place multiple entries on the same day; all same-day entries remain valid and settle independently until `23:59:59` UTC.

### GET /game/my-entries
- Purpose: Return my recent entries and settlement outcome.
- Auth: User
- Response item: `{ id, numbers, status, payoutKES, placedAt, validFrom, expiresAt, settledAt, winningSequenceEndedAt, createdAt }`

### GET /game/my-wallet-credits
- Purpose: Return my wallet credit ledger (payout history).
- Auth: User
- Response item: `{ id, entryId, settlementKey, jackpotBeforeSplitKES, winnerCount, payoutKES, settledAt, currency }`

### POST /game/push
- Purpose: Ingest one draw number from external feed/simulator.
- Auth: Public (operational endpoint)
- Request: `{ date, created_at, port, data: { sn, number, timestamp } }`
- Response: `{ id, number, receivedAt, dayKey }`
- Settlement behavior:
	- Evaluates pending eligible entries.
	- Settles simultaneous winners together by winning-sequence timestamp.
	- Splits jackpot via floor division, then each winner receives one-tenth of the split amount.
	- Credits winner wallets (`walletBalanceKES`).
	- Resets jackpot to `0` on winning settlement.
	- If no winners, jackpot continues accumulating.
	- Accumulation increment is configurable from admin (`jackpotIncrementAmount`, KES per second).
	- Winning notification callback is skipped when the winner role is `super_admin`.

## Admin

- Access policy: Admin management APIs are restricted by IP allowlist.
- Production default allowlist: only source IP `178.128.217.196` can access admin management routes.
- Config: `ADMIN_IP_ALLOWLIST` supports comma-separated IPs.
- Local development: when `NODE_ENV` is not `production`, loopback IPs (`127.0.0.1`, `::1`) are additionally allowed for local testing.

### GET /admin/me
- Purpose: Return admin permissions for frontend visibility.
- Auth: Admin permission `admin:access`

### GET /admin/jackpot-increment
- Purpose: Read current jackpot increment setting.
- Auth: Admin permission `draw:manage`
- Response: `{ jackpotIncrementAmount }`

### PATCH /admin/jackpot-increment
- Purpose: Update jackpot increment setting.
- Auth: Admin permission `draw:manage`
- Request: `{ amount }`

### GET /admin/live-config
- Purpose: Read live runtime config.
- Auth: Admin permission `live:manage`
- Response: `{ youtubeVideoId, liveOverlayEnabled, realtimeMode, pollingIntervalSeconds }`

### PATCH /admin/live-config
- Purpose: Update YouTube live source settings.
- Auth: Admin permission `live:manage`
- Request: `{ youtubeVideoId?, liveOverlayEnabled? }`

### GET /admin/winners
- Purpose: Query winner list for admin reporting.
- Auth: Admin permission `draw:manage`
- Query (optional): `limit`, `offset`, `from` (ISO datetime), `to` (ISO datetime)
- Response: `{ total, limit, offset, items[] }`
- Response item includes: `{ phone, winningNumber, winningTime, payoutKES, jackpotBeforeSplitKES, winnerCount, settlementKey, settledAt, entryId, userId }`

### GET /admin/winners/csv
- Purpose: Download winner list as CSV.
- Auth: Admin permission `draw:manage`
- Query (optional): `from` (ISO datetime), `to` (ISO datetime)
- CSV columns: `phone, winningNumber, winningTime, payoutKES, jackpotBeforeSplitKES, winnerCount, settlementKey, settledAt, entryId, userId`

### POST /admin/draws
- Purpose: Insert/trigger draw result (MVP simulation).
- Auth: Admin permission `draw:manage`

## Notes

- Contracts will be aligned with shared types in `shared/` once implementation starts.
- Rule 6 validation is authoritative on backend.
- Floor-split remainder is retained by platform.
