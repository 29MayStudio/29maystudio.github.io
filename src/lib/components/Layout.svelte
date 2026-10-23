<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ShoppingCart,
    LayoutDashboard,
    PlusCircle,
    Receipt,
    Settings as SettingsIcon,
    Moon,
    Sun,
    Wifi,
    WifiOff,
    RefreshCw,
    Pill
  } from 'lucide-svelte';
  import { checkAndAutoSync, fetchMedExCatalog, getLastRefetchTime } from '../sync';
  import { db } from '../db';
  import Button from './ui/Button.svelte';

  let { activeTab = $bindable('sale'), children } = $props();

  let isDark = $state(false);
  let isOnline = $state(true);
  let isSyncing = $state(false);
  let lastRefetchText = $state('Never');
  let catalogCount = $state(0);

  async function updateSyncInfo() {
    try {
      const count = await db.catalog.count();
      catalogCount = count;
      const last = await getLastRefetchTime();
      if (last) {
        lastRefetchText = new Date(last).toLocaleString('en-US', {
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
    // Theme setup
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      isDark = true;
      document.documentElement.classList.add('dark');
    } else {
      isDark = false;
      document.documentElement.classList.remove('dark');
    }

    // Network status setup
    isOnline = navigator.onLine;
    const handleOnline = () => (isOnline = true);
    const handleOffline = () => (isOnline = false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial catalog check & sync
    updateSyncInfo();
    checkAndAutoSync().then(() => updateSyncInfo());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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

  async function triggerSync() {
    if (isSyncing) return;
    isSyncing = true;
    try {
      await fetchMedExCatalog();
      await updateSyncInfo();
    } finally {
      isSyncing = false;
    }
  }

  const navItems = [
    { id: 'sale', label: 'Sale (POS)', icon: ShoppingCart },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add-medicine', label: 'Add Medicine', icon: PlusCircle },
    { id: 'records', label: 'Sales Records', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];
</script>

<div class="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden select-none">
  <!-- Desktop Sidebar Navigation -->
  <aside class="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between z-20 shrink-0">
    <div>
      <!-- Brand Header -->
      <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
          <Pill class="h-6 w-6" />
        </div>
        <div>
          <h1 class="font-bold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">The Halal Pharmacy</h1>
          <span class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Desktop POS</span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="p-3 space-y-1.5">
        {#each navItems as item}
          <button
            type="button"
            onclick={() => (activeTab = item.id)}
            class={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === item.id
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <item.icon class="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        {/each}
      </nav>
    </div>

    <!-- Sidebar Bottom Status Widget -->
    <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
      <!-- Database Sync Widget -->
      <div class="bg-white dark:bg-slate-800/80 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5">
        <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span class="font-medium">MedEx Catalog</span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">{catalogCount.toLocaleString()} items</span>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>Synced: {lastRefetchText}</span>
          <button
            type="button"
            onclick={triggerSync}
            disabled={isSyncing}
            class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Refetch Catalogue Now"
          >
            <RefreshCw class={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Refetch</span>
          </button>
        </div>
      </div>

      <!-- Theme & Network status bar -->
      <div class="flex items-center justify-between pt-1">
        <div class="flex items-center gap-2 text-xs font-medium">
          {#if isOnline}
            <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Wifi class="h-3.5 w-3.5" /> Online
            </span>
          {:else}
            <span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" title="Full Offline Mode Active">
              <WifiOff class="h-3.5 w-3.5" /> Offline Mode
            </span>
          {/if}
        </div>

        <Button variant="ghost" size="icon" class="h-8 w-8 rounded-lg" onclick={toggleTheme} aria-label="Toggle Theme">
          {#if isDark}
            <Sun class="h-4 w-4 text-amber-400" />
          {:else}
            <Moon class="h-4 w-4 text-slate-600" />
          {/if}
        </Button>
      </div>
    </div>
  </aside>

  <!-- Main View Area -->
  <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
    {@render children?.()}
  </main>
</div>
