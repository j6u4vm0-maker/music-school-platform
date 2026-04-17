# 專案名稱：RhythmFlow Studio OS (音樂補習班營運系統)

## 1. 專案背景與目標
* **規模：** 服務 70 人以上的中大型音樂教室。
* **核心價值：** 透過自動化流程解決複雜的排課與金流分潤，降低行政人力成本。

## 2. 技術架構 (Tech Stack)
* **前端框架：** Next.js (App Router), Tailwind CSS.
* **後端平台：** Firebase (Auth, Firestore, Storage, Hosting).
* **關鍵設定：** - `src/lib/firebase.ts`: Firebase 初始化與服務匯出。
  - `.env.local`: 存放 Firebase API Key 與環境變數。

## 3. 核心商業邏輯 (Business Rules) - **AI 必須嚴格遵守**
### A. 金流與儲值
* **專款專用：** 學生儲值（例如 4 堂課）時，必須同時指定「老師 ID」與「樂器名稱」。
* **遞延收入：** 儲值金先存在補習班帳戶，狀態為「預收」，尚未分潤給老師。

### B. 階梯計價 (Tiered Pricing)
* **組合定價：** 價格由「老師 + 樂器」決定。同老師不同樂器可能有不同價格。
* **多堂優惠：** 一次購買超過 X 堂課，單價會下降。
* **約束條件：** 優惠方案僅限「同老師、同樂器」湊單，不可跨老師或跨樂器。

### C. 結算與扣款
* **觸發點：** 僅在行事曆標記「已完課」或「當日取消」時執行扣款。
* **分潤逻辑：** 扣除學生堂數後，立即計算老師分潤並記錄至老師收益。
* **取消規則：** 學生當日臨時取消，系統「仍須扣除堂數」並給予老師分潤。

## 4. Firestore 資料結構摘要 (Schema)
* `users`: 包含 `role` (admin, staff, teacher, student)。
* `service_rates`: 儲存老師與樂器的階梯價位表。
* `wallets`: 學生帳戶下的子物件，記錄各組合的剩餘堂數與餘額。
* `bookings`: 行事曆預約紀錄，包含 `status` (pending, completed, cancelled_charge)。

## 5. 開發慣例 (Coding Standards)
* **金流安全：** 所有涉及金額變動的邏輯，必須封裝在後端或受 Security Rules 保護。
* **組件化：** UI 使用 Shadcn/ui 风格，保持簡潔。
* **省 Token 模式：** 回覆請精簡，優先提供邏輯修正與程式碼片段。