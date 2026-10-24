<script lang="ts">
  import {
    ShoppingCart,
    LayoutDashboard,
    PlusCircle,
    Receipt,
    Settings,
    Moon,
    Sun,
    Wifi,
    WifiOff,
    RefreshCw
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { syncCatalogWithMedEx, isSyncing, syncProgress } from '../sync';

  interface Props {
    activeTab: string;
    children?: any;
  }

  let { activeTab = $bindable('sale'), children }: Props = $props();

  let isDarkMode = $state(false);
  let isOnline = $state(navigator.onLine);
  let hoveredTab = $state<string | null>(null);
  let hoverTimer: any = null;

  onMount(() => {
    // Check dark mode preference or existing class
    if (
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      isDarkMode = true;
      document.documentElement.classList.add('dark');
    } else {
      isDarkMode = false;
      document.documentElement.classList.remove('dark');
    }

    const updateOnlineStatus = () => {
      isOnline = navigator.onLine;
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  });

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  }

  function handleMouseEnter(id: string) {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      hoveredTab = id;
    }, 1000);
  }

  function handleMouseLeave() {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoveredTab = null;
  }

  const navItems = [
    { id: 'sale', label: 'Sale (POS)', icon: ShoppingCart },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add-medicine', label: 'Add Medicine', icon: PlusCircle },
    { id: 'records', label: 'Sales Records', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
</script>

<div class="flex flex-col md:flex-row h-screen h-[100dvh] bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
  <!-- Sidebar / Top Navigation Header -->
  <aside class="w-full md:w-16 h-14 md:h-full bg-white dark:bg-black border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-800 flex flex-row md:flex-col items-center justify-between px-3 py-1.5 md:py-4 z-20 shrink-0">
    <!-- Navigation Links -->
    <nav class="flex flex-row md:flex-col items-center justify-center md:justify-start gap-1 md:gap-0 md:space-y-3 flex-1 md:w-full md:px-2">
      {#each navItems as item}
        <div class="relative flex items-center justify-center">
          <button
            type="button"
            onclick={() => (activeTab = item.id)}
            onmouseenter={() => handleMouseEnter(item.id)}
            onmouseleave={handleMouseLeave}
            class={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
              activeTab === item.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <item.icon class="w-5 h-5 shrink-0" />
          </button>

          <!-- 1 Second Delay Tooltip -->
          {#if hoveredTab === item.id}
            <div class="absolute top-12 md:top-auto md:left-16 z-50 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              {item.label}
            </div>
          {/if}
        </div>
      {/each}
    </nav>

    <!-- Right/Bottom Actions & Status -->
    <div class="flex flex-row md:flex-col items-center gap-1 md:gap-0 md:space-y-3 shrink-0 md:w-full md:px-2 border-l md:border-l-0 md:border-t border-slate-100 dark:border-neutral-800 pl-2 md:pl-0 md:pt-3">
      <!-- Sync Button -->
      <div class="relative flex items-center justify-center">
        <button
          type="button"
          onclick={() => syncCatalogWithMedEx(true)}
          disabled={$isSyncing}
          onmouseenter={() => handleMouseEnter('sync')}
          onmouseleave={handleMouseLeave}
          class="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <RefreshCw class={`w-5 h-5 ${$isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
        {#if hoveredTab === 'sync'}
          <div class="absolute top-12 md:top-auto md:left-16 z-50 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
            {$isSyncing ? `Syncing (${$syncProgress}%)` : 'Sync MedEx Catalog'}
          </div>
        {/if}
      </div>

      <!-- Online / Offline Indicator -->
      <div class="relative flex items-center justify-center">
        <div
          onmouseenter={() => handleMouseEnter('network')}
          onmouseleave={handleMouseLeave}
          role="status"
          aria-label="Network status"
          class="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center cursor-default"
        >
          {#if isOnline}
            <Wifi class="w-5 h-5 text-emerald-500" />
          {:else}
            <WifiOff class="w-5 h-5 text-amber-500" />
          {/if}
        </div>
        {#if hoveredTab === 'network'}
          <div class="absolute top-12 md:top-auto md:left-16 z-50 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
            {isOnline ? 'Online (Catalog Sync Ready)' : 'Offline Mode (Local Storage)'}
          </div>
        {/if}
      </div>

      <!-- Dark Mode Toggle -->
      <div class="relative flex items-center justify-center">
        <button
          type="button"
          onclick={toggleDarkMode}
          onmouseenter={() => handleMouseEnter('theme')}
          onmouseleave={handleMouseLeave}
          class="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
        >
          {#if isDarkMode}
            <Sun class="w-5 h-5 text-amber-400" />
          {:else}
            <Moon class="w-5 h-5 text-slate-600" />
          {/if}
        </button>
        {#if hoveredTab === 'theme'}
          <div class="absolute top-12 md:top-auto md:left-16 z-50 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
            {isDarkMode ? 'Light Mode' : 'AMOLED Dark Mode'}
          </div>
        {/if}
      </div>
    </div>
  </aside>

  <!-- Main Content Area -->
  <main class="flex-1 overflow-auto bg-slate-50 dark:bg-black relative h-[calc(100dvh-3.5rem)] md:h-full">
    {@render children?.()}
  </main>
</div>
