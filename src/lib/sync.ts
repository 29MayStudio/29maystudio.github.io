import { writable } from 'svelte/store';
import { db, type CatalogItem } from './db';

const MEDEX_URL = 'https://raw.githubusercontent.com/29MayStudio/MedEx/refs/heads/main/list.json';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const isSyncing = writable<boolean>(false);
export const syncProgress = writable<number>(0);

export async function getLastRefetchTime(): Promise<string | null> {
  const setting = await db.settings.get('last_refetch_time');
  return setting ? setting.value : null;
}

export async function fetchMedExCatalog(onProgress?: (count: number) => void): Promise<{ success: boolean; count: number; error?: string }> {
  isSyncing.set(true);
  syncProgress.set(10);
  try {
    const response = await fetch(MEDEX_URL);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    syncProgress.set(40);
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid catalog format received from server');
    }

    syncProgress.set(70);
    const processedItems: CatalogItem[] = data.map((item: any) => {
      const generics = Array.isArray(item.generic_names) ? item.generic_names : [];
      return {
        brand_name: item.brand_name || 'Unknown',
        power: item.power || '',
        generic_names: generics,
        generic_search_string: `${item.brand_name || ''} ${generics.join(' ')}`.toLowerCase(),
        manufacturer: item.manufacturer || 'Unknown',
        dosage_form: item.dosage_form || 'Tablet',
      };
    });

    await db.transaction('rw', db.catalog, db.settings, async () => {
      await db.catalog.clear();
      await db.catalog.bulkAdd(processedItems);
      const nowIso = new Date().toISOString();
      await db.settings.put({ key: 'last_refetch_time', value: nowIso });
    });

    syncProgress.set(100);
    if (onProgress) {
      onProgress(processedItems.length);
    }

    return { success: true, count: processedItems.length };
  } catch (err: any) {
    console.error('MedEx catalog fetch failed:', err);
    return { success: false, count: 0, error: err.message || 'Failed to fetch catalog' };
  } finally {
    isSyncing.set(false);
  }
}

export async function syncCatalogWithMedEx(manual = false): Promise<void> {
  await fetchMedExCatalog();
}

export async function checkAndAutoSync(): Promise<void> {
  try {
    const lastRefetch = await getLastRefetchTime();
    const catalogCount = await db.catalog.count();

    if (!lastRefetch || catalogCount === 0) {
      console.log('No catalog found or initial sync required. Syncing...');
      await fetchMedExCatalog();
      return;
    }

    const lastTime = new Date(lastRefetch).getTime();
    const now = Date.now();

    if (now - lastTime >= ONE_WEEK_MS) {
      console.log('Catalog is older than 1 week. Auto-refetching MedEx dataset...');
      await fetchMedExCatalog();
    }
  } catch (e) {
    console.warn('Auto sync check error:', e);
  }
}
