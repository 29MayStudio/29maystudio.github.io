<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchMedExCatalog, getLastRefetchTime } from '../sync';
  import { db } from '../db';
  import Card from './ui/Card.svelte';
  import Button from './ui/Button.svelte';
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
    Layers
  } from 'lucide-svelte';

  let isDark = $state(false);
  let isRefetching = $state(false);
  let lastRefetchText = $state('Never');
  let catalogCount = $state(0);
  let inventoryCount = $state(0);
  let salesCount = $state(0);

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
  });

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

  async function handleQuickRefetch() {
    if (isRefetching) return;
    isRefetching = true;
    try {
      const res = await fetchMedExCatalog();
      if (res.success) {
        notify(`Successfully downloaded and updated ${res.count.toLocaleString()} medicines from MedEx!`);
        await loadSettingsInfo();
      } else {
        notify('Refetch failed: ' + res.error, true);
      }
    } catch (err: any) {
      notify('Refetch error: ' + err.message, true);
    } finally {
      isRefetching = false;
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
          unit_price: 8.0,
          stock_quantity: 8, // Low stock sample
          expiry_month: '2026-05',
          added_at: new Date().toISOString(),
          source: 'manual' as const,
        },
      ];

      await db.inventory.bulkAdd(sampleItems);
      await loadSettingsInfo();
      notify('Successfully added sample medicines to inventory!');
    } catch (e: any) {
      notify('Seed error: ' + e.message, true);
    }
  }

  async function clearInventoryData() {
    if (!confirm('Are you sure you want to clear all inventory stock items?')) return;
    await db.inventory.clear();
    await loadSettingsInfo();
    notify('Local inventory cleared.');
  }

  async function clearAllData() {
    if (!confirm('WARNING: This will erase all inventory stock, sales records, and held bills from local IndexedDB storage. Continue?')) return;
    await db.inventory.clear();
    await db.sales.clear();
    await db.heldBills.clear();
    await loadSettingsInfo();
    notify('All local app database tables reset.');
  }
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 space-y-6">
  <!-- Title Header -->
  <div>
    <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings & Data Management</h2>
    <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage application theme, MedEx dataset sync, and local IndexedDB database storage.</p>
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

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Day / Night Theme Setting -->
    <Card title="Appearance Theme" description="Toggle between Light Mode and Dark Mode for desktop POS">
      <div class="flex items-center justify-between py-2">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
            {#if isDark}
              <Moon class="h-5 w-5 text-indigo-400" />
            {:else}
              <Sun class="h-5 w-5 text-amber-500" />
            {/if}
          </div>
          <div>
            <div class="font-bold text-sm text-slate-900 dark:text-white">
              {isDark ? 'Dark Mode Active' : 'Light Mode Active'}
            </div>
            <div class="text-xs text-slate-500">
              {isDark ? 'High-contrast dark palette for night operation' : 'Clean light layout for bright environments'}
            </div>
          </div>
        </div>

        <Button variant="outline" onclick={toggleTheme} class="flex items-center gap-2">
          {#if isDark}
            <Sun class="h-4 w-4 text-amber-500" />
            <span>Switch to Day</span>
          {:else}
            <Moon class="h-4 w-4 text-indigo-500" />
            <span>Switch to Night</span>
          {/if}
        </Button>
      </div>
    </Card>

    <!-- MedEx Catalogue Refetch Setting -->
    <Card title="MedEx Database Refetch" description="Sync Bangladeshi medicine catalog dataset from 29MayStudio MedEx repository">
      <div class="space-y-4">
        <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
          <div class="flex justify-between items-center">
            <span class="text-slate-500">Total MedEx Catalog Medicines:</span>
            <span class="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{catalogCount.toLocaleString()}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-slate-500">Last Database Sync Timestamp:</span>
            <span class="font-semibold text-slate-800 dark:text-slate-200">{lastRefetchText}</span>
          </div>
          <div class="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
            <span class="text-slate-500">Auto Weekly Refetch Schedule:</span>
            <Badge variant="success" class="text-[10px]">Active (Every 7 Days)</Badge>
          </div>
        </div>

        <Button
          variant="default"
          onclick={handleQuickRefetch}
          disabled={isRefetching}
          class="w-full flex items-center justify-center gap-2 font-bold"
        >
          <RefreshCw class={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>{isRefetching ? 'Refetching MedEx Dataset...' : 'Quick Refetch Now'}</span>
        </Button>
      </div>
    </Card>
  </div>

  <!-- Database & Local Storage Management -->
  <Card title="Local Storage & Seed Controls" description="Database stats and quick action testing controls">
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <span class="text-slate-500 block">MedEx Catalog</span>
          <span class="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">{catalogCount} items</span>
        </div>
        <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <span class="text-slate-500 block">Local Inventory Stock</span>
          <span class="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">{inventoryCount} items</span>
        </div>
        <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <span class="text-slate-500 block">Total Sales Logs</span>
          <span class="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">{salesCount} records</span>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
        <Button variant="secondary" onclick={seedSampleInventory} class="flex items-center gap-1.5 text-xs">
          <Layers class="h-4 w-4 text-emerald-600" />
          <span>Add Sample Medicines</span>
        </Button>

        <Button variant="outline" onclick={clearInventoryData} class="flex items-center gap-1.5 text-xs text-amber-600 border-amber-300">
          <Trash2 class="h-4 w-4" />
          <span>Clear Inventory Stock</span>
        </Button>

        <Button variant="destructive" onclick={clearAllData} class="flex items-center gap-1.5 text-xs ml-auto">
          <Database class="h-4 w-4" />
          <span>Reset All App Data</span>
        </Button>
      </div>
    </div>
  </Card>

  <!-- Technical Offline Architecture Note -->
  <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500 space-y-1">
    <div class="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
      <Info class="h-4 w-4 text-emerald-600" />
      <span>100% Fully Offline Desktop Capability</span>
    </div>
    <p>
      The Halal Pharmacy stores all medicines, active inventory stock, transaction audit records, and held bills inside IndexedDB local browser database using Dexie. Even without an active internet connection, all POS sales, stock entries, and reports operate seamlessly offline.
    </p>
  </div>
</div>
