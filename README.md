# The Halal Pharmacy

**The Halal Pharmacy** is a desktop-first, fully offline Point of Sale (POS) and inventory management software designed for pharmacy owners.

Built using **Svelte 5**, **Tailwind CSS v4**, **shadcn-style UI components**, and **Dexie IndexedDB**, it seamlessly manages medicine sales, stock inventories, and sales auditing without requiring an internet connection.

---

## Key Features

1. **Sale Page (POS)**
   - Search medicines by **Generic Name**, Brand Name, or Strength.
   - Live cart calculation, item quantity adjustments, and anonymous quick checkout.
   - **Bill Hold**: Put active sales on hold with custom notes/identifiers and resume them anytime.
   - Printable receipt generation with invoice reference codes.

2. **Dashboard**
   - Live financial analytics: Today's Revenue, Completed Bills, Items Sold.
   - Inventory statistics: Total active stock items, Low Stock alerts (< 10 units), and Expiring Soon items.
   - Recent transaction logs and top-selling medicine rankings.

3. **Add Medicine**
   - **Auto Mode**: Search Bangladeshi medicine catalogue sourced from MedEx (`29MayStudio/MedEx`) to auto-populate brand name, dosage form, manufacturer, and generics. Just enter strength, unit price, expiry month, and stock quantity.
   - **Manual Mode**: Completely custom medicine entry for custom generics, strengths, pricing, and initial stock.

4. **Sales Records**
   - Detailed transaction audit trail.
   - Search by invoice code or medicine name, filter by date and payment method (Cash, Card, Mobile Banking).
   - Void/Refund option with automatic stock restoration into local inventory.
   - CSV Export for accounting reports.

5. **Settings & Day/Night Mode**
   - Toggle between **Day Mode** (Light) and **Night Mode** (Dark).
   - **MedEx Database Refetch**: Manual refetch button to download the latest Bangladeshi medicine dataset from GitHub.
   - Automatic background schedule checking to refetch every 7 days.
   - Sample medicine seed and database clear/reset tools.

---

## Tech Stack & Data Source

- **Framework**: [Svelte 5](https://svelte.dev) + Vite
- **Database**: [Dexie.js](https://dexie.org) (IndexedDB wrapper for local browser storage)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Icons**: [Lucide Svelte](https://lucide.dev)
- **Data Source**: [29MayStudio/MedEx](https://github.com/29MayStudio/MedEx) (`list.json`)

---

## Development & Usage

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Type Checking & Verification
```bash
npm run check
```

### 4. Build for Production
```bash
npm run build
```

---

## License

MIT
