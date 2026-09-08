# Match Prediction Architecture (Living Document)

Last updated: 2026-06-25
Status: Draft v0.1

## 1. Purpose

This file is the source of truth for project organization and system boundaries.
It must be updated whenever architecture-impacting changes are made.

## 2. Product/Technical Scope (V1)

- Single-screen frontend experience in English.
- Stack: TypeScript + Next.js + NestJS + MongoDB.
- Shared account identity across frontend and backend.
- Admin entry inside frontend, visible only to authorized users.
- One super admin account auto-created at backend startup.
- Match-prediction homepage uses split jackpot tabs to switch jackpot, invite info, and matches while sharing vote history and rules.
- Admin can manage split tabs and assign each match to exactly one split tab.

## 3. Organization Structure

Planned repository structure:

```text
mouse-lottery/
	README.md
	package.json
	docs/
		README.md
		architecture/system-overview.md
		product/game-spec.md
		product/game-spec-zh.md
		api/endpoints.md
		operations/local-dev.md
		admin/admin-playbook.md
		changelog/CHANGELOG.md
	frontend/                  # Next.js app (to be implemented)
	backend/                   # NestJS app (to be implemented)
	shared/                    # Shared types/contracts (to be implemented)
	architecture.md            # This living document
```

Current repository now includes baseline `frontend/`, `backend/`, and `shared/` scaffolding.

## 4. Domain Boundaries

### 4.1 Frontend (Next.js)

- Render single-screen game sections.
- Handle login/register UX and Kenyan phone normalization.
- Show/hide admin entry based on permission payload.
- Render split-tab navigation above the jackpot section.
- Display split-tab-specific jackpot, invite reward copy, prediction chances, and published matches.
- Keep vote history and rules shared across split tabs.

### 4.2 Backend (NestJS)

- Auth module: register/login/refresh.
- User and role module: shared account identity and RBAC.
- Admin module: split tab CRUD, match/team management, settlement, operational controls.
- Prediction module: match prediction locking, split-tab-aware payout split, wallet crediting, jackpot reset.
- Split-tab module: owns tab configuration, champion-tab bootstrap migration, and jackpot scope mapping.
- Bootstrap: auto-create super admin if absent.

### 4.3 Database (MongoDB)

- Persist users, matches, teams, predictions, split tabs, jackpot state, payout ledger, configuration, and audit fields.
- User records now also persist per-split-tab fixed-chance usage state.
- Local test URI:
	`mongodb://localhost:27017/matchprediction?authSource=admin`

## 5. Rule Ownership

Business-rule authority lives in backend services:

- Eligibility threshold: 500 KES daily wager.
- Re-selection cooldown: 30 minutes.
- Entry validity: each ticket is bound to one target issue (next draw sequence).
- Overlapping sequential combinations crossing current result are invalid.
- Non-winning terminal status: `Expired`.
- Jackpot split strategy: floor division among winners.
- Match display and jackpot settlement are scoped by split tab; vote history remains user-scoped across all tabs.
- Wallet currency is `KES`; wallet increases only from payout credit in current phase.
- Each account can read its own wallet credit ledger (payout history).
- Each split tab jackpot resets to that tab's configured base amount immediately after settlement.
- Each successful invite increases every split tab jackpot by that tab's configured invite amount.
- Split tabs can use one of two chance models:
	- Shared mode: uses the existing account-level accumulated prediction chances.
	- Fixed mode: uses a split-tab-specific fixed prediction count and does not gain invite-based extra chances.
- Each match belongs to exactly one split tab and settles against only that tab's jackpot pool.

Frontend only visualizes and guides users; it must not be source of truth for winning logic.

## 6. Auth and Permission Model

- Authentication: JWT access token + refresh token.
- Authorization: role/permission checks at backend endpoint layer.
- Frontend admin entry visibility depends on permission `admin:access`.
- Admin account may also place entries as a player.

## 7. Split Tab Strategy

- Split tabs are first-class backend entities stored in `split_tabs`.
- Backend bootstraps a default split tab named `Champion` during rollout migration.
- Existing matches without `splitTabId` are migrated into `Champion`.
- The legacy single prediction jackpot is migrated into the `Champion` split-tab jackpot scope.
- Frontend persists the currently selected split tab in the page query string via `tab=<splitTabId>`.

## 8. Event/Data Flow

1. User signs up or logs in with Kenyan phone number.
2. Backend returns access/refresh tokens, wallet profile data, and per-split-tab chance snapshots.
3. Frontend loads public game state for the active split tab: tab list, selected-tab jackpot, and selected-tab matches.
4. User switches split tabs; frontend reloads only split-tab-specific state while keeping vote history and rules shared.
5. User selects a team for a published match and confirms the prediction.
6. Backend validates the match's split tab, then consumes either shared chances or that split tab's fixed chances.
7. When an admin settles a match, backend evaluates winners for that match, splits only the owning split tab jackpot, credits wallets, records payout rows, and resets that split tab jackpot back to its base amount.
8. When an invite-success callback arrives, backend increments every split tab jackpot by that tab's configured invite amount; shared-mode tabs also keep the existing account-level invite chance behavior.
9. Frontend reflects updated jackpot, remaining chances for the selected tab, and wallet balance changes.

## 9. Architecture Decision Log (ADL)

### ADL-001
- Decision: Shared account model for frontend and backend.
- Reason: prevent identity divergence and simplify permission checks.

### ADL-002
- Decision: Admin entry shown inside frontend, permission-gated.
- Reason: unified product entry while preserving access control.

### ADL-003
- Decision: Super admin auto-bootstrap on startup.
- Reason: deterministic initialization for fresh environments.

### ADL-004
- Decision: Rule 6 enforced server-side only.
- Reason: avoid client drift and cheating vectors.

### ADL-005
- Decision: OTP is deferred (not in V1).
- Reason: reduce implementation risk and ship password-based baseline first.

### ADL-006
- Decision: Realtime delivery starts with polling.
- Reason: lower complexity for first implementation milestone.

### ADL-007
- Decision: Jackpot split remainder is retained by platform.
- Reason: aligns with product-side payout policy.

### ADL-008
- Decision: Frontend polling interval is fixed at 5 seconds for V1.
- Reason: predictable update cadence during MVP rollout.

### ADL-009
- Decision: Frontend retries protected API calls once after automatic refresh token renewal on 401.
- Reason: keep user sessions seamless while preserving short-lived access tokens.

### ADL-010
- Decision: Frontend emits a unified forbidden-event path for 403 responses.
- Reason: provide consistent permission feedback across pages.

### ADL-011
- Decision: Refresh-token renewal is guarded by a single-flight lock in frontend client.
- Reason: avoid duplicate refresh calls when multiple requests fail with 401 simultaneously.

### ADL-012
- Decision: Frontend uses a global toast hub for auth/session/permission feedback.
- Reason: unify UX feedback across pages and reduce duplicated inline handling.

### ADL-013
- Decision: Draw results and betting tickets are persisted in MongoDB with explicit issue sequence numbers.
- Reason: support deterministic history/audit and issue-bound settlement logic.

### ADL-014
- Decision: Ticket settlement is single-issue based; unmatched ticket after corresponding issue draw is marked `Expired`.
- Reason: align game behavior with issue-centric draw model and simplify user expectations.

### ADL-015
- Decision: Re-betting in the same issue invalidates previous pending ticket as `Voided`.
- Reason: ensure one effective active ticket per user per issue while preserving audit trail.

### ADL-016
- Decision: Every account has a KES wallet (`walletBalanceKES`, `walletCurrency`) persisted on user profile.
- Reason: support deterministic payout crediting and post-login wallet visibility.

### ADL-017
- Decision: Draw number stream remains globally shared, while ticket and win history remain strictly user-scoped.
- Reason: preserve single-source draw fairness and keep player history isolated.

### ADL-018
- Decision: Winning settlement groups simultaneous winners by shared winning-sequence timestamp, applies floor split, credits wallets, and resets jackpot to zero per winning settlement.
- Reason: guarantee multi-winner fairness and enforce immediate post-win jackpot reset policy.

### ADL-019
- Decision: Settlement prefers Mongo transactions when available and falls back to non-transaction mode on standalone MongoDB.
- Reason: keep local development functional while preserving stronger consistency in replica-set deployments.

### ADL-020
- Decision: Jackpot accumulation uses a fixed elapsed-time rule of `123 KES` per second.
- Reason: keep accumulation deterministic and remove operational parameter drift.

### ADL-021
- Decision: Wallet credit history is exposed as a user-scoped ledger endpoint.
- Reason: players must be able to audit personal payout credits independently.

### ADL-022
- Decision: Match prediction jackpot is split-tab scoped instead of globally shared.
- Reason: each admin-defined tab needs its own jackpot pool, invite amount, and match visibility.

### ADL-023
- Decision: Existing single-jackpot data is migrated into a default split tab named `Champion`.
- Reason: preserve current production behavior while moving the system to mandatory split tabs with no legacy fallback.

### ADL-024
- Decision: Split tabs support two chance modes: shared accumulated chances or fixed split-tab-specific chances.
- Reason: product needs some tabs to use invite-driven shared allowances while others use a fixed prediction cap.

### ADL-025
- Decision: A successful invite increments every split tab jackpot by that tab's configured invite amount.
- Reason: jackpot growth must stay aligned across all tab pools while allowing different invite contribution values per tab.

### ADL-026
- Decision: Fixed-mode split-tab chance consumption is enforced with atomic MongoDB updates instead of read-modify-save writes.
- Reason: prevent lost-update races that could allow more predictions than a tab's fixed limit under rapid or concurrent requests.

## 10. Living Update Protocol

When implementation changes architecture, update this file in the same change set:

1. Update "Last updated" date.
2. Add/modify ADL entries when decisions change.
3. Keep section 3 (Organization Structure) aligned with real folders.
4. Keep section 5 (Rule Ownership) aligned with backend implementation.
5. Append cross-reference links in [docs/README.md](docs/README.md) if new docs are added.

## 11. Open Questions

No blocking architecture questions at this stage.
