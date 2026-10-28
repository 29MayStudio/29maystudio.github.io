# Comprehensive Guide: Converting M/S A.B.S Knit Fabrics System into a Tauri v2 Windows Desktop App

This guide provides step-by-step instructions to convert the existing web application into a **Tauri v2** desktop application for Windows (`.exe` and `.msi`), while maintaining dual support for both web browser deployment (via IndexedDB) and desktop deployment (via native SQLite).

---

## Table of Contents
1. [Overview & Architecture](#1-overview--architecture)
2. [Prerequisites](#2-prerequisites)
3. [Step 1: Install Dependencies](#step-1-install-dependencies)
4. [Step 2: Create Tauri Configuration Files](#step-2-create-tauri-configuration-files)
5. [Step 3: Dual Database Adapter Layer (IndexedDB + SQLite)](#step-3-dual-database-adapter-layer-indexeddb--sqlite)
6. [Step 4: Update package.json Scripts](#step-4-update-packagejson-scripts)
7. [Step 5: GitHub Actions Workflow for Windows Build (.exe / .msi)](#step-5-github-actions-workflow-for-windows-build-exe--msi)
8. [Step 6: Running & Building Locally](#step-6-running--building-locally)

---

## 1. Overview & Architecture

The application is designed to function seamlessly across two environments:

- **Web Mode (Browser / GitHub Pages)**: Uses **Dexie.js** (IndexedDB) for client-side offline storage.
- **Desktop Mode (Tauri v2 Application)**: Uses **Tauri SQL Plugin** (`@tauri-apps/plugin-sql` with SQLite) for fast native performance on Windows.

A **Database Adapter Layer** auto-detects whether the app is running inside a Tauri window or standard browser, exposing a unified interface (`db`) so Svelte UI components require no code changes.

---

## 2. Prerequisites

For local development on Windows, install the following:

1. **Node.js** (v20 or higher)
2. **Rust Toolchain**: Install via [rustup.rs](https://rustup.rs/) (select `x86_64-pc-windows-msvc`).
3. **C++ Build Tools**: Download Visual Studio Installer and install **Desktop development with C++**.
4. **WebView2**: Pre-installed on Windows 10 & 11.

---

## Step 1: Install Dependencies

Run the following commands in your project root:

```bash
# Install Tauri CLI as a development dependency
npm install -D @tauri-apps/cli@latest

# Install Tauri frontend API and SQL plugin
npm install @tauri-apps/api@latest @tauri-apps/plugin-sql@latest
```

---

## Step 2: Create Tauri Configuration Files

Create a directory named `src-tauri` in the root of your project with the following structure:

```text
src-tauri/
├── Cargo.toml
├── build.rs
├── capabilities/
│   └── default.json
├── tauri.conf.json
└── src/
    ├── lib.rs
    └── main.rs
```

### `src-tauri/Cargo.toml`
```toml
[package]
name = "abs-knit-fabrics"
version = "1.0.0"
description = "M/S A.B.S Knit Fabrics Data Management System"
authors = ["you"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[lib]
name = "abs_knit_fabrics_lib"
crate-type = ["lib", "cdylib", "staticlib"]
```

### `src-tauri/build.rs`
```rust
fn main() {
    tauri_build::build();
}
```

### `src-tauri/src/main.rs`
```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    abs_knit_fabrics_lib::run();
}
```

### `src-tauri/src/lib.rs`
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### `src-tauri/capabilities/default.json`
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-execute",
    "sql:allow-select"
  ]
}
```

### `src-tauri/tauri.conf.json`
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "ABS Knit Fabrics",
  "version": "1.0.0",
  "identifier": "com.abs.knitfabrics",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "M/S A.B.S Knit Fabrics — Data Management System",
        "width": 1280,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

---

## Step 3: Dual Database Adapter Layer (IndexedDB + SQLite)

To support both Web and Tauri Desktop seamlessly without breaking any existing Svelte components, replace or abstract `src/lib/db.ts` with a **Database Adapter**.

### Environment Detection Helper
```typescript
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
```

### Adapter Implementation (`src/lib/db-adapter.ts`)
```typescript
import Dexie, { type Table } from 'dexie';
import Database from '@tauri-apps/plugin-sql';
import type { Client, FabricType, Dia, ReceivedRecord, DeliveredRecord, AppSetting } from './db';

// -------------------------------------------------------------
// 1. IndexedDB Implementation (Dexie for Web)
// -------------------------------------------------------------
class DexieDB extends Dexie {
  clients!: Table<Client, number>;
  fabricTypes!: Table<FabricType, number>;
  dias!: Table<Dia, number>;
  receivedRecords!: Table<ReceivedRecord, number>;
  deliveredRecords!: Table<DeliveredRecord, number>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('KnittingFactoryDB');
    this.version(1).stores({
      clients: '++id, name, phone, created_at',
      fabricTypes: '++id, &name',
      dias: '++id, &value',
      receivedRecords: '++id, client_id, client_name, ch_no, yarn_count, date, timestamp',
      deliveredRecords: '++id, client_id, client_name, ch_no, yarn_count, dia, date, timestamp',
      settings: '&key',
    });
  }
}

const dexieInstance = new DexieDB();

// -------------------------------------------------------------
// 2. Tauri SQLite Implementation
// -------------------------------------------------------------
let sqliteInstance: Database | null = null;

async function getSqliteDB(): Promise<Database> {
  if (!sqliteInstance) {
    sqliteInstance = await Database.load('sqlite:knitting_factory.db');

    // Create Tables if not exist
    await sqliteInstance.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fabric_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        value TEXT UNIQUE NOT NULL
      );
      CREATE TABLE IF NOT EXISTS received_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        client_name TEXT,
        date TEXT,
        ch_no TEXT,
        yarn_count TEXT,
        lot TEXT,
        bags REAL,
        weight_kg REAL,
        total_weight_kg REAL,
        items TEXT,
        timestamp TEXT
      );
      CREATE TABLE IF NOT EXISTS delivered_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        client_name TEXT,
        date TEXT,
        ch_no TEXT,
        yarn_count TEXT,
        lot TEXT,
        dia TEXT,
        rolls REAL,
        weight_kg REAL,
        total_weight_kg REAL,
        items TEXT,
        timestamp TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }
  return sqliteInstance;
}

// -------------------------------------------------------------
// 3. Unified Abstract Database Interface
// -------------------------------------------------------------
export const dbAdapter = {
  // Clients
  async getAllClients(): Promise<Client[]> {
    if (isTauri()) {
      const s = await getSqliteDB();
      return await s.select<Client[]>('SELECT * FROM clients ORDER BY name ASC');
    }
    return await dexieInstance.clients.toArray();
  },

  async addClient(client: Omit<Client, 'id'>): Promise<number> {
    if (isTauri()) {
      const s = await getSqliteDB();
      const res = await s.execute(
        'INSERT INTO clients (name, phone, address, created_at) VALUES ($1, $2, $3, $4)',
        [client.name, client.phone || '', client.address || '', client.created_at]
      );
      return res.lastInsertId;
    }
    return (await dexieInstance.clients.add(client as Client)) as number;
  },

  async deleteClient(id: number): Promise<void> {
    if (isTauri()) {
      const s = await getSqliteDB();
      await s.execute('DELETE FROM clients WHERE id = $1', [id]);
      return;
    }
    await dexieInstance.clients.delete(id);
  },

  // Received Records
  async getReceivedRecords(clientId?: number): Promise<ReceivedRecord[]> {
    if (isTauri()) {
      const s = await getSqliteDB();
      const rows = clientId
        ? await s.select<any[]>('SELECT * FROM received_records WHERE client_id = $1 ORDER BY date ASC, timestamp ASC', [clientId])
        : await s.select<any[]>('SELECT * FROM received_records ORDER BY date ASC, timestamp ASC');
      return rows.map((r) => ({ ...r, items: r.items ? JSON.parse(r.items) : [] }));
    }
    let query = dexieInstance.receivedRecords.toCollection();
    if (clientId) {
      return await dexieInstance.receivedRecords.where('client_id').equals(clientId).toArray();
    }
    return await query.toArray();
  },

  async addReceivedRecord(record: ReceivedRecord): Promise<number> {
    if (isTauri()) {
      const s = await getSqliteDB();
      const res = await s.execute(
        `INSERT INTO received_records
        (client_id, client_name, date, ch_no, yarn_count, lot, bags, weight_kg, total_weight_kg, items, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          record.client_id, record.client_name, record.date, record.ch_no,
          record.yarn_count, record.lot || '', record.bags, record.weight_kg,
          record.total_weight_kg, JSON.stringify(record.items || []), record.timestamp
        ]
      );
      return res.lastInsertId;
    }
    return (await dexieInstance.receivedRecords.add(record)) as number;
  },

  // Initial Seeding
  async seedInitialData(): Promise<void> {
    if (isTauri()) {
      const s = await getSqliteDB();
      const fabrics = await s.select<any[]>('SELECT COUNT(*) as count FROM fabric_types');
      if (fabrics[0]?.count === 0) {
        const defaultFabrics = ['Single Jersey', '1x1 Rib', '2x2 Rib', 'Interlock', 'Terry / French Terry', 'Fleece', 'Pique', 'Lycra Cotton'];
        for (const name of defaultFabrics) {
          await s.execute('INSERT INTO fabric_types (name) VALUES ($1)', [name]);
        }
      }
      const dias = await s.select<any[]>('SELECT COUNT(*) as count FROM dias');
      if (dias[0]?.count === 0) {
        const defaultDias = ['20"', '22"', '24"', '26"', '28"', '30"', '32"', '34"', '36"', '38"', '40"'];
        for (const value of defaultDias) {
          await s.execute('INSERT INTO dias (value) VALUES ($1)', [value]);
        }
      }
      return;
    }

    // Fallback to Dexie seeding
    const fabricCount = await dexieInstance.fabricTypes.count();
    if (fabricCount === 0) {
      const defaultFabrics = ['Single Jersey', '1x1 Rib', '2x2 Rib', 'Interlock', 'Terry / French Terry', 'Fleece', 'Pique', 'Lycra Cotton'];
      await dexieInstance.fabricTypes.bulkAdd(defaultFabrics.map((name) => ({ name })));
    }
  }
};
```

---

## Step 4: Update package.json Scripts

Add the following scripts to `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "check": "svelte-check --tsconfig ./tsconfig.app.json && tsc -p tsconfig.node.json",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

---

## Step 5: GitHub Actions Workflow for Windows Build (.exe / .msi)

Create `.github/workflows/tauri-build.yml` to automatically build `.exe` and `.msi` installers on every `push` or `pull_request` / `merge` to `main`:

```yaml
name: Build Windows Desktop App (Tauri)

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Setup Rust Toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-pc-windows-msvc

      - name: Cache Rust dependencies
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install npm dependencies
        run: npm ci

      - name: Run Type Checking
        run: npm run check

      - name: Build Tauri Desktop Installer (.exe / .msi)
        uses: tauri-apps/tauri-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'App Release v__VERSION__'
          releaseBody: 'Automated desktop build for M/S A.B.S Knit Fabrics System.'
          releaseDraft: true
          prerelease: false

      - name: Upload Windows Executable Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: windows-installers
          path: |
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*.exe
```

---

## Step 6: Running & Building Locally

### Run Development App
To launch the app with hot reloading in Tauri desktop mode:
```bash
npm run tauri:dev
```

### Build Windows Production Installers (.exe & .msi)
To generate the standalone `.exe` installer (NSIS) and `.msi` package locally on Windows:
```bash
npm run tauri:build
```

The output installers will be generated under:
`src-tauri/target/release/bundle/msi/` (.msi)
`src-tauri/target/release/bundle/nsis/` (.exe)
