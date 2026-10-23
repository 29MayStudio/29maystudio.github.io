<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchMedExCatalog, getLastRefetchTime } from '../sync';
  import { db } from '../db';
  import Card from './ui/Card.svelte';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Badge from './ui/Badge.svelte';
  import {
    Moon,
    Sun,
    RefreshCw,
    Database,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Info,
    Layers,
    Store,
    Download,
    Upload,
    ShieldCheck
  } from 'lucide-svelte';

  let isDark = $state(false);
  let isRefetching = $state(false);
  let lastRefetchText = $state('Never');
  let catalogCount = $state(0);
  let inventoryCount = $state(0);
  let salesCount = $state(0);
  let heldCount = $state(0);

  // Store profile fields
  let storeName = $state('The Halal Pharmacy');
  let storeSlogan = $state('Islamic Pharmacy & Medicine Outlet');
  let storePhone = $state('+880 1700-000000');
  let storeAddress = $state('Dhaka, Bangladesh');

  // Font Selection State
  let selectedFont = $state('Inter');
  const availableFonts = [
    { id: 'Inter', name: 'Inter (Default Modern Sans)', family: "'Inter', sans-serif" },
    { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans (Clean POS)', family: "'Plus Jakarta Sans', sans-serif" },
    { id: 'Poppins', name: 'Poppins (Geometric & Bold)', family: "'Poppins', sans-serif" },
    { id: 'Geist', name: 'Geist (Minimal Tech)', family: "'Geist', sans-serif" },
    { id: 'Outfit', name: 'Outfit (Modern Display)', family: "'Outfit', sans-serif" },
    { id: 'Roboto', name: 'Roboto (Google Classic)', family: "'Roboto', sans-serif" },
    { id: 'Fira Code', name: 'Fira Code (Developer Mono)', family: "'Fira Code', monospace" },
  ];

  let feedbackMsg = $state<string | null>(null);
  let isError = $state(false);

  function notify(msg: string, err = false) {
    feedbackMsg = msg;
    isError = err;
    setTimeout(() => {
      feedbackMsg = null;
    }, 4000);
  }

  async function loadSettingsInfo() {
    try {
      catalogCount = await db.catalog.count();
      inventoryCount = await db.inventory.count();
      salesCount = await db.sales.count();
      heldCount = await db.heldBills.count();

      const savedName = await db.settings.get('storeName');
      if (savedName) storeName = savedName.value;

      const savedSlogan = await db.settings.get('storeSlogan');
      if (savedSlogan) storeSlogan = savedSlogan.value;

      const savedPhone = await db.settings.get('storePhone');
      if (savedPhone) storePhone = savedPhone.value;

      const savedAddress = await db.settings.get('storeAddress');
      if (savedAddress) storeAddress = savedAddress.value;

      const last = await getLastRefetchTime();
      if (last) {
        lastRefetchText = new Date(last).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        lastRefetchText = 'Never';
      }
    } catch (e) {
      console.error(e);
    }
  }

  onMount(() => {
    isDark = document.documentElement.classList.contains('dark');
    loadSettingsInfo();

    const savedFont = localStorage.getItem('appFont');
    if (savedFont) {
      selectedFont = savedFont;
      applyFontFamily(savedFont);
    }
  });

  function applyFontFamily(fontId: string) {
    const fontObj = availableFonts.find((f) => f.id === fontId);
    if (fontObj) {
      document.body.style.fontFamily = fontObj.family;
    }
  }

  function handleFontChange(fontId: string) {
    selectedFont = fontId;
    localStorage.setItem('appFont', fontId);
    applyFontFamily(fontId);
    notify(`UI Typography updated to "${fontId}"!`);
  }

  function toggleTheme() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  async function saveStoreProfile(e: SubmitEvent) {
    e.preventDefault();
    try {
      await db.settings.put({ key: 'storeName', value: storeName });
      await db.settings.put({ key: 'storeSlogan', value: storeSlogan });
      await db.settings.put({ key: 'storePhone', value: storePhone });
      await db.settings.put({ key: 'storeAddress', value: storeAddress });
      notify('Store profile details updated successfully!');
    } catch (err: any) {
      notify('Failed to save store profile: ' + err.message, true);
    }
  }

  async function handleQuickRefetch() {
    if (isRefetching) return;
    isRefetching = true;
    try {
      const res = await fetchMedExCatalog();
      if (res.success) {
        notify(`Updated MedEx catalog dataset (${res.count.toLocaleString()} medicines)!`);
        await loadSettingsInfo();
      } else {
        notify('Catalog sync failed: ' + res.error, true);
      }
    } catch (err: any) {
      notify('Catalog sync error: ' + err.message, true);
    } finally {
      isRefetching = false;
    }
  }

  async function exportBackupJSON() {
    try {
      const inventory = await db.inventory.toArray();
      const sales = await db.sales.toArray();
      const settings = await db.settings.toArray();

      const backupData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        inventory,
        sales,
        settings,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `halal_pharmacy_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify('Full JSON backup downloaded successfully!');
    } catch (err: any) {
      notify('Export failed: ' + err.message, true);
    }
  }

  async function importBackupJSON(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.inventory || !Array.isArray(data.inventory)) {
        throw new Error('Invalid backup file format');
      }

      await db.transaction('rw', db.inventory, db.sales, db.settings, async () => {
        if (data.inventory.length > 0) {
          await db.inventory.clear();
          await db.inventory.bulkAdd(data.inventory);
        }
        if (data.sales && Array.isArray(data.sales) && data.sales.length > 0) {
          await db.sales.clear();
          await db.sales.bulkAdd(data.sales);
        }
        if (data.settings && Array.isArray(data.settings) && data.settings.length > 0) {
          await db.settings.clear();
          await db.settings.bulkAdd(data.settings);
        }
      });

      window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));
      await loadSettingsInfo();
      notify('Backup restored successfully!');
    } catch (err: any) {
      notify('Failed to restore backup: ' + err.message, true);
    }
  }

  async function seedSampleInventory() {
    try {
      const sampleItems = [
        {
          brand_name: 'Napa Extra',
          generic_names: ['Paracetamol', 'Caffeine'],
          power: '500 mg + 65 mg',
          dosage_form: 'Tablet',
          manufacturer: 'Beximco Pharmaceuticals Ltd.',
          wholesale_price: 2.2,
          unit_price: 3.0,
          stock_quantity: 120,
          expiry_month: '2026-11',
          added_at: new Date().toISOString(),
          source: 'manual' as const,
        },
        {
          brand_name: 'Seclo',
          generic_names: ['Omeprazole'],
          power: '20 mg',
          dosage_form: 'Capsule',
          manufacturer: 'Square Pharmaceuticals PLC',
          wholesale_price: 5.5,
          unit_price: 7.0,
          stock_quantity: 85,
          expiry_month: '2027-03',
          added_at: new Date().toISOString(),
          source: 'manual' as const,
        },
        {
          brand_name: '3-C',
          generic_names: ['Cefixime Trihydrate'],
          power: '200 mg',
          dosage_form: 'Capsule',
          manufacturer: 'Edruc Limited',
          wholesale_price: 28.0,
          unit_price: 35.0,
          stock_quantity: 40,
          expiry_month: '2026-08',
          added_at: new Date().toISOString(),
          source: 'manual' as const,
        },
        {
          brand_name: 'Sergel',
          generic_names: ['Esomeprazole Magnesium Trihydrate'],
          power: '20 mg',
          dosage_form: 'Tablet',
          manufacturer: 'Healthcare Pharmaceuticals Ltd.',
          wholesale_price: 6.0,
          unit_price: 8.0,
          stock_quantity: 8,
          expiry_month: '2026-05',
          added_at: new Date().toISOString(),
          source: 'manual' as const,
        },
      ];

      await db.inventory.bulkAdd(sampleItems);
      window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));
      await loadSettingsInfo();
      notify('Successfully added sample medicines to inventory!');
    } catch (e: any) {
      notify('Seed error: ' + e.message, true);
    }
  }

  async function clearInventoryData() {
    if (!confirm('Are you sure you want to clear all inventory stock items?')) return;
    await db.inventory.clear();
    window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));
    await loadSettingsInfo();
    notify('Local inventory cleared.');
  }

  async function clearAllData() {
    if (!confirm('WARNING: This will erase all inventory stock, sales records, and held bills from local IndexedDB storage. Continue?')) return;
    await db.inventory.clear();
    await db.sales.clear();
    await db.heldBills.clear();
    window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));
    await loadSettingsInfo();
    notify('All local database records cleared.');
  }
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 space-y-6">
  <!-- Title Header -->
  <div>
    <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings & Profile</h2>
    <p class="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">Redesigned configuration panel for store profile, theme, database backups, and MedEx sync.</p>
  </div>

  <!-- Feedback Banner -->
  {#if feedbackMsg}
    <div
      class={`p-4 rounded-xl border flex items-center gap-3 text-sm font-semibold ${
        isError
          ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-200'
          : 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-950/80 dark:border-teal-800 dark:text-teal-200'
      }`}
    >
      {#if isError}
        <AlertCircle class="h-5 w-5 text-rose-600 shrink-0" />
      {:else}
        <CheckCircle2 class="h-5 w-5 text-teal-600 shrink-0" />
      {/if}
      <span>{feedbackMsg}</span>
    </div>
  {/if}

  <!-- System Overview Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">MedEx Catalogue</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{catalogCount.toLocaleString()}</div>
      <span class="text-[10px] text-emerald-600 font-medium">Offline dataset</span>
    </div>

    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">Inventory Stock</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{inventoryCount.toLocaleString()}</div>
      <span class="text-[10px] text-blue-600 font-medium">Active items</span>
    </div>

    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">Sales Records</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{salesCount.toLocaleString()}</div>
      <span class="text-[10px] text-purple-600 font-medium">Audit logs</span>
    </div>

    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">Held Bills</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{heldCount.toLocaleString()}</div>
      <span class="text-[10px] text-amber-600 font-medium">Pending checkout</span>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Store Profile Configuration (7 Cols) -->
    <div class="lg:col-span-7">
      <Card title="Store Profile & Receipt Header" description="Configure pharmacy identity appearing on receipts and invoices">
        <form onsubmit={saveStoreProfile} class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="store-name-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Pharmacy Name</label>
              <Input id="store-name-input" bind:value={storeName} required />
            </div>

            <div>
              <label for="store-slogan-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Tagline / Subtitle</label>
              <Input id="store-slogan-input" bind:value={storeSlogan} />
            </div>

            <div>
              <label for="store-phone-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Contact Phone Number</label>
              <Input id="store-phone-input" bind:value={storePhone} />
            </div>

            <div>
              <label for="store-address-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Address / Location</label>
              <Input id="store-address-input" bind:value={storeAddress} />
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-neutral-800 flex justify-end">
            <Button type="submit" variant="default" class="font-bold flex items-center gap-2 cursor-pointer">
              <Store class="h-4 w-4" />
              <span>Save Profile Details</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>

    <!-- Appearance & AMOLED Dark Mode (5 Cols) -->
    <div class="lg:col-span-5">
      <Card title="Appearance & Dark Mode" description="Configure absolute AMOLED black theme preferences">
        <div class="space-y-4">
          <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-black flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-xl bg-slate-200 dark:bg-neutral-900 flex items-center justify-center">
                {#if isDark}
                  <Moon class="h-5 w-5 text-amber-400" />
                {:else}
                  <Sun class="h-5 w-5 text-amber-500" />
                {/if}
              </div>
              <div>
                <div class="font-bold text-sm text-slate-900 dark:text-white">
                  {isDark ? 'AMOLED Dark Mode' : 'Light Mode'}
                </div>
                <div class="text-xs text-slate-500 dark:text-neutral-400">
                  {isDark ? '#000000 True Black' : 'Standard Light Theme'}
                </div>
              </div>
            </div>

            <Button variant="outline" onclick={toggleTheme} class="cursor-pointer">
              {isDark ? 'Switch Light' : 'Switch AMOLED'}
            </Button>
          </div>

          <!-- UI Typography Font Picker -->
          <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-900 dark:text-slate-100">System UI Typography</span>
              <Badge variant="outline" class="text-[10px]">Google Fonts</Badge>
            </div>
            <p class="text-xs text-slate-500 dark:text-neutral-400">Choose a primary font for all headings, POS tables, and checkout screens.</p>

            <div class="grid grid-cols-1 gap-2">
              {#each availableFonts as font}
                <button
                  type="button"
                  onclick={() => handleFontChange(font.id)}
                  class={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                    selectedFont === font.id
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900/50'
                  }`}
                  style={`font-family: ${font.family};`}
                >
                  <span>{font.name}</span>
                  {#if selectedFont === font.id}
                    <span class="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded">Active</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <!-- Catalog Refetch Card -->
          <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-900 dark:text-slate-100">MedEx Catalog Refetch</span>
              <Badge variant="success" class="text-[10px]">Auto Sync</Badge>
            </div>
            <p class="text-xs text-slate-500 dark:text-neutral-400">
              Last synced: <span class="font-medium text-slate-800 dark:text-slate-200">{lastRefetchText}</span>
            </p>

            <Button
              variant="default"
              onclick={handleQuickRefetch}
              disabled={isRefetching}
              class="w-full flex items-center justify-center gap-2 font-bold cursor-pointer"
            >
              <RefreshCw class={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              <span>{isRefetching ? 'Refetching Catalog...' : 'Manual Catalog Refetch'}</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>

  <!-- Backup & Local Storage Tools -->
  <Card title="Database Backup, Restore & Seeding" description="Export JSON backup files or manage local Dexie IndexedDB storage">
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Export JSON -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-black flex items-center justify-between">
          <div>
            <h4 class="font-bold text-sm text-slate-900 dark:text-slate-100">Export Backup File</h4>
            <p class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Download full database as JSON file</p>
          </div>
          <Button variant="outline" onclick={exportBackupJSON} class="flex items-center gap-1.5 cursor-pointer">
            <Download class="h-4 w-4" />
            <span>Export JSON</span>
          </Button>
        </div>

        <!-- Import JSON -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-black flex items-center justify-between">
          <div>
            <h4 class="font-bold text-sm text-slate-900 dark:text-slate-100">Restore Backup File</h4>
            <p class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Import database from previous JSON</p>
          </div>
          <label class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors">
            <Upload class="h-4 w-4" />
            <span>Import JSON</span>
            <input type="file" accept=".json" onchange={importBackupJSON} class="hidden" />
          </label>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-200 dark:border-neutral-800 flex flex-wrap gap-3">
        <Button variant="secondary" onclick={seedSampleInventory} class="flex items-center gap-1.5 text-xs cursor-pointer">
          <Layers class="h-4 w-4 text-emerald-600" />
          <span>Load Sample Medicines</span>
        </Button>

        <Button variant="outline" onclick={clearInventoryData} class="flex items-center gap-1.5 text-xs text-amber-600 border-amber-300 dark:border-amber-800 cursor-pointer">
          <Trash2 class="h-4 w-4" />
          <span>Clear Inventory</span>
        </Button>

        <Button variant="destructive" onclick={clearAllData} class="flex items-center gap-1.5 text-xs ml-auto cursor-pointer">
          <Database class="h-4 w-4" />
          <span>Reset Entire App Database</span>
        </Button>
      </div>
    </div>
  </Card>

  <!-- Technical Offline Architecture Note -->
  <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black text-xs text-slate-500 space-y-1">
    <div class="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
      <ShieldCheck class="h-4 w-4 text-emerald-600" />
      <span>100% Offline POS System</span>
    </div>
    <p>
      The Halal Pharmacy runs entirely inside your web browser using local IndexedDB storage. No server connection is required to make sales, view reports, or manage inventory stock.
    </p>
  </div>
</div>
