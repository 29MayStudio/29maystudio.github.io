<script lang="ts">
  import {
    FolderCog,
    Receipt,
    Home
  } from 'lucide-svelte';

  interface Props {
    activeTab: string;
    children?: any;
  }

  let { activeTab = $bindable('home'), children }: Props = $props();

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

  const navItems = [
    { id: 'home', label: 'Home (Received & Delivered)', icon: Home },
    { id: 'add', label: 'Add (Clients, Yarn Types & Dias)', icon: FolderCog },
    { id: 'records', label: 'Records & Audit Logs', icon: Receipt },
  ];
</script>

<div class="flex flex-col md:flex-row h-screen h-[100dvh] bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
  <!-- Sidebar Navigation -->
  <aside class="w-full md:w-12 h-12 md:h-full bg-white dark:bg-black border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-800 flex flex-row md:flex-col items-center justify-between px-1.5 py-1 md:py-3 z-20 shrink-0 print:hidden">
    <!-- Navigation Links -->
    <nav class="flex flex-row md:flex-col items-center justify-center md:justify-center gap-1 md:gap-0 md:space-y-2.5 flex-1 md:w-full md:px-1">
      {#each navItems as item}
        <div class="relative flex items-center justify-center">
          <button
            type="button"
            onclick={() => (activeTab = item.id)}
            onmouseenter={() => handleMouseEnter(item.id)}
            onmouseleave={handleMouseLeave}
            class={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
              activeTab === item.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <item.icon class="w-4 h-4 shrink-0" />
          </button>

          <!-- 1 Second Delay Tooltip -->
          {#if hoveredTab === item.id}
            <div class="absolute top-10 md:top-auto md:left-12 z-50 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              {item.label}
            </div>
          {/if}
        </div>
      {/each}
    </nav>
  </aside>

  <!-- Main Content Area -->
  <main class="flex-1 overflow-hidden bg-slate-50 dark:bg-black relative h-[calc(100dvh-3.5rem)] md:h-full">
    {@render children?.()}
  </main>
</div>
