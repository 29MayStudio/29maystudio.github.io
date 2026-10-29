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
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

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
      return res.lastInsertId ?? 0;
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
          record.yarn_count, '', record.bags, record.weight_kg,
          record.total_weight_kg, JSON.stringify(record.items || []), record.timestamp
        ]
      );
      return res.lastInsertId ?? 0;
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
