---
owner: product
status: draft
updated_at: 2026-04-22
---

# Mouse Lottery Game Spec (EN)

## Layout Order (Single Screen)

1. Header (Log In / Sign Up)
2. YouTube Live Section (IFrame Player API)
3. Progressive Jackpot
4. Drawn Numbers Display
5. Select Numbers
6. Eligibility Verification
7. Did You Win
8. How to Play

## Phone Number Validation (Kenya)

Accepted input formats:
- `+2547XXXXXXXX`
- `07XXXXXXXX` (auto-convert)
- `+2541XXXXXXXX`
- `01XXXXXXXX` (auto-convert)

Validation error message:
- `Please enter a valid Kenyan mobile number.`

## Eligibility

- User must wager at least `500 KES` cash on Wezabet for the day.
- If ineligible, selection area is masked and shows remaining amount needed.

## Number Selection

- Choose 4 digits from `0-9`.
- Actions: `Clear`, `Confirm`.
- Re-selection allowed every 30 minutes; old selection becomes invalid.

## Winning and Lifecycle

- Winning requires exact 4-digit match in valid draw window.
- Rule 6 applies (next complete draw start, valid for following four complete draws).
- Non-winning final status: `Expired`.

## Jackpot

- Jackpot increases by `123 KES` per elapsed second.
- Display unit: `KES`.
- Frontend number animation catches up smoothly within 10 seconds.
- If new target arrives during animation, extend and continue toward latest target.

## Payout

- Jackpot is split equally among winners using floor division.
