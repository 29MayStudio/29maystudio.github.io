# AGENTS.md - Developer & Agent Instructions

## Overview
**The Halal Pharmacy** is a desktop-focused Point of Sale (POS) and inventory management web application built using **Svelte 5**, **TypeScript**, **Tailwind CSS v4**, and **Dexie IndexedDB** for 100% offline usage.

## Architecture Guidelines

### Core Stack
- **Framework**: Svelte 5 (`runes` reactive syntax like `$state`, `$derived`, `$effect`, and snippet props)
- **Styling**: Tailwind CSS v4 with custom CSS variables for light/dark themes
- **Local Database**: IndexedDB managed via `Dexie` (`src/lib/db.ts`)
- **Icons**: `@lucide/svelte`

### Data Flow & Offline Storage
All core operations work fully offline:
1. **MedEx Dataset (`catalog`)**: Synced from `https://raw.githubusercontent.com/29MayStudio/MedEx/refs/heads/main/list.json`. Auto-refetched every 7 days or manually via Settings.
2. **Local Stock (`inventory`)**: Contains medicines added either via Auto Mode (from MedEx dataset) or Manual Mode.
3. **Sales History (`sales`)**: Stores complete anonymous transaction logs, receipts, payment methods, and timestamps.
4. **Held Bills (`heldBills`)**: Holds active cart states for delayed completion.

### Verification Commands
Always verify changes before committing:
```bash
# Type check and Svelte diagnostics
npm run check

# Production build check
npm run build
```

### File Structure
- `src/lib/db.ts`: Dexie schema models and tables.
- `src/lib/sync.ts`: MedEx catalog fetch, parsing, and auto 7-day refetch logic.
- `src/lib/components/ui/`: Reusable UI components inspired by shadcn-svelte.
- `src/lib/components/`:
  - `SalePage.svelte`: Sale POS view with generic name search and Bill Hold.
  - `DashboardPage.svelte`: Metrics, revenue, low stock & top seller widgets.
  - `AddMedicinePage.svelte`: Auto (MedEx) and Manual stock entry forms.
  - `RecordsPage.svelte`: Audit logs, CSV exports, receipt modal, and refunds.
  - `SettingsPage.svelte`: Theme toggle, refetch trigger, seed data & database reset.
