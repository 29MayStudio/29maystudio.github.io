import Dexie, { type Table } from 'dexie';

export interface CatalogItem {
  id?: number;
  brand_name: string;
  power: string;
  generic_names: string[];
  generic_search_string: string; // pre-computed lowercase search helper string
  manufacturer: string;
  dosage_form: string;
}

export interface InventoryItem {
  id?: number;
  brand_name: string;
  generic_names: string[];
  power: string;
  dosage_form: string;
  manufacturer: string;
  unit_price: number;
  stock_quantity: number;
  expiry_month: string; // e.g. "2026-12"
  added_at: string; // ISO date string
  source: 'auto' | 'manual';
  catalog_id?: number;
}

export interface CartItem {
  inventory_id: number;
  brand_name: string;
  generic_names: string[];
  power: string;
  dosage_form: string;
  unit_price: number;
  quantity: number;
  expiry_month: string;
  subtotal: number;
}

export interface SaleRecord {
  id?: number;
  sale_code: string;
  timestamp: string; // ISO string
  items: CartItem[];
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  payment_method: 'Cash' | 'Card' | 'Mobile Banking';
  status: 'Completed' | 'Refunded';
}

export interface HeldBill {
  id?: number;
  hold_code: string;
  held_at: string; // ISO string
  note?: string;
  items: CartItem[];
  total_amount: number;
}

export interface AppSetting {
  key: string;
  value: any;
}

export class HalalPharmacyDB extends Dexie {
  catalog!: Table<CatalogItem, number>;
  inventory!: Table<InventoryItem, number>;
  sales!: Table<SaleRecord, number>;
  heldBills!: Table<HeldBill, number>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('HalalPharmacyDB');

    // Version definition
    this.version(1).stores({
      catalog: '++id, brand_name, *generic_names, manufacturer, dosage_form, generic_search_string',
      inventory: '++id, brand_name, *generic_names, stock_quantity, expiry_month, source',
      sales: '++id, sale_code, timestamp, status',
      heldBills: '++id, hold_code, held_at',
      settings: '&key',
    });
  }
}

export const db = new HalalPharmacyDB();
