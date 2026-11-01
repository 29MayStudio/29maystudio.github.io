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
        balance_kg REAL,
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
        rolls REAL,
        weight_kg REAL,
        total_weight_kg REAL,
        balance_kg REAL,
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
      let sqliteClients = await s.select<Client[]>('SELECT * FROM clients ORDER BY name ASC');

      // Auto-migrate/sync: If Dexie has clients, check if any need to be imported into SQLite
      try {
        const dexieClients = await dexieInstance.clients.toArray();
        if (dexieClients.length > 0) {
          const existingNames = new Set(sqliteClients.map((c) => c.name.toLowerCase().trim()));
          let newlyAdded = false;

          for (const dc of dexieClients) {
            const cleanName = (dc.name || '').trim();
            if (cleanName && !existingNames.has(cleanName.toLowerCase())) {
              await s.execute(
                'INSERT INTO clients (name, phone, address, created_at) VALUES ($1, $2, $3, $4)',
                [cleanName, dc.phone || '', dc.address || '', dc.created_at || new Date().toISOString()]
              );
              existingNames.add(cleanName.toLowerCase());
              newlyAdded = true;
            }
          }

          if (newlyAdded) {
            sqliteClients = await s.select<Client[]>('SELECT * FROM clients ORDER BY name ASC');
          }
        }
      } catch (e) {
        console.warn('Sync from IndexedDB to SQLite encountered an issue:', e);
      }

      // Auto-recover clients from received/delivered records if any client is missing in clients table
      try {
        const distinctRx = await s.select<{ client_id: number; client_name: string }[]>(
          'SELECT DISTINCT client_id, client_name FROM received_records WHERE client_name IS NOT NULL AND client_name != ""'
        );
        const distinctDx = await s.select<{ client_id: number; client_name: string }[]>(
          'SELECT DISTINCT client_id, client_name FROM delivered_records WHERE client_name IS NOT NULL AND client_name != ""'
        );

        const existingNames = new Set(sqliteClients.map((c) => c.name.toLowerCase().trim()));
        let recovered = false;

        for (const r of [...distinctRx, ...distinctDx]) {
          const cleanName = (r.client_name || '').trim();
          if (cleanName && !existingNames.has(cleanName.toLowerCase())) {
            await s.execute(
              'INSERT INTO clients (name, phone, address, created_at) VALUES ($1, $2, $3, $4)',
              [cleanName, '', '', new Date().toISOString()]
            );
            existingNames.add(cleanName.toLowerCase());
            recovered = true;
          }
        }

        if (recovered) {
          sqliteClients = await s.select<Client[]>('SELECT * FROM clients ORDER BY name ASC');
        }
      } catch (e) {
        console.warn('Auto-recovery of clients from records encountered an issue:', e);
      }

      return sqliteClients;
    }

    // Web / Dexie mode
    let clients = await dexieInstance.clients.toArray();

    // Auto-recover from records in Dexie if missing
    try {
      const rx = await dexieInstance.receivedRecords.toArray();
      const dx = await dexieInstance.deliveredRecords.toArray();
      const existingNames = new Set(clients.map((c) => c.name.toLowerCase().trim()));
      let recovered = false;

      for (const r of [...rx, ...dx]) {
        const cleanName = (r.client_name || '').trim();
        if (cleanName && !existingNames.has(cleanName.toLowerCase())) {
          await dexieInstance.clients.add({
            name: cleanName,
            phone: '',
            address: '',
            created_at: new Date().toISOString()
          });
          existingNames.add(cleanName.toLowerCase());
          recovered = true;
        }
      }

      if (recovered) {
        clients = await dexieInstance.clients.toArray();
      }
    } catch (e) {
      console.warn('Dexie client auto-recovery encountered an issue:', e);
    }

    return clients;
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

  async updateClient(id: number, client: Partial<Client>): Promise<void> {
    if (isTauri()) {
      const s = await getSqliteDB();
      await s.execute(
        `UPDATE clients
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             address = COALESCE($3, address)
         WHERE id = $4`,
        [client.name, client.phone, client.address, id]
      );
      if (client.name) {
        await s.execute('UPDATE received_records SET client_name = $1 WHERE client_id = $2', [client.name, id]);
        await s.execute('UPDATE delivered_records SET client_name = $1 WHERE client_id = $2', [client.name, id]);
      }
      return;
    }
    await dexieInstance.clients.update(id, client);
    if (client.name) {
      const rxRecords = await dexieInstance.receivedRecords.where('client_id').equals(id).toArray();
      for (const rec of rxRecords) {
        rec.client_name = client.name;
        await dexieInstance.receivedRecords.put(JSON.parse(JSON.stringify(rec)));
      }
      const dxRecords = await dexieInstance.deliveredRecords.where('client_id').equals(id).toArray();
      for (const rec of dxRecords) {
        rec.client_name = client.name;
        await dexieInstance.deliveredRecords.put(JSON.parse(JSON.stringify(rec)));
      }
    }
  },

  async deleteClient(id: number): Promise<void> {
    if (isTauri()) {
      const s = await getSqliteDB();
      await s.execute('DELETE FROM clients WHERE id = $1', [id]);
      return;
    }
    await dexieInstance.clients.delete(id);
  },

  async getClientRecordsCount(id: number): Promise<{ rxCount: number; dxCount: number }> {
    if (isTauri()) {
      const s = await getSqliteDB();
      const rx = await s.select<any[]>('SELECT COUNT(*) as count FROM received_records WHERE client_id = $1', [id]);
      const dx = await s.select<any[]>('SELECT COUNT(*) as count FROM delivered_records WHERE client_id = $1', [id]);
      return {
        rxCount: rx[0]?.count ?? 0,
        dxCount: dx[0]?.count ?? 0
      };
    }
    const rxCount = await dexieInstance.receivedRecords.where('client_id').equals(id).count();
    const dxCount = await dexieInstance.deliveredRecords.where('client_id').equals(id).count();
    return { rxCount, dxCount };
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
        (client_id, client_name, date, ch_no, yarn_count, lot, bags, weight_kg, total_weight_kg, balance_kg, items, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          record.client_id, record.client_name, record.date, record.ch_no,
          record.yarn_count, '', record.bags, record.weight_kg,
          record.total_weight_kg, record.balance_kg ?? null, JSON.stringify(record.items || []), record.timestamp
        ]
      );
      return res.lastInsertId ?? 0;
    }
    return (await dexieInstance.receivedRecords.add(record)) as number;
  },

  async updateReceivedRecord(id: number, record: Partial<ReceivedRecord>): Promise<void> {
    if (isTauri()) {
      const s = await getSqliteDB();
      await s.execute(
        `UPDATE received_records
         SET date = COALESCE($1, date),
             ch_no = COALESCE($2, ch_no),
             yarn_count = COALESCE($3, yarn_count),
             bags = COALESCE($4, bags),
             weight_kg = COALESCE($5, weight_kg),
             total_weight_kg = COALESCE($6, total_weight_kg),
             balance_kg = COALESCE($7, balance_kg)
         WHERE id = $8`,
        [
          record.date,
          record.ch_no,
          record.yarn_count,
          record.bags,
          record.weight_kg,
          record.total_weight_kg,
          record.balance_kg,
          id
        ]
      );
      return;
    }
    await dexieInstance.receivedRecords.update(id, record);
  },

  async deleteReceivedRecord(id: number): Promise<void> {
    if (isTauri()) {
      const s = await getSqliteDB();
      await s.execute('DELETE FROM received_records WHERE id = $1', [id]);
      return;
    }
    await dexieInstance.receivedRecords.delete(id);
  },

  // Delivered Records
  async getDeliveredRecords(clientId?: number): Promise<DeliveredRecord[]> {
    if (isTauri()) {
      const s = await getSqliteDB();
      const rows = clientId
        ? await s.select<any[]>('SELECT * FROM delivered_records WHERE client_id = $1 ORDER BY date ASC, timestamp ASC', [clientId])
        : await s.select<any[]>('SELECT * FROM delivered_records ORDER BY date ASC, timestamp ASC');
      return rows.map((r) => ({ ...r, items: r.items ? JSON.parse(r.items) : [] }));
    }
    let query = dexieInstance.deliveredRecords.toCollection();
    if (clientId) {
      return await dexieInstance.deliveredRecords.where('client_id').equals(clientId).toArray();
    }
    return await query.toArray();
  },

  async addDeliveredRecord(record: DeliveredRecord): Promise<number> {
    if (isTauri()) {
      const s = await getSqliteDB();
      const res = await s.execute(
        `INSERT INTO delivered_records
        (client_id, client_name, date, ch_no, yarn_count, lot, rolls, weight_kg, total_weight_kg, balance_kg, items, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          record.client_id, record.client_name, record.date, record.ch_no,
          record.yarn_count, '', record.rolls, record.weight_kg,
          record.total_weight_kg, record.balance_kg ?? null, JSON.stringify(record.items || []), record.timestamp
        ]
      );
      return res.lastInsertId ?? 0;
    }
    return (await dexieInstance.deliveredRecords.add(record)) as number;
  },

  async updateDeliveredRecord(id: number, record: Partial<DeliveredRecord>): Promise<void> {
    if (isTauri()) {
      const s = await getSqliteDB();
      await s.execute(
        `UPDATE delivered_records
         SET date = COALESCE($1, date),
             ch_no = COALESCE($2, ch_no),
             yarn_count = COALESCE($3, yarn_count),
             rolls = COALESCE($4, rolls),
             weight_kg = COALESCE($5, weight_kg),
             total_weight_kg = COALESCE($6, total_weight_kg),
             balance_kg = COALESCE($7, balance_kg)
         WHERE id = $8`,
        [
          record.date,
          record.ch_no,
          record.yarn_count,
          record.rolls,
          record.weight_kg,
          record.total_weight_kg,
          record.balance_kg,
          id
        ]
      );
      return;
    }
    await dexieInstance.deliveredRecords.update(id, record);
  },

  async deleteDeliveredRecord(id: number): Promise<void> {
    if (isTauri()) {
      const s = await getSqliteDB();
      await s.execute('DELETE FROM delivered_records WHERE id = $1', [id]);
      return;
    }
    await dexieInstance.deliveredRecords.delete(id);
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
