<script lang="ts">
  import {
    Receipt,
    Home,
    UserCheck
  } from 'lucide-svelte';
  import type { Client } from '../db';

  interface Props {
    activeTab: string;
    selectedClient?: Client | null;
    onHomeClick?: () => void;
    onClientSessionClick?: () => void;
    children?: any;
  }

  let {
    activeTab = $bindable('home'),
    selectedClient = null,
    onHomeClick,
    onClientSessionClick,
    children
  }: Props = $props();

  let hoveredTab = $state<string | null>(null);
  let hoverTimer: any = null;

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
</script>

<div class="flex flex-col md:flex-row h-screen h-[100dvh] bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
  <!-- Sidebar Navigation -->
  <aside class="w-full md:w-12 h-12 md:h-full bg-white dark:bg-black border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-800 flex flex-row md:flex-col items-center justify-between px-1.5 py-1 md:py-3 z-20 shrink-0 print:hidden">
    <!-- Navigation Links -->
    <nav class="flex flex-row md:flex-col items-center justify-center md:justify-center gap-1 md:gap-0 md:space-y-2.5 flex-1 md:w-full md:px-1">
      <!-- Home Button -->
      <div class="relative flex items-center justify-center">
        <button
          type="button"
          onclick={() => {
            activeTab = 'home';
            if (onHomeClick) {
              onHomeClick();
            }
          }}
          onmouseenter={() => handleMouseEnter('home')}
          onmouseleave={handleMouseLeave}
          class={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeTab === 'home' && !selectedClient
              ? 'bg-emerald-600 text-white'
              : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Home class="w-4 h-4 shrink-0" />
        </button>

        {#if hoveredTab === 'home'}
          <div class="absolute top-10 md:top-auto md:left-12 z-50 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            Home (Search Screen)
          </div>
        {/if}
      </div>

      <!-- Opened Client Session Button (Only shown when selectedClient is active) -->
      {#if selectedClient}
        <div class="relative flex items-center justify-center">
          <button
            type="button"
            onclick={() => {
              activeTab = 'home';
              if (onClientSessionClick) {
                onClientSessionClick();
              }
            }}
            onmouseenter={() => handleMouseEnter('client-session')}
            onmouseleave={handleMouseLeave}
            class={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
              activeTab === 'home' && selectedClient
                ? 'bg-blue-600 text-white'
                : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-neutral-900'
            }`}
          >
            <UserCheck class="w-4 h-4 shrink-0" />
          </button>

          {#if hoveredTab === 'client-session'}
            <div class="absolute top-10 md:top-auto md:left-12 z-50 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              {selectedClient.name} (Active Tally)
            </div>
          {/if}
        </div>
      {/if}

      <!-- All Records & Audit Logs Button -->
      <div class="relative flex items-center justify-center">
        <button
          type="button"
          onclick={() => {
            activeTab = 'records';
          }}
          onmouseenter={() => handleMouseEnter('records')}
          onmouseleave={handleMouseLeave}
          class={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeTab === 'records'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Receipt class="w-4 h-4 shrink-0" />
        </button>

        {#if hoveredTab === 'records'}
          <div class="absolute top-10 md:top-auto md:left-12 z-50 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            All Records & Audit Logs
          </div>
        {/if}
      </div>
    </nav>
  </aside>

  <!-- Main Content Area -->
  <main class="flex-1 overflow-hidden bg-slate-50 dark:bg-black relative h-[calc(100dvh-3.5rem)] md:h-full">
    {@render children?.()}
  </main>
</div>
