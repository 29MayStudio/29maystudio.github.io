# AGENTS.md - Developer & Agent Instructions

## Overview
**M/S A.B.S Knit Fabrics Data Management System** is a desktop-focused data entry and tally record web application designed for a knitting factory. Built using **Svelte 5**, **TypeScript**, **Tailwind CSS v4**, and **Dexie IndexedDB**, it operates 100% offline in browser storage.

## Core Features & Architecture

### Stack
- **Framework**: Svelte 5 (`runes` reactive syntax like `$state`, `$derived`, `$effect`, snippets, snippet props)
- **Styling**: Tailwind CSS v4 with custom font (`SolaimanLipi`) and dark mode theme (AMOLED pure black)
- **Local Database**: IndexedDB managed via `Dexie` (`src/lib/db.ts`)
- **Icons**: `@lucide/svelte`

### Key Features
1. **Client Tally Data Entry (`HomePage.svelte`)**:
   - Autocomplete client search and selection.
   - Dual full-screen side-by-side tally grid view (Received Tally | Delivered Tally).
   - Date-wise sorting (oldest date on top, newest date on bottom).
   - Dynamic multi-item yarn entry form for received and delivered challans.
   - `?` column question icon popover with **Edit** and **Delete** options.
   - Edit modal popup for updating past entries and item rows.
   - Custom modal popups for all confirmation dialogs.
   - **Statement**: Highlighted button beside client name title to open a date-range popup dialog and print a clean A4 Landscape statement chart with 6mm margins, client name on top and two charts side-by-side.

2. **Data Management (`AddPage.svelte`)**:
   - Add and manage registered Clients, Yarn Types, and Dias.
   - Color-filled action buttons and delete confirmations powered by custom modal dialogs.

3. **All Records & Audit Logs (`RecordsPage.svelte`)**:
   - Minimalist audit trail table supporting multi-item challan breakdowns.
   - Uses 12-hour format with AM/PM (`hh:mm:ss AM/PM`) on screen and in exports.
   - Search by client, date filter, type filter (Received/Delivered).
   - Excel (`.xlsx`) export feature.

### Verification Commands
Before committing or submitting changes, run:
```bash
# Type check and Svelte diagnostics
npm run check

# Production build check
npm run build
```
