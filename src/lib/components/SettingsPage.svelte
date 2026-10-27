<script lang="ts">
  import { onMount } from 'svelte';
  import { db, seedInitialData } from '../db';
  import Card from './ui/Card.svelte';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Badge from './ui/Badge.svelte';
  import {
    Moon,
    Sun,
    Database,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Layers,
    Store,
    Download,
    Upload,
    ShieldCheck
  } from 'lucide-svelte';

  let isDark = $state(false);
  let clientsCount = $state(0);
  let fabricCount = $state(0);
  let diaCount = $state(0);
  let receivedCount = $state(0);
  let deliveredCount = $state(0);

  // Factory profile fields
  let factoryName = $state('The Halal Knitting Factory');
  let factoryPhone = $state('+880 1700-000000');
  let factoryAddress = $state('Gazipur, Dhaka, Bangladesh');

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
      clientsCount = await db.clients.count();
      fabricCount = await db.fabricTypes.count();
      diaCount = await db.dias.count();
      receivedCount = await db.receivedRecords.count();
      deliveredCount = await db.deliveredRecords.count();

      const savedName = await db.settings.get('factoryName');
      if (savedName) factoryName = savedName.value;

      const savedPhone = await db.settings.get('factoryPhone');
      if (savedPhone) factoryPhone = savedPhone.value;

      const savedAddress = await db.settings.get('factoryAddress');
      if (savedAddress) factoryAddress = savedAddress.value;
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

  async function saveFactoryProfile(e: SubmitEvent) {
    e.preventDefault();
    try {
      await db.settings.put({ key: 'factoryName', value: factoryName });
      await db.settings.put({ key: 'factoryPhone', value: factoryPhone });
      await db.settings.put({ key: 'factoryAddress', value: factoryAddress });
      notify('Factory profile updated successfully!');
    } catch (err: any) {
      notify('Failed to save factory profile: ' + err.message, true);
    }
  }

  async function exportBackupJSON() {
    try {
      const clients = await db.clients.toArray();
      const fabricTypes = await db.fabricTypes.toArray();
      const dias = await db.dias.toArray();
      const receivedRecords = await db.receivedRecords.toArray();
      const deliveredRecords = await db.deliveredRecords.toArray();
      const settings = await db.settings.toArray();

      const backupData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        clients,
        fabricTypes,
        dias,
        receivedRecords,
        deliveredRecords,
        settings,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `knitting_factory_backup_${new Date().toISOString().slice(0, 10)}.json`;
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

      await db.transaction('rw', [db.clients, db.fabricTypes, db.dias, db.receivedRecords, db.deliveredRecords, db.settings], async () => {
        if (data.clients && Array.isArray(data.clients)) {
          await db.clients.clear();
          await db.clients.bulkAdd(data.clients);
        }
        if (data.fabricTypes && Array.isArray(data.fabricTypes)) {
          await db.fabricTypes.clear();
          await db.fabricTypes.bulkAdd(data.fabricTypes);
        }
        if (data.dias && Array.isArray(data.dias)) {
          await db.dias.clear();
          await db.dias.bulkAdd(data.dias);
        }
        if (data.receivedRecords && Array.isArray(data.receivedRecords)) {
          await db.receivedRecords.clear();
          await db.receivedRecords.bulkAdd(data.receivedRecords);
        }
        if (data.deliveredRecords && Array.isArray(data.deliveredRecords)) {
          await db.deliveredRecords.clear();
          await db.deliveredRecords.bulkAdd(data.deliveredRecords);
        }
        if (data.settings && Array.isArray(data.settings)) {
          await db.settings.clear();
          await db.settings.bulkAdd(data.settings);
        }
      });

      window.dispatchEvent(new CustomEvent('db-updated'));
      await loadSettingsInfo();
      notify('Backup restored successfully!');
    } catch (err: any) {
      notify('Failed to restore backup: ' + err.message, true);
    }
  }

  async function seedSampleData() {
    try {
      await seedInitialData();

      // Seed sample client if none
      if ((await db.clients.count()) === 0) {
        await db.clients.bulkAdd([
          { name: 'Apex Fashion Ltd.', phone: '+880 1711-123456', address: 'Gazipur, Dhaka', created_at: new Date().toISOString() },
          { name: 'Ha-Meem Group', phone: '+880 1819-654321', address: 'Narayanganj, Dhaka', created_at: new Date().toISOString() },
          { name: 'Square Fashions PLC', phone: '+880 1912-987654', address: 'Bhaluka, Mymensingh', created_at: new Date().toISOString() }
        ]);
      }

      window.dispatchEvent(new CustomEvent('db-updated'));
      await loadSettingsInfo();
      notify('Sample clients, fabric types, and dias loaded!');
    } catch (e: any) {
      notify('Seed error: ' + e.message, true);
    }
  }

  async function clearAllData() {
    if (!confirm('WARNING: This will erase all clients, received records, and delivered records from local browser database. Continue?')) return;
    await db.clients.clear();
    await db.receivedRecords.clear();
    await db.deliveredRecords.clear();
    window.dispatchEvent(new CustomEvent('db-updated'));
    await loadSettingsInfo();
    notify('Local database cleared.');
  }
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 space-y-6">
  <!-- Title Header -->
  <div>
    <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings & Configuration</h2>
    <p class="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">Manage factory identity, AMOLED dark mode theme, backup JSON, and database tools.</p>
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
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">Clients</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{clientsCount}</div>
      <span class="text-[10px] text-emerald-600 font-medium">Registered</span>
    </div>

    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">Fabric Types</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fabricCount}</div>
      <span class="text-[10px] text-blue-600 font-medium">Active list</span>
    </div>

    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">Dias</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{diaCount}</div>
      <span class="text-[10px] text-purple-600 font-medium">Preset dias</span>
    </div>

    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">Received Logs</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{receivedCount}</div>
      <span class="text-[10px] text-blue-600 font-medium">Inward fabric</span>
    </div>

    <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <span class="text-xs text-slate-500 dark:text-neutral-400 font-medium">Delivered Logs</span>
      <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{deliveredCount}</div>
      <span class="text-[10px] text-emerald-600 font-medium">Outward fabric</span>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Factory Profile Configuration (7 Cols) -->
    <div class="lg:col-span-7">
      <Card title="Knitting Factory Details" description="Configure factory identity details">
        <form onsubmit={saveFactoryProfile} class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label for="factory-name-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Factory Name</label>
              <Input id="factory-name-input" bind:value={factoryName} required />
            </div>

            <div>
              <label for="factory-phone-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Contact Phone Number</label>
              <Input id="factory-phone-input" bind:value={factoryPhone} />
            </div>

            <div>
              <label for="factory-address-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Address / Location</label>
              <Input id="factory-address-input" bind:value={factoryAddress} />
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-neutral-800 flex justify-end">
            <Button type="submit" variant="default" class="font-bold flex items-center gap-2 cursor-pointer">
              <Store class="h-4 w-4" />
              <span>Save Factory Profile</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>

    <!-- Appearance & AMOLED Dark Mode (5 Cols) -->
    <div class="lg:col-span-5">
      <Card title="Appearance & Dark Mode" description="Configure dark theme preferences">
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

          <!-- System Font Badge -->
          <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-900 dark:text-slate-100">System Typography</span>
              <Badge variant="outline" class="text-[10px]">SolaimanLipi</Badge>
            </div>
            <p class="text-xs text-slate-500 dark:text-neutral-400">Bengali / Custom typography active across all screens.</p>
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
            <p class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Download database as JSON file</p>
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
        <Button variant="secondary" onclick={seedSampleData} class="flex items-center gap-1.5 text-xs cursor-pointer">
          <Layers class="h-4 w-4 text-emerald-600" />
          <span>Seed Default Fabrics, Dias & Clients</span>
        </Button>

        <Button variant="destructive" onclick={clearAllData} class="flex items-center gap-1.5 text-xs ml-auto cursor-pointer">
          <Database class="h-4 w-4" />
          <span>Reset App Database</span>
        </Button>
      </div>
    </div>
  </Card>

  <!-- Technical Offline Architecture Note -->
  <div class="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black text-xs text-slate-500 space-y-1">
    <div class="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
      <ShieldCheck class="h-4 w-4 text-emerald-600" />
      <span>100% Offline Knitting Factory WebApp</span>
    </div>
    <p>
      Runs entirely inside your web browser using local IndexedDB storage. Meant for PC screens to keep track of received and delivered fabric records effortlessly without requiring an internet connection.
    </p>
  </div>
</div>
