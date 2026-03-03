# 2DotInventory — Accounts Module

Offline-first Accounts module for inventory management. Built with **React**, **Express**, **SQLite**, and **Tailwind CSS**.

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Development Mode

Open two terminals:

```bash
# Terminal 1 — Backend (port 3456)
cd server
npm run dev

# Terminal 2 — Frontend (port 5173, proxied to backend)
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

**Default Login:** The default admin password changes daily based on the current date. For February 15, 2026, the password is `admin13`.

### 3. Production Build

```bash
# Build frontend
cd client
npm run build

# Start server (serves React build)
cd ../server
npm start
```

Open **http://localhost:3456** in your browser.

---

## Architecture

```
2Dot-Inventory/
├── server/                   # Express Backend
│   ├── src/
│   │   ├── index.js          # Entry point
│   │   ├── db/database.js    # SQLite setup & migrations
│   │   ├── repositories/     # Data access layer
│   │   ├── services/         # Business logic
│   │   ├── controllers/      # Request handlers
│   │   ├── routes/           # Route definitions
│   │   └── middleware/       # Error handler
│   └── data/                 # SQLite database (auto-created)
│
├── client/                   # React Frontend
│   ├── src/
│   │   ├── App.jsx           # Router
│   │   ├── api/              # API client
│   │   ├── components/
│   │   │   ├── auth/         # Login page, ProtectedRoute
│   │   │   ├── layout/       # Sidebar, AppLayout
│   │   │   ├── dashboard/    # Dashboard page
│   │   │   ├── parties/      # Customer/Supplier CRUD + Ledger
│   │   │   ├── payments/     # Payment entry
│   │   │   ├── receipts/     # Receipt preview + print
│   │   │   ├── reports/      # Outstanding & Statement reports
│   │   │   ├── settings/     # Store profile, receipt config, password management
│   │   │   └── ui/           # Shared components (PartyAutocomplete, Modal, etc.)
│   │   └── utils/            # Helpers, export utilities, authentication
│   └── dist/                 # Production build output
```

## Features

- **Authentication** — Simple frontend-based authentication with daily auto-generated admin password + optional custom password
- **Enter Key Navigation** — All form inputs support Enter key to move to the next field for faster data entry
- **Dashboard** — Overview cards, top outstanding, recent transactions
- **Customers / Suppliers** — Full CRUD with search, opening balance, searchable party selector with keyboard navigation (arrow keys + Enter)
- **Payments** — Record credits/debits with partial payment support, auto receipt generation
- **Receipt Preview** — Professional printable receipt (A4 / Thermal), configurable via Settings
- **Reports** — Outstanding balances & Statement of Account, export to Excel (.xlsx) and PDF
- **Settings** — Store profile, GST, receipt layout configuration, password management
- **Offline-First** — All data stored in local SQLite, no internet required

---

## Authentication

The system uses a simple frontend-based authentication mechanism:

### Default Admin Password

The default password is automatically generated daily based on the current date using the formula:
```
admin[(day[0]+month[0])-(|day[1] - month[1]|)]
```

**Examples:**
- February 15, 2026 (15/02): `admin13` — calculation: (1+0)-(|5-2|) = 1-3 = 13
- January 23, 2026 (23/01): `admin31` — calculation: (2+0)-(|3-1|) = 2-2 = 31
- December 9, 2026 (09/12): `admin12` — calculation: (0+1)-(|9-2|) = 1-7 = 17

### Custom Password

In addition to the default admin password, you can set a custom password in **Settings → Password Configuration**. Both passwords will work for login.

- Default password **cannot be changed** and is always available
- Custom password is optional and can be added/removed at any time
- Both passwords are stored locally in the browser's localStorage

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Headless UI, Heroicons |
| Backend | Node.js, Express 4 |
| Database | SQLite via better-sqlite3 |
| Export | ExcelJS (Excel), jsPDF + jspdf-autotable (PDF) |
| Notifications | react-hot-toast |

---

## Keyboard Shortcuts

### Enter Key Navigation

All forms support **Enter key navigation** for faster data entry:

- **Party Creation Form:** Name → Phone → Place → Address → Opening Balance → Submit
- **Payment Entry Form:** Party Selector → Date → Type → Amount → Reference → Notes → Submit
- **Party Autocomplete:** Use **Arrow Up/Down** to navigate suggestions, **Enter** to select, **Escape** to close

### Shortcuts Reference

| Key | Action |
|-----|--------|
| **Enter** | Move to next field (or submit if on last field) |
| **Arrow Down** | Navigate to next item in party selector dropdown |
| **Arrow Up** | Navigate to previous item in party selector dropdown |
| **Escape** | Close party selector dropdown |

---

## Balance Calculation Logic

The system uses **different calculation formulas** for customers vs suppliers:

### For Customers (They owe us)

```
Current Balance = Opening Balance - Credits + Debits
```

- **Opening Balance (Positive)**: Amount the customer owes us
- **Credit**: Payment received from customer → **reduces** their debt
- **Debit**: Sale on credit to customer → **increases** their debt

**Example:**
- Opening Balance: ₹10,000 (customer owes us)
- Credit ₹3,000 (they paid) → Balance: ₹7,000
- Debit ₹2,000 (sold on credit) → Balance: ₹9,000

### For Suppliers (We owe them)

```
Current Balance = Opening Balance + Credits - Debits
```

- **Opening Balance (Positive)**: Amount we owe the supplier
- **Credit**: Purchase on credit from supplier → **increases** what we owe
- **Debit**: Payment made to supplier → **reduces** what we owe

**Example:**
- Opening Balance: ₹5,000 (we owe them)
- Credit ₹2,000 (purchased on credit) → Balance: ₹7,000
- Debit ₹1,000 (we paid them) → Balance: ₹6,000

---

## Password Formula Explained

The default admin password uses a date-based calculation:

```javascript
day[0]    = First digit of day   (e.g., 15 → 1)
day[1]    = Second digit of day  (e.g., 15 → 5)
month[0]  = First digit of month (e.g., 02 → 0)
month[1]  = Second digit of month (e.g., 02 → 2)

Password = "admin" + (day[0] + month[0]) + |day[1] - month[1]|
```

This ensures the password changes daily while remaining predictable for authorized users who know the current date.

---

## License

© 2026 2Dot Solutions. All rights reserved.
