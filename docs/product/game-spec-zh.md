---
owner: product
status: draft
updated_at: 2026-04-22
---

# Mouse Lottery 遊戲規格（中文）

## 單頁區塊順序

1. Header（登入 / 註冊）
2. YouTube Live（IFrame Player API）
3. Progressive Jackpot
4. 開獎號碼展示
5. 選號區
6. 資格審查
7. Did You Win
8. How to Play

## 肯亞電話格式

可接受：
- `+2547XXXXXXXX`
- `07XXXXXXXX`（自動轉換）
- `+2541XXXXXXXX`
- `01XXXXXXXX`（自動轉換）

錯誤訊息：
- `Please enter a valid Kenyan mobile number.`

## 資格規則

- 當日 Wezabet 現金下注滿 `500 KES`。
- 未達門檻時，選號區顯示遮罩與差額提示。

## 選號規則

- 從 `0-9` 選 4 碼。
- 按鈕：`Clear`、`Confirm`。
- 每 30 分鐘可重選，舊選號失效。

## 中獎與狀態

- 需在有效區間內與完整四碼開獎結果完全一致。
- 套用 Rule 6（自下一組完整開獎起算，往後四組完整結果有效）。
- 未中獎最終狀態為 `Expired`。

## Jackpot 與分帳

- Jackpot 每經過 1 秒固定增加 `123 KES`。
- 單位：`KES`。
- 前端數字 10 秒平滑追值，期間若有新值持續延展。
- 多人中獎以 floor 方式分帳。
