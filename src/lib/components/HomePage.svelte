<script lang="ts">
  import { onMount } from 'svelte';
  import {
    db,
    seedInitialData,
    type Client,
    type FabricType,
    type Dia,
    type ReceivedRecord,
    type DeliveredRecord
  } from '../db';
  import {
    Search,
    UserCheck,
    Plus,
    Trash2,
    Calendar,
    ArrowDownLeft,
    ArrowUpRight,
    X,
    History,
    Check,
    Layers
  } from 'lucide-svelte';

  interface Props {
    onNavigateToAdd?: () => void;
  }

  let { onNavigateToAdd }: Props = $props();

  // Data collections
  let allClients = $state<Client[]>([]);
  let fabricTypes = $state<FabricType[]>([]);
  let dias = $state<Dia[]>([]);

  // Selection & Search State
  let searchQuery = $state('');
  let isSearchFocused = $state(false);
  let selectedClient = $state<Client | null>(null);

  // Today Date Helper
  const getTodayString = () => new Date().toISOString().split('T')[0];
  let todayDate = $state(getTodayString());

  // Filtered autocomplete suggestions - only show suggestions if user typed at least 1 character
  let autocompleteSuggestions = $derived.by(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  // Client's Records
  let todayReceivedList = $state<ReceivedRecord[]>([]);
  let todayDeliveredList = $state<DeliveredRecord[]>([]);
  let pastReceivedList = $state<ReceivedRecord[]>([]);
  let pastDeliveredList = $state<DeliveredRecord[]>([]);

  // Toggle for history mode
  let showHistoryMode = $state(false);

  // New Entry Inputs - Received: Date (auto today), CH No., Yarn Count, Lot (optional), Bags, Weight (in Kg), Total
  let rxDate = $state(getTodayString());
  let rxChNo = $state('');
  let rxYarnCount = $state('');
  let rxLot = $state('');
  let rxBags = $state<number | undefined>(undefined);
  let rxWeight = $state<number | undefined>(undefined);
  let rxTotal = $derived(
    rxBags && rxWeight ? Number((rxBags * rxWeight).toFixed(2)) : undefined
  );

  // New Entry Inputs - Delivered: Date (auto today), CH No., Yarn Count, Lot (optional), dia (autofill suggest from added data), Rolls, Weight (in Kg), Total
  let dxDate = $state(getTodayString());
  let dxChNo = $state('');
  let dxYarnCount = $state('');
  let dxLot = $state('');
  let dxDia = $state('');
  let dxRolls = $state<number | undefined>(undefined);
  let dxWeight = $state<number | undefined>(undefined);
  let dxTotal = $derived(
    dxRolls && dxWeight ? Number((dxRolls * dxWeight).toFixed(2)) : undefined
  );

  onMount(() => {
    seedInitialData().then(() => loadBaseData());

    // Listen for database updates from other screens
    const handleDbUpdate = async () => {
      await loadBaseData();
      if (selectedClient && selectedClient.id) {
        await loadClientRecords(selectedClient.id);
      }
    };

    window.addEventListener('db-updated', handleDbUpdate);
    return () => window.removeEventListener('db-updated', handleDbUpdate);
  });

  async function loadBaseData() {
    allClients = await db.clients.orderBy('name').toArray();
    fabricTypes = await db.fabricTypes.orderBy('name').toArray();
    dias = await db.dias.toArray();

    if (dias.length > 0) {
      if (!dxDia) dxDia = dias[0].value;
    }
  }

  async function selectClient(client: Client) {
    selectedClient = client;
    searchQuery = client.name;
    isSearchFocused = false;
    if (client.id) {
      await loadClientRecords(client.id);
    }
  }

  function clearSelectedClient() {
    selectedClient = null;
    searchQuery = '';
    todayReceivedList = [];
    todayDeliveredList = [];
    pastReceivedList = [];
    pastDeliveredList = [];
  }

  async function loadClientRecords(clientId: number) {
    todayReceivedList = await db.receivedRecords
      .where('client_id')
      .equals(clientId)
      .reverse()
      .toArray();

    todayDeliveredList = await db.deliveredRecords
      .where('client_id')
      .equals(clientId)
      .reverse()
      .toArray();
  }

  // Add Received Record
  async function addReceivedRow() {
    if (!selectedClient?.id) return;
    if (!rxWeight || rxWeight <= 0) return;

    const bagsVal = rxBags ? Number(rxBags) : 1;
    const totalKg = Number((bagsVal * rxWeight).toFixed(2));

    await db.receivedRecords.add({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      date: rxDate || getTodayString(),
      ch_no: rxChNo.trim() || '-',
      yarn_count: rxYarnCount.trim() || '-',
      lot: rxLot.trim() || undefined,
      bags: bagsVal,
      weight_kg: Number(rxWeight),
      total_weight_kg: totalKg,
      timestamp: new Date().toISOString()
    });

    // Reset inputs
    rxChNo = '';
    rxYarnCount = '';
    rxLot = '';
    rxBags = undefined;
    rxWeight = undefined;

    await loadClientRecords(selectedClient.id);
  }

  // Add Delivered Record
  async function addDeliveredRow() {
    if (!selectedClient?.id) return;
    if (!dxWeight || dxWeight <= 0) return;

    const rollsVal = dxRolls ? Number(dxRolls) : 1;
    const totalKg = Number((rollsVal * dxWeight).toFixed(2));

    await db.deliveredRecords.add({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      date: dxDate || getTodayString(),
      ch_no: dxChNo.trim() || '-',
      yarn_count: dxYarnCount.trim() || '-',
      lot: dxLot.trim() || undefined,
      dia: dxDia.trim() || (dias[0]?.value ?? '30"'),
      rolls: rollsVal,
      weight_kg: Number(dxWeight),
      total_weight_kg: totalKg,
      timestamp: new Date().toISOString()
    });

    // Reset inputs
    dxChNo = '';
    dxYarnCount = '';
    dxLot = '';
    dxRolls = undefined;
    dxWeight = undefined;

    await loadClientRecords(selectedClient.id);
  }

  // Live Inline Editing Handlers
  async function updateReceivedCell(id: number | undefined, field: keyof ReceivedRecord, value: any) {
    if (!id || !selectedClient?.id) return;
    await db.receivedRecords.update(id, { [field]: value });
    await loadClientRecords(selectedClient.id);
  }

  async function updateDeliveredCell(id: number | undefined, field: keyof DeliveredRecord, value: any) {
    if (!id || !selectedClient?.id) return;
    await db.deliveredRecords.update(id, { [field]: value });
    await loadClientRecords(selectedClient.id);
  }

  async function deleteReceivedRecord(id?: number) {
    if (!id || !selectedClient?.id) return;
    if (confirm('Delete this received tally entry?')) {
      await db.receivedRecords.delete(id);
      await loadClientRecords(selectedClient.id);
    }
  }

  async function deleteDeliveredRecord(id?: number) {
    if (!id || !selectedClient?.id) return;
    if (confirm('Delete this delivered tally entry?')) {
      await db.deliveredRecords.delete(id);
      await loadClientRecords(selectedClient.id);
    }
  }
</script>

<div class="h-full flex flex-col relative overflow-hidden bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-100 font-sans">
  {#if !selectedClient}
    <!-- INITIAL CENTERED SEARCH SCREEN -->
    <div class="flex-1 flex flex-col items-center justify-center p-6 transition-all duration-300">
      <div class="w-full max-w-2xl text-center space-y-6">
        <!-- Brand / Title Header -->
        <div class="space-y-2">
          <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            M/S A.B.S Knit Fabrics
          </h1>
        </div>

        <!-- Centered Search Bar with Autocomplete Dropdown -->
        <div class="relative text-left">
          <div class="relative flex items-center shadow-xl rounded-2xl border-2 border-emerald-500/30 focus-within:border-emerald-500 bg-white dark:bg-neutral-900 transition-all">
            <Search class="w-6 h-6 text-slate-400 dark:text-neutral-500 ml-4 shrink-0" />
            <input
              type="text"
              bind:value={searchQuery}
              onfocus={() => (isSearchFocused = true)}
              placeholder="Type client name to search autocomplete..."
              class="w-full py-4 px-4 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 text-lg font-medium focus:outline-none"
            />
            {#if searchQuery}
              <button
                type="button"
                onclick={() => (searchQuery = '')}
                class="mr-4 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X class="w-5 h-5" />
              </button>
            {/if}
          </div>

          <!-- Autocomplete Suggestions Dropdown -->
          {#if searchQuery.trim().length > 0}
            <div class="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
              {#if autocompleteSuggestions.length === 0}
                <div class="p-6 text-center text-slate-500 dark:text-neutral-400">
                  <p class="font-semibold text-slate-700 dark:text-neutral-200">No client found matching "{searchQuery}"</p>
                  <p class="text-xs mt-1 text-slate-400">Add new clients in the "Add Screen" tab.</p>
                  {#if onNavigateToAdd}
                    <button
                      type="button"
                      onclick={onNavigateToAdd}
                      class="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium text-xs rounded-xl hover:bg-emerald-500 transition-colors cursor-pointer"
                    >
                      <Plus class="w-4 h-4" /> Go to Add Screen
                    </button>
                  {/if}
                </div>
              {:else}
                <div class="p-2 divide-y divide-slate-100 dark:divide-neutral-800/60">
                  <div class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    Select a Client from List:
                  </div>
                  {#each autocompleteSuggestions as client}
                    <button
                      type="button"
                      onclick={() => selectClient(client)}
                      class="w-full text-left px-4 py-3.5 hover:bg-emerald-50 dark:hover:bg-neutral-800/80 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div class="font-bold text-slate-900 dark:text-white text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {client.name}
                        </div>
                        {#if client.phone || client.address}
                          <div class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 flex items-center gap-3">
                            {#if client.phone}<span>📞 {client.phone}</span>{/if}
                            {#if client.address}<span>📍 {client.address}</span>{/if}
                          </div>
                        {/if}
                      </div>
                      <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center text-slate-400 transition-colors shrink-0">
                        <Check class="w-4 h-4" />
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        {#if allClients.length === 0}
          <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
            <span>No clients registered in database yet. Add clients to begin.</span>
            {#if onNavigateToAdd}
              <button
                type="button"
                onclick={onNavigateToAdd}
                class="font-bold underline hover:opacity-80 cursor-pointer ml-2"
              >
                Add Client Now →
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>

  {:else}
    <!-- SELECTED CLIENT TOP SCREEN WITH TALLY / EXCEL GRID -->
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Top Sticky Bar with Search & Selected Client Big Headline -->
      <header class="bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 px-6 py-4 shrink-0 shadow-sm transition-all">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <!-- Client Name Title -->
          <div>
            <h1 class="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              {selectedClient.name}
            </h1>
            {#if selectedClient.address}
              <div class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                📍 {selectedClient.address}
              </div>
            {/if}
          </div>

          <!-- Top Search & Client Switcher Actions -->
          <div class="flex items-center gap-3">
            <div class="relative w-64 md:w-80">
              <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search client..."
                class="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onfocus={() => (isSearchFocused = true)}
              />
              <Search class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />

              {#if searchQuery.trim().length > 0 && autocompleteSuggestions.length > 0}
                <div class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                  {#each autocompleteSuggestions as client}
                    <button
                      type="button"
                      onclick={() => selectClient(client)}
                      class="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-900 dark:text-white border-b border-slate-100 dark:border-neutral-800/50 cursor-pointer"
                    >
                      <div class="font-bold">{client.name}</div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <button
              type="button"
              onclick={clearSelectedClient}
              class="px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Change client"
            >
              <X class="w-4 h-4" /> Change Client
            </button>
          </div>
        </div>
      </header>

      <!-- Main Dual Column Area (Received | Delivered) -->
      <main class="flex-1 overflow-y-auto p-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          <!-- ================= LEFT COLUMN: RECEIVED ================= -->
          <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
            <h2 class="text-lg font-bold text-slate-900 dark:text-white border-b pb-2 border-slate-100 dark:border-neutral-800">
              Received
            </h2>

            <div class="overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-xl bg-slate-50/50 dark:bg-neutral-900/50">
              <table class="w-full text-left text-xs border-collapse font-sans">
                <thead class="bg-blue-600 text-white font-bold text-[11px] uppercase tracking-wider">
                  <tr class="divide-x divide-blue-500">
                    <th class="px-2 py-2 w-24">Date</th>
                    <th class="px-2 py-2">CH No.</th>
                    <th class="px-2 py-2">Yarn Count</th>
                    <th class="px-2 py-2">Lot</th>
                    <th class="px-2 py-2 w-14">Bags</th>
                    <th class="px-2 py-2 w-20">Weight (Kg)</th>
                    <th class="px-2 py-2 w-20">Total</th>
                    <th class="px-2 py-2 w-10 text-center">Action</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                  <!-- QUICK ADD ROW -->
                  <tr class="bg-blue-50/70 dark:bg-blue-950/30 divide-x divide-blue-100 dark:divide-blue-900/40 border-b-2 border-blue-500/30">
                    <td class="p-1">
                      <input
                        type="date"
                        bind:value={rxDate}
                        class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1 py-1 text-[11px]"
                      />
                    </td>
                    <td class="p-1">
                      <input
                        type="text"
                        bind:value={rxChNo}
                        placeholder="CH No."
                        class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td class="p-1">
                      <select
                        bind:value={rxYarnCount}
                        class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1 py-1 text-xs"
                      >
                        <option value="">Select</option>
                        {#each fabricTypes as fabric}
                          <option value={fabric.name}>{fabric.name}</option>
                        {/each}
                      </select>
                    </td>
                    <td class="p-1">
                      <input
                        type="text"
                        bind:value={rxLot}
                        placeholder="Opt."
                        class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td class="p-1">
                      <input
                        type="number"
                        bind:value={rxBags}
                        placeholder="Bags"
                        class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1 py-1 text-xs text-center"
                      />
                    </td>
                    <td class="p-1">
                      <input
                        type="number"
                        step="0.01"
                        bind:value={rxWeight}
                        placeholder="Kg"
                        onkeydown={(e) => { if (e.key === 'Enter') addReceivedRow(); }}
                        class="w-full bg-blue-100/80 dark:bg-blue-900/50 border-2 border-blue-500 rounded px-1 py-1 text-xs font-bold text-right"
                      />
                    </td>
                    <td class="p-1 text-right font-mono font-bold text-blue-700 dark:text-blue-300 px-1">
                      {rxTotal ?? '-'}
                    </td>
                    <td class="p-1 text-center">
                      <button
                        type="button"
                        onclick={addReceivedRow}
                        class="w-full py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        <Plus class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  <!-- EXISTING ENTRIES -->
                  {#if todayReceivedList.length === 0}
                    <tr>
                      <td colspan="8" class="p-6 text-center text-slate-400 text-xs italic">
                        No received entries.
                      </td>
                    </tr>
                  {:else}
                    {#each todayReceivedList as item}
                      <tr class="hover:bg-blue-50/40 dark:hover:bg-neutral-800/60 divide-x divide-slate-100 dark:divide-neutral-800">
                        <td class="p-1.5 font-mono text-[11px]">{item.date}</td>
                        <td class="p-1.5 font-semibold">{item.ch_no}</td>
                        <td class="p-1.5">{item.yarn_count}</td>
                        <td class="p-1.5 text-slate-500">{item.lot || '-'}</td>
                        <td class="p-1.5 text-center font-mono">{item.bags}</td>
                        <td class="p-1.5 text-right font-mono">{item.weight_kg}</td>
                        <td class="p-1.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{item.total_weight_kg}</td>
                        <td class="p-1 text-center">
                          <button
                            type="button"
                            onclick={() => deleteReceivedRecord(item.id)}
                            class="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
          </div>


          <!-- ================= RIGHT COLUMN: DELIVERED ================= -->
          <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
            <h2 class="text-lg font-bold text-slate-900 dark:text-white border-b pb-2 border-slate-100 dark:border-neutral-800">
              Delivered
            </h2>

            <div class="overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-xl bg-slate-50/50 dark:bg-neutral-900/50">
              <table class="w-full text-left text-xs border-collapse font-sans">
                <thead class="bg-emerald-600 text-white font-bold text-[11px] uppercase tracking-wider">
                  <tr class="divide-x divide-emerald-500">
                    <th class="px-2 py-2 w-24">Date</th>
                    <th class="px-2 py-2">CH No.</th>
                    <th class="px-2 py-2">Yarn Count</th>
                    <th class="px-2 py-2">Lot</th>
                    <th class="px-2 py-2 w-16">Dia</th>
                    <th class="px-2 py-2 w-14">Rolls</th>
                    <th class="px-2 py-2 w-20">Weight (Kg)</th>
                    <th class="px-2 py-2 w-20">Total</th>
                    <th class="px-2 py-2 w-10 text-center">Action</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                  <!-- QUICK ADD ROW -->
                  <tr class="bg-emerald-50/70 dark:bg-emerald-950/30 divide-x divide-emerald-100 dark:divide-emerald-900/40 border-b-2 border-emerald-500/30">
                    <td class="p-1">
                      <input
                        type="date"
                        bind:value={dxDate}
                        class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1 py-1 text-[11px]"
                      />
                    </td>
                    <td class="p-1">
                      <input
                        type="text"
                        bind:value={dxChNo}
                        placeholder="CH No."
                        class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td class="p-1">
                      <select
                        bind:value={dxYarnCount}
                        class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1 py-1 text-xs"
                      >
                        <option value="">Select</option>
                        {#each fabricTypes as fabric}
                          <option value={fabric.name}>{fabric.name}</option>
                        {/each}
                      </select>
                    </td>
                    <td class="p-1">
                      <input
                        type="text"
                        bind:value={dxLot}
                        placeholder="Opt."
                        class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td class="p-1">
                      <select
                        bind:value={dxDia}
                        class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1 py-1 text-xs font-semibold"
                      >
                        {#each dias as dia}
                          <option value={dia.value}>{dia.value}</option>
                        {/each}
                      </select>
                    </td>
                    <td class="p-1">
                      <input
                        type="number"
                        bind:value={dxRolls}
                        placeholder="Rolls"
                        class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1 py-1 text-xs text-center"
                      />
                    </td>
                    <td class="p-1">
                      <input
                        type="number"
                        step="0.01"
                        bind:value={dxWeight}
                        placeholder="Kg"
                        onkeydown={(e) => { if (e.key === 'Enter') addDeliveredRow(); }}
                        class="w-full bg-emerald-100/80 dark:bg-emerald-900/50 border-2 border-emerald-500 rounded px-1 py-1 text-xs font-bold text-right"
                      />
                    </td>
                    <td class="p-1 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 px-1">
                      {dxTotal ?? '-'}
                    </td>
                    <td class="p-1 text-center">
                      <button
                        type="button"
                        onclick={addDeliveredRow}
                        class="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        <Plus class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  <!-- EXISTING ENTRIES -->
                  {#if todayDeliveredList.length === 0}
                    <tr>
                      <td colspan="9" class="p-6 text-center text-slate-400 text-xs italic">
                        No delivered entries.
                      </td>
                    </tr>
                  {:else}
                    {#each todayDeliveredList as item}
                      <tr class="hover:bg-emerald-50/40 dark:hover:bg-neutral-800/60 divide-x divide-slate-100 dark:divide-neutral-800">
                        <td class="p-1.5 font-mono text-[11px]">{item.date}</td>
                        <td class="p-1.5 font-semibold">{item.ch_no}</td>
                        <td class="p-1.5">{item.yarn_count}</td>
                        <td class="p-1.5 text-slate-500">{item.lot || '-'}</td>
                        <td class="p-1.5 font-semibold">{item.dia}</td>
                        <td class="p-1.5 text-center font-mono">{item.rolls}</td>
                        <td class="p-1.5 text-right font-mono">{item.weight_kg}</td>
                        <td class="p-1.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.total_weight_kg}</td>
                        <td class="p-1 text-center">
                          <button
                            type="button"
                            onclick={() => deleteDeliveredRecord(item.id)}
                            class="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  {/if}
</div>
