# M/S A.B.S Knit Fabrics — Data Management System

**M/S A.B.S Knit Fabrics Data Management System** is a desktop-first, fully offline tally record and data entry application tailored for knitting factory operations.

Built with **Svelte 5**, **TypeScript**, **Tailwind CSS v4**, and **Dexie IndexedDB**, it enables seamless tracking of received yarn bags and delivered fabric rolls per client without requiring an internet connection.

---

## Key Features

1. **Client Tally Data Entry (Home Screen)**
   - **Client Autocomplete Search**: Fast search bar with client suggestions.
   - **Side-by-Side Dual View**: Received Tally and Delivered Tally grids separated by a central dividing line.
   - **Date-Wise Sorting**: Records are sorted chronologically by date (oldest at the top, newest at the bottom).
   - **Multi-Item Entry**: Form to log multiple yarn items in a single challan with automatic bag/roll and total weight calculations.
   - **Question Mark Popover**: Hover/click options in the `?` column providing **Edit** and **Delete** actions.
   - **Edit Popup**: Modify past entries, challan numbers, and item rows in a popup modal.
   - **Custom Confirmation Modals**: Replaces native browser dialogs for all deletion confirmations.
   - **Statement & A4 Landscape Printing**: Highlighted `Statement` button beside client headline to select a date range and print a clean side-by-side A4 Landscape statement chart with 6mm margins.

2. **Data Management (Add Screen)**
   - Manage registered **Clients**, **Yarn Types**, and **Dias**.
   - Color-filled action buttons and input validation with duplicate checks.

3. **All Records & Audit Logs (Records Screen)**
   - Minimalist spreadsheet audit trail of all received and delivered challans.
   - Displays 12-hour timestamps (`hh:mm:ss AM/PM`) for all log entries.
   - Direct breakdown display for multi-item challans.
   - Filter by client name, entry date, or transaction type (Received / Delivered).
   - **Excel (.xlsx) Export**: Download audit logs with 12-hour time formatting for offline reporting and accounting.

---

## Tech Stack

- **Framework**: [Svelte 5](https://svelte.dev) + Vite
- **Database**: [Dexie.js](https://dexie.org) (IndexedDB wrapper for local browser storage)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Icons**: [Lucide Svelte](https://lucide.dev)
- **Typography**: Custom `SolaimanLipi` font family

---

## Development & Build Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Type Checking
```bash
npm run check
```

### 4. Production Build
```bash
npm run build
```

---

## License

MIT
