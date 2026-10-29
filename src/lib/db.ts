import Dexie, { type Table } from 'dexie';

export interface Client {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  created_at: string; // ISO string
}

export interface FabricType {
  id?: number;
  name: string;
}

export interface Dia {
  id?: number;
  value: string;
}

export interface ReceivedYarnItem {
  yarn_count: string;
  bags: number;
  weight_kg: number;
}

export interface DeliveredYarnItem {
  yarn_count: string;
  dia: string;
  rolls: number;
  weight_kg: number;
}

export interface ReceivedRecord {
  id?: number;
  client_id: number;
  client_name: string;
  date: string; // YYYY-MM-DD
  ch_no: string; // Challan Number
  yarn_count: string;
  bags: number;
  weight_kg: number; // Weight in Kg
  total_weight_kg: number; // Total weight in Kg
  items?: ReceivedYarnItem[];
  timestamp: string; // ISO string
}

export interface DeliveredRecord {
  id?: number;
  client_id: number;
  client_name: string;
  date: string; // YYYY-MM-DD
  ch_no: string; // Challan Number
  yarn_count: string;
  dia: string; // autofill suggest from added data
  rolls: number;
  weight_kg: number; // Weight in Kg
  total_weight_kg: number; // Total weight in Kg
  items?: DeliveredYarnItem[];
  timestamp: string; // ISO string
}

export interface AppSetting {
  key: string;
  value: any;
}

export class KnittingFactoryDB extends Dexie {
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

export const db = new KnittingFactoryDB();

export async function seedInitialData() {
  const fabricCount = await db.fabricTypes.count();
  if (fabricCount === 0) {
    const defaultFabrics = [
      'Single Jersey',
      '1x1 Rib',
      '2x2 Rib',
      'Interlock',
      'Terry / French Terry',
      'Fleece',
      'Pique',
      'Lycra Cotton'
    ];
    await db.fabricTypes.bulkAdd(defaultFabrics.map((name) => ({ name })));
  }

  const diaCount = await db.dias.count();
  if (diaCount === 0) {
    const defaultDias = [
      '20"', '22"', '24"', '26"', '28"', '30"', '32"', '34"', '36"', '38"', '40"'
    ];
    await db.dias.bulkAdd(defaultDias.map((value) => ({ value })));
  }
}
