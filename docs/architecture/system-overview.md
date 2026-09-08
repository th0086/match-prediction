---
owner: backend-frontend
status: draft
updated_at: 2026-04-22
---

# System Overview

## Stack

- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Database: MongoDB
- Auth: JWT + Refresh Token

## Primary Goals

- Single-screen game experience in English UI
- Shared account identity for frontend and backend
- Permission-gated admin entry inside frontend
- Auto-bootstrap one super admin account on startup
- YouTube IFrame Player API in the first page section

## High-Level Modules

- `frontend`: UI, auth pages, game interaction, role-aware navigation
- `backend`: auth, users/roles, admin controls, lottery logic, config
- `shared`: common DTO/types/constants for contract consistency

## Data Flow (Initial)

1. User logs in with Kenyan phone number.
2. Frontend stores access token and refreshes via refresh token endpoint.
3. Frontend requests eligibility, draw, jackpot, and profile data.
4. Backend calculates game state, enforces Rule 6 validity window, and returns statuses.
5. Admin updates draw interval and YouTube live config from admin endpoints.

## Rule-Critical Behaviors

- Entry validity starts from the next complete draw after current draw.
- Entry remains valid for four complete draw results.
- Overlapping sequential combinations across current result are invalid.
- Non-winning completed lifecycle status is `Expired`.
- Jackpot sharing among winners uses floor division.
