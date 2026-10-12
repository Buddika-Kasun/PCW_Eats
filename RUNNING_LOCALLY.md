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
│   │   └── store.ts                # In-memory & JSON file-backed data store
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

## 3. ZKTeco MB360 Biometric Reader Integration

### Hardware Specifications
- **Device Model**: ZKTeco MB360 (Multi-Biometric Time Attendance & Access Control)
- **Modalities**: Fingerprint, Facial Recognition, RFID ID Card, PIN
- **Default Port**: `4370` (TCP/UDP)
- **Comm Key**: `0` (default)

### How It Works

```
+---------------------+           +---------------------+           +---------------------+
|  ZKTeco MB360 Device|  TCP:4370 | Express Backend     |   SSE     | Browser POS Terminal|
|  (Local LAN IP)     | --------> | (zktecoService.ts)  | --------> | (Biometric Widget)  |
|  Employee scans     |           | Resolves User ID    |           | Auto-populates emp# |
|  fingerprint        |           | from enrolled DB    |           | & validates meal    |
+---------------------+           +---------------------+           +---------------------+
```

### Physical Connection Steps:
1. **Network Cable**: Connect the MB360 to your local router or switch using a standard Ethernet cable (CAT5/CAT6).
2. **Assign Static IP on MB360**:
   - On the device physical keypad, press **M/OK** to enter the menu.
   - Go to **Comm.** > **Ethernet**.
   - Set **IP Address**: e.g., `192.168.1.201` (ensure this matches your subnet).
   - Set **Subnet Mask**: `255.255.255.0`.
   - Set **Gateway**: e.g., `192.168.1.1`.
3. **Configure the Web App**:
   - In the **Issue Meals** screen or the **Biometric Reader Widget**, click the ⚙️ **Settings** icon.
   - Enter your device's IP (e.g., `192.168.1.201`) and Port (`4370`).
   - Click **Save & Apply**.
4. **Testing Without Hardware**:
   - Use the built-in **Test Finger Scan** button or select any enrolled employee from the dropdown.
   - The system immediately simulates the exact punch packet and verifies meal eligibility.

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
