# PCW Eats - Local Machine Setup & Architecture Guide

This canteen management ERP is built with a modern **Full-Stack Architecture**:
- **Backend**: Express.js REST API server with real-time Server-Sent Events (SSE) and Hardware Bridge.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS.
- **Biometric Integration**: ZKTeco MB360 Fingerprint & Facial Recognition Terminal integration over Port 4370.

---

## 1. Quick Start (Running on Your Local Machine)

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **yarn**

### Step-by-Step Instructions

1. **Clone or Download the Repository**:
   ```bash
   git clone <repo-url>
   cd <project-folder>
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Unified Full-Stack Application**:
   ```bash
   npm run dev
   ```

4. **Open in Browser**:
   Visit [http://localhost:3000](http://localhost:3000)

Both the **Express REST API backend** (`/api/*`) and the **React frontend** run simultaneously on port 3000 with zero cross-origin configuration required.

---

## 2. Structured Architecture Overview

```
├── server.ts                       # Main unified Express + Vite entry point
├── server/                         # Backend Application Layer
│   ├── db/
│   │   ├── store.ts                # In-memory & JSON file-backed data store
│   ├── services/
│   │   └── zktecoService.ts        # ZKTeco MB360 device bridge & SSE event emitter
│   └── routes/
│       ├── index.ts                # Central API router hub (/api)
│       ├── items.ts                # Stock-keeping vs Ready-made catalog (/api/items)
│       ├── batches.ts              # Daily fresh ready-made batches (/api/batches)
│       ├── meals.ts                # Meal types & eligibility windows (/api/meals)
│       ├── quotas.ts               # Department quotas & balances (/api/quotas)
│       ├── canteens.ts             # Canteen terminals & locations (/api/canteens)
│       ├── inventory.ts            # Perpetual stock control (/api/inventory)
│       ├── transactions.ts         # Issuing meals & snacks (/api/transactions)
│       ├── zkteco.ts               # Biometric hardware endpoints (/api/zkteco)
│       └── reports.ts              # Monthly cost breakdown & stats (/api/reports)
└── src/                            # Frontend Application Layer
    ├── lib/
    │   └── api.ts                  # Modular, strongly typed frontend API client
    ├── components/
    │   ├── BiometricReaderWidget.tsx# Reusable ZKTeco MB360 biometric UI component
    │   ├── CanteenInterface.tsx    # POS Tablet terminal (Meals & Snacks issuing)
    │   ├── AdminDashboard.tsx      # Executive metrics & department costs
    │   ├── ItemManagement.tsx      # Items CRUD
    │   ├── MealManagement.tsx      # Meal schedules
    │   ├── QuotaManagement.tsx     # Department quotas
    │   ├── Reports.tsx             # Audit reports & CSV export
    │   └── Sidebar.tsx             # Main navigation & hardware status
    └── types.ts                    # TypeScript shared interfaces
```

---

## 3. How "Issue Meals" Works

### How it works right now (Without Fingerprint Machine Configured):
1. Navigate to **Canteen Terminal** → **Issue Meals**.
2. There is a single, clean input field: **Employee / User ID**.
3. You can type an Employee ID (e.g. `EMP001`, `EMP002`, `EMP003`, `EMP004`) or click any of the **Quick Test ID** chips provided under the field.
4. Press **Enter** or click **Search**:
   - The system queries the employee record to verify their name and department.
   - It checks meal eligibility for the current meal window (e.g., Lunch - 12:00 to 14:30).
5. Click **Confirm & Issue**:
   - The transaction is recorded in the backend store (`POST /api/transactions/issue-meal`).
   - The transaction logs the date, timestamp, employee, department, and meal cost (LKR 250).
   - An instant confirmation banner confirms the meal was issued.
   - The input field automatically clears and re-focuses, ready for the next person.

### How it works when you connect your Fingerprint Machine:
- **Zero Technical Clutter on the POS Screen**: Canteen staff never need to see IP addresses, ports, or hardware diagnostics.
- **Direct ID Capture**: In real-world canteen environments, fingerprint scanners (USB biometric readers, barcode scanners, or attendance terminals with keyboard emulation) operate in **HID / Keyboard Wedge mode**.
- When an employee places their finger on the reader:
  1. The fingerprint machine verifies the biometric template and outputs the corresponding Employee ID (e.g., `EMP001`) into the focused field.
  2. The reader automatically sends an `Enter` key signal.
  3. The system instantly resolves the employee and displays their eligible meal card for 1-click confirmation or auto-issuance.
- If using an Ethernet-based device, the device IP is configured in `.env` / backend service; canteen staff only ever interact with the clean User ID field.

---

## 4. Key Business Logic

### Ready-Made Items (Zero-Overnight Carryover)
- Items like **Spicy Fish Bun**, **Crispy Fish Roll**, and **Vegetable Samosa** are fresh daily deliveries.
- **Do not map to department quotas**: They are tracked as daily batches.
- **End-of-Day Clearance**: Unsold units cannot be carried over to the next morning. Clicking "End-of-Day Clearance" records waste and zeroes out remaining stock.

### Stock-Keeping Items
- Items like **Ceylon Milk Tea**, **Coffee**, and **Biscuits** track perpetual warehouse stock and deduct from monthly department quota balances.

---

## 5. Easy to Modify and Extend

1. **Adding a New Database Model**:
   - Add the interface in `src/types.ts`.
   - Add the collection and helper methods in `server/db/store.ts`.
2. **Adding a New API Route**:
   - Create `server/routes/myFeature.ts`.
   - Mount it in `server/routes/index.ts` via `apiRouter.use('/myFeature', myFeatureRouter)`.
3. **Calling From Frontend**:
   - Add the fetch helper in `src/lib/api.ts`.
   - Call it in any React component using `await api.myFeature.getData()`.
