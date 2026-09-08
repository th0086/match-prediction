---
owner: platform
status: draft
updated_at: 2026-05-14
---

# Local Development

## Local MongoDB

Connection string:
- `mongodb://localhost:27017/matchprediction?authSource=admin`

## Environment Variables

Local development uses app-specific env files:

- `backend/.env` for NestJS backend settings
- `frontend/.env.local` for Next.js frontend settings

Recommended setup:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Backend keys:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `SUPER_ADMIN_PHONE`
- `SUPER_ADMIN_PASSWORD`
- `DATA_ADMIN_PHONE`
- `DATA_ADMIN_PASSWORD`
- `DATA_PIN`
- `BOOTSTRAP_STRICT_MODE`
- `NODE_ENV`
- `ADMIN_IP_ALLOWLIST`
- `CORS_ALLOWED_ORIGINS`
- `MERCHANT_KE7STG_CALLBACK_URL`
- `MERCHANT_KE7PROD_CALLBACK_URL`

Frontend keys:

- `NEXT_PUBLIC_API_BASE_URL`

Root `.env` is reserved for Docker/VM deployment and is not the primary local frontend env source.

## Super Admin Bootstrap

On backend startup:
1. Check whether a super admin account exists.
2. If not, create from environment variables.
3. If yes, skip creation.

Default fallback values:

- `SUPER_ADMIN_PHONE=+254700000001`
- `SUPER_ADMIN_PASSWORD=ChangeMe123!`

## Data Admin Bootstrap

On backend startup:
1. Check local account by `DATA_ADMIN_PHONE`.
2. If not found, create a `data_admin` account.
3. If found, enforce role `data_admin` and ensure permission `data:read` exists.

Default fallback values:

- `DATA_ADMIN_PHONE=+254700000002`
- `DATA_ADMIN_PASSWORD=Alan0922318405`
- `DATA_PIN=1234`

## Admin/Data Access Notes

- `super_admin` can access both Admin and Data pages.
- `data_admin` can access only Data page and Data APIs.
- Data APIs do not use IP allowlist guard.
- Admin management APIs still require admin permissions and keep existing access restrictions.

## Dev Run Strategy (Planned)

- Root command starts frontend and backend together.
- Frontend default: single-screen game page.
- Backend default: REST API + polling updates in V1.

## Test Commands

- `npm run test:e2e:wallet`
  - Runs deterministic end-to-end validation for jackpot split, wallet crediting, and wallet credit history API.

## Confirmed V1 Decisions

- OTP: disabled for V1.
- Realtime mode: polling-first.
- Polling interval: fixed at 5 seconds.
- Jackpot remainder after floor split: platform retained.
- Access token renewal: frontend auto-refreshes once on 401 and retries original request.
- Permission feedback: frontend uses unified handling for 403 responses.
