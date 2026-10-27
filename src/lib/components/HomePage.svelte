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

  // Filtered autocomplete suggestions
  let autocompleteSuggestions = $derived.by(() => {
    if (!searchQuery.trim()) return allClients;
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

  // Excel Tally Quick New Entry Inputs - Received
  let rxNewFabric = $state('');
  let rxNewDia = $state('');
  let rxNewGsm = $state('');
  let rxNewRolls = $state<number | undefined>(undefined);
  let rxNewWeight = $state<number | undefined>(undefined);
  let rxNewNote = $state('');

  // Excel Tally Quick New Entry Inputs - Delivered
  let dxNewFabric = $state('');
  let dxNewDia = $state('');
  let dxNewGsm = $state('');
  let dxNewRolls = $state<number | undefined>(undefined);
  let dxNewWeight = $state<number | undefined>(undefined);
  let dxNewNote = $state('');

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

    if (fabricTypes.length > 0) {
      if (!rxNewFabric) rxNewFabric = fabricTypes[0].name;
      if (!dxNewFabric) dxNewFabric = fabricTypes[0].name;
    }
    if (dias.length > 0) {
      if (!rxNewDia) rxNewDia = dias[0].value;
      if (!dxNewDia) dxNewDia = dias[0].value;
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
    const today = getTodayString();

    todayReceivedList = await db.receivedRecords
      .where('client_id')
      .equals(clientId)
      .filter((r) => r.date === today)
      .reverse()
      .toArray();

    todayDeliveredList = await db.deliveredRecords
      .where('client_id')
      .equals(clientId)
      .filter((r) => r.date === today)
      .reverse()
      .toArray();

    pastReceivedList = await db.receivedRecords
      .where('client_id')
      .equals(clientId)
      .filter((r) => r.date !== today)
      .reverse()
      .toArray();

    pastDeliveredList = await db.deliveredRecords
      .where('client_id')
      .equals(clientId)
      .filter((r) => r.date !== today)
      .reverse()
      .toArray();
  }

  // Totals calculations
  let todayReceivedTotalKg = $derived(
    todayReceivedList.reduce((acc, item) => acc + (item.weight_kg || 0), 0)
  );
  let todayReceivedTotalRolls = $derived(
    todayReceivedList.reduce((acc, item) => acc + (item.rolls || 0), 0)
  );

  let todayDeliveredTotalKg = $derived(
    todayDeliveredList.reduce((acc, item) => acc + (item.weight_kg || 0), 0)
  );
  let todayDeliveredTotalRolls = $derived(
    todayDeliveredList.reduce((acc, item) => acc + (item.rolls || 0), 0)
  );

  let pastReceivedTotalKg = $derived(
    pastReceivedList.reduce((acc, item) => acc + (item.weight_kg || 0), 0)
  );
  let pastDeliveredTotalKg = $derived(
    pastDeliveredList.reduce((acc, item) => acc + (item.weight_kg || 0), 0)
  );

  // Add Received Record via Tally Grid Row
  async function addReceivedRow() {
    if (!selectedClient?.id) return;
    if (!rxNewWeight || rxNewWeight <= 0) return;

    await db.receivedRecords.add({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      fabric_type: rxNewFabric.trim() || (fabricTypes[0]?.name ?? 'Single Jersey'),
      dia: rxNewDia.trim() || (dias[0]?.value ?? '30"'),
      gsm: rxNewGsm.trim() || undefined,
      rolls: rxNewRolls ? Number(rxNewRolls) : undefined,
      weight_kg: Number(rxNewWeight),
      date: getTodayString(),
      timestamp: new Date().toISOString(),
      note: rxNewNote.trim() || undefined
    });

    // Reset inputs
    rxNewGsm = '';
    rxNewRolls = undefined;
    rxNewWeight = undefined;
    rxNewNote = '';

    await loadClientRecords(selectedClient.id);
  }

  // Add Delivered Record via Tally Grid Row
  async function addDeliveredRow() {
    if (!selectedClient?.id) return;
    if (!dxNewWeight || dxNewWeight <= 0) return;

    await db.deliveredRecords.add({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      fabric_type: dxNewFabric.trim() || (fabricTypes[0]?.name ?? 'Single Jersey'),
      dia: dxNewDia.trim() || (dias[0]?.value ?? '30"'),
      gsm: dxNewGsm.trim() || undefined,
      rolls: dxNewRolls ? Number(dxNewRolls) : undefined,
      weight_kg: Number(dxNewWeight),
      date: getTodayString(),
      timestamp: new Date().toISOString(),
      note: dxNoteField.trim() || undefined
    });

    // Reset inputs
    dxNewGsm = '';
    dxNewRolls = undefined;
    dxNewWeight = undefined;
    dxNewNote = '';

    await loadClientRecords(selectedClient.id);
  }

  let dxNoteField = $derived(dxNewNote);

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
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600/10 text-emerald-600 mb-2">
            <Layers class="w-8 h-8" />
          </div>
          <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Knitting Factory Ledger
          </h1>
          <p class="text-slate-500 dark:text-neutral-400 text-base">
            Select or search a client to open live tally / Excel database records.
          </p>
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
          {#if isSearchFocused || searchQuery.trim().length > 0}
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
          <!-- Big Headline Client Name -->
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <UserCheck class="w-6 h-6" />
            </div>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  {selectedClient.name}
                </h1>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Active Client
                </span>
              </div>
              {#if selectedClient.phone || selectedClient.address}
                <div class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 flex items-center gap-4">
                  {#if selectedClient.phone}<span>📞 {selectedClient.phone}</span>{/if}
                  {#if selectedClient.address}<span>📍 {selectedClient.address}</span>{/if}
                </div>
              {/if}
            </div>
          </div>

          <!-- Top Search & Client Switcher Actions -->
          <div class="flex items-center gap-3">
            <div class="relative w-64 md:w-80">
              <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search other client..."
                class="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onfocus={() => (isSearchFocused = true)}
              />
              <Search class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />

              {#if isSearchFocused && autocompleteSuggestions.length > 0}
                <div class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                  {#each autocompleteSuggestions as client}
                    <button
                      type="button"
                      onclick={() => selectClient(client)}
                      class="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-900 dark:text-white border-b border-slate-100 dark:border-neutral-800/50 cursor-pointer"
                    >
                      <div class="font-bold">{client.name}</div>
                      {#if client.phone}<div class="text-[10px] text-slate-400">{client.phone}</div>{/if}
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

      <!-- Main Dual Column Area (Left: 3.1 Received Tally | Right: 3.2 Delivered Tally) -->
      <main class="flex-1 overflow-y-auto p-6">
        <!-- Date Bar & History Mode Toggle -->
        <div class="flex items-center justify-between mb-6 bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm">
          <div class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-neutral-300">
            <Calendar class="w-4 h-4 text-emerald-600" />
            <span>Live Tally Date: <span class="font-bold text-slate-900 dark:text-white">{todayDate}</span></span>
            <span class="text-[10px] bg-slate-100 dark:bg-neutral-800 text-slate-500 px-2 py-0.5 rounded-md ml-2 font-mono">Excel Live Edit Mode</span>
          </div>

          <!-- Mode Selector (Today vs Past History) -->
          <div class="flex bg-slate-100 dark:bg-neutral-800 p-1 rounded-xl">
            <button
              type="button"
              onclick={() => (showHistoryMode = false)}
              class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !showHistoryMode
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today's Tally Sheet
            </button>
            <button
              type="button"
              onclick={() => (showHistoryMode = true)}
              class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                showHistoryMode
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History class="w-3.5 h-3.5" />
              Past Records History ({pastReceivedList.length + pastDeliveredList.length})
            </button>
          </div>
        </div>

        {#if !showHistoryMode}
          <!-- TODAY'S EXCEL TALLY GRID: SIDE-BY-SIDE PANELS -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            <!-- ================= LEFT COLUMN: 3.1 RECEIVED TALLY GRID ================= -->
            <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
              <!-- Header Bar -->
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <ArrowDownLeft class="w-5 h-5" />
                  </div>
                  <div>
                    <h2 class="text-lg font-bold text-slate-900 dark:text-white">3.1 Received Tally Sheet</h2>
                    <p class="text-xs text-slate-500 dark:text-neutral-400">Live editable grid for yarn / fabric received today</p>
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-[10px] text-slate-400 font-semibold uppercase">Total Received</div>
                  <div class="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                    {todayReceivedTotalKg.toFixed(1)} kg
                  </div>
                </div>
              </div>

              <!-- Excel / Tally Grid Table -->
              <div class="overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-xl bg-slate-50/50 dark:bg-neutral-900/50">
                <table class="w-full text-left text-xs border-collapse font-sans">
                  <!-- Grid Header -->
                  <thead class="bg-blue-600 text-white font-bold text-[11px] uppercase tracking-wider">
                    <tr class="divide-x divide-blue-500">
                      <th class="px-2.5 py-2.5">Fabric Type</th>
                      <th class="px-2 py-2.5 w-20">Dia</th>
                      <th class="px-2 py-2.5 w-16">GSM</th>
                      <th class="px-2 py-2.5 w-16">Rolls</th>
                      <th class="px-2.5 py-2.5 w-24">Weight (kg)</th>
                      <th class="px-2.5 py-2.5">Note</th>
                      <th class="px-2 py-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>

                  <tbody class="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                    <!-- TOP TALLY QUICK ADD ROW -->
                    <tr class="bg-blue-50/70 dark:bg-blue-950/30 divide-x divide-blue-100 dark:divide-blue-900/40 border-b-2 border-blue-500/30">
                      <!-- Fabric Type select -->
                      <td class="p-1">
                        <select
                          bind:value={rxNewFabric}
                          class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-1 text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                        >
                          {#each fabricTypes as fabric}
                            <option value={fabric.name}>{fabric.name}</option>
                          {/each}
                        </select>
                      </td>

                      <!-- Dia select -->
                      <td class="p-1">
                        <select
                          bind:value={rxNewDia}
                          class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-1 text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                        >
                          {#each dias as dia}
                            <option value={dia.value}>{dia.value}</option>
                          {/each}
                        </select>
                      </td>

                      <!-- GSM input -->
                      <td class="p-1">
                        <input
                          type="text"
                          bind:value={rxNewGsm}
                          placeholder="180"
                          class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 text-center"
                        />
                      </td>

                      <!-- Rolls input -->
                      <td class="p-1">
                        <input
                          type="number"
                          bind:value={rxNewRolls}
                          placeholder="6"
                          class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 text-center font-mono"
                        />
                      </td>

                      <!-- Weight (kg) required input + Enter key listener -->
                      <td class="p-1">
                        <input
                          type="number"
                          step="0.01"
                          bind:value={rxNewWeight}
                          placeholder="0.00"
                          onkeydown={(e) => { if (e.key === 'Enter') addReceivedRow(); }}
                          class="w-full bg-blue-100/80 dark:bg-blue-900/50 border-2 border-blue-500 rounded px-1.5 py-1 text-xs font-extrabold text-blue-700 dark:text-blue-300 focus:ring-2 focus:ring-blue-500 text-right font-mono"
                        />
                      </td>

                      <!-- Note input -->
                      <td class="p-1">
                        <input
                          type="text"
                          bind:value={rxNewNote}
                          placeholder="Remarks / Lot"
                          onkeydown={(e) => { if (e.key === 'Enter') addReceivedRow(); }}
                          class="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      <!-- Add button cell -->
                      <td class="p-1 text-center">
                        <button
                          type="button"
                          onclick={addReceivedRow}
                          class="w-full py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs flex items-center justify-center cursor-pointer shadow-sm"
                          title="Add Tally Row"
                        >
                          <Plus class="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    <!-- LIVE EXISTING ENTRIES ROWS -->
                    {#if todayReceivedList.length === 0}
                      <tr>
                        <td colspan="7" class="p-6 text-center text-slate-400 text-xs italic">
                          No received entries recorded today yet. Type in top row to enter tally.
                        </td>
                      </tr>
                    {:else}
                      {#each todayReceivedList as item}
                        <tr class="hover:bg-blue-50/40 dark:hover:bg-neutral-800/60 divide-x divide-slate-100 dark:divide-neutral-800">
                          <!-- Fabric Type Editable Cell -->
                          <td class="p-1">
                            <select
                              value={item.fabric_type}
                              onchange={(e) => updateReceivedCell(item.id, 'fabric_type', (e.target as HTMLSelectElement).value)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-blue-500 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-900 dark:text-white"
                            >
                              {#each fabricTypes as fabric}
                                <option value={fabric.name}>{fabric.name}</option>
                              {/each}
                            </select>
                          </td>

                          <!-- Dia Editable Cell -->
                          <td class="p-1">
                            <select
                              value={item.dia}
                              onchange={(e) => updateReceivedCell(item.id, 'dia', (e.target as HTMLSelectElement).value)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-blue-500 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-900 dark:text-white"
                            >
                              {#each dias as dia}
                                <option value={dia.value}>{dia.value}</option>
                              {/each}
                            </select>
                          </td>

                          <!-- GSM Editable Cell -->
                          <td class="p-1">
                            <input
                              type="text"
                              value={item.gsm || ''}
                              onblur={(e) => updateReceivedCell(item.id, 'gsm', (e.target as HTMLInputElement).value)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-blue-500 rounded px-1.5 py-0.5 text-xs text-center text-slate-600 dark:text-neutral-300"
                            />
                          </td>

                          <!-- Rolls Editable Cell -->
                          <td class="p-1">
                            <input
                              type="number"
                              value={item.rolls ?? ''}
                              onblur={(e) => updateReceivedCell(item.id, 'rolls', Number((e.target as HTMLInputElement).value) || undefined)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-blue-500 rounded px-1.5 py-0.5 text-xs text-center font-mono font-semibold text-slate-700 dark:text-neutral-200"
                            />
                          </td>

                          <!-- Weight (kg) Editable Cell -->
                          <td class="p-1">
                            <input
                              type="number"
                              step="0.01"
                              value={item.weight_kg}
                              onblur={(e) => updateReceivedCell(item.id, 'weight_kg', Number((e.target as HTMLInputElement).value) || item.weight_kg)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-blue-500 rounded px-1.5 py-0.5 text-xs text-right font-mono font-extrabold text-blue-600 dark:text-blue-400"
                            />
                          </td>

                          <!-- Note Editable Cell -->
                          <td class="p-1">
                            <input
                              type="text"
                              value={item.note || ''}
                              onblur={(e) => updateReceivedCell(item.id, 'note', (e.target as HTMLInputElement).value)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-500 dark:text-neutral-400"
                            />
                          </td>

                          <!-- Delete Action -->
                          <td class="p-1 text-center">
                            <button
                              type="button"
                              onclick={() => deleteReceivedRecord(item.id)}
                              class="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                              title="Delete Tally Row"
                            >
                              <Trash2 class="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      {/each}
                    {/if}
                  </tbody>

                  <!-- TOTALS FOOTER ROW -->
                  <tfoot class="bg-blue-100/70 dark:bg-blue-950/60 font-bold text-xs text-slate-900 dark:text-white border-t-2 border-blue-500">
                    <tr class="divide-x divide-blue-200 dark:divide-blue-900">
                      <td colspan="3" class="px-3 py-2 text-right uppercase tracking-wider font-extrabold text-[11px] text-blue-800 dark:text-blue-300">
                        Received Totals:
                      </td>
                      <td class="px-2 py-2 text-center font-mono text-slate-800 dark:text-neutral-100">
                        {todayReceivedTotalRolls} rolls
                      </td>
                      <td class="px-2.5 py-2 text-right font-mono font-black text-sm text-blue-700 dark:text-blue-300">
                        {todayReceivedTotalKg.toFixed(1)} kg
                      </td>
                      <td colspan="2" class="px-2 py-2 text-[10px] text-slate-500 italic">
                        {todayReceivedList.length} rows
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>


            <!-- ================= RIGHT COLUMN: 3.2 DELIVERED TALLY GRID ================= -->
            <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
              <!-- Header Bar -->
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <ArrowUpRight class="w-5 h-5" />
                  </div>
                  <div>
                    <h2 class="text-lg font-bold text-slate-900 dark:text-white">3.2 Delivered Tally Sheet</h2>
                    <p class="text-xs text-slate-500 dark:text-neutral-400">Live editable grid for finished fabric delivered today</p>
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-[10px] text-slate-400 font-semibold uppercase">Total Delivered</div>
                  <div class="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {todayDeliveredTotalKg.toFixed(1)} kg
                  </div>
                </div>
              </div>

              <!-- Excel / Tally Grid Table -->
              <div class="overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-xl bg-slate-50/50 dark:bg-neutral-900/50">
                <table class="w-full text-left text-xs border-collapse font-sans">
                  <!-- Grid Header -->
                  <thead class="bg-emerald-600 text-white font-bold text-[11px] uppercase tracking-wider">
                    <tr class="divide-x divide-emerald-500">
                      <th class="px-2.5 py-2.5">Fabric Type</th>
                      <th class="px-2 py-2.5 w-20">Dia</th>
                      <th class="px-2 py-2.5 w-16">GSM</th>
                      <th class="px-2 py-2.5 w-16">Rolls</th>
                      <th class="px-2.5 py-2.5 w-24">Weight (kg)</th>
                      <th class="px-2.5 py-2.5">Note</th>
                      <th class="px-2 py-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>

                  <tbody class="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                    <!-- TOP TALLY QUICK ADD ROW -->
                    <tr class="bg-emerald-50/70 dark:bg-emerald-950/30 divide-x divide-emerald-100 dark:divide-emerald-900/40 border-b-2 border-emerald-500/30">
                      <!-- Fabric Type select -->
                      <td class="p-1">
                        <select
                          bind:value={dxNewFabric}
                          class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-1 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                        >
                          {#each fabricTypes as fabric}
                            <option value={fabric.name}>{fabric.name}</option>
                          {/each}
                        </select>
                      </td>

                      <!-- Dia select -->
                      <td class="p-1">
                        <select
                          bind:value={dxNewDia}
                          class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-1 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                        >
                          {#each dias as dia}
                            <option value={dia.value}>{dia.value}</option>
                          {/each}
                        </select>
                      </td>

                      <!-- GSM input -->
                      <td class="p-1">
                        <input
                          type="text"
                          bind:value={dxNewGsm}
                          placeholder="180"
                          class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-emerald-500 text-center"
                        />
                      </td>

                      <!-- Rolls input -->
                      <td class="p-1">
                        <input
                          type="number"
                          bind:value={dxNewRolls}
                          placeholder="6"
                          class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-emerald-500 text-center font-mono"
                        />
                      </td>

                      <!-- Weight (kg) required input + Enter key listener -->
                      <td class="p-1">
                        <input
                          type="number"
                          step="0.01"
                          bind:value={dxNewWeight}
                          placeholder="0.00"
                          onkeydown={(e) => { if (e.key === 'Enter') addDeliveredRow(); }}
                          class="w-full bg-emerald-100/80 dark:bg-emerald-900/50 border-2 border-emerald-500 rounded px-1.5 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500 text-right font-mono"
                        />
                      </td>

                      <!-- Note input -->
                      <td class="p-1">
                        <input
                          type="text"
                          bind:value={dxNewNote}
                          placeholder="Challan #"
                          onkeydown={(e) => { if (e.key === 'Enter') addDeliveredRow(); }}
                          class="w-full bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>

                      <!-- Add button cell -->
                      <td class="p-1 text-center">
                        <button
                          type="button"
                          onclick={addDeliveredRow}
                          class="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center justify-center cursor-pointer shadow-sm"
                          title="Add Tally Row"
                        >
                          <Plus class="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    <!-- LIVE EXISTING ENTRIES ROWS -->
                    {#if todayDeliveredList.length === 0}
                      <tr>
                        <td colspan="7" class="p-6 text-center text-slate-400 text-xs italic">
                          No delivered entries recorded today yet. Type in top row to enter tally.
                        </td>
                      </tr>
                    {:else}
                      {#each todayDeliveredList as item}
                        <tr class="hover:bg-emerald-50/40 dark:hover:bg-neutral-800/60 divide-x divide-slate-100 dark:divide-neutral-800">
                          <!-- Fabric Type Editable Cell -->
                          <td class="p-1">
                            <select
                              value={item.fabric_type}
                              onchange={(e) => updateDeliveredCell(item.id, 'fabric_type', (e.target as HTMLSelectElement).value)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-900 dark:text-white"
                            >
                              {#each fabricTypes as fabric}
                                <option value={fabric.name}>{fabric.name}</option>
                              {/each}
                            </select>
                          </td>

                          <!-- Dia Editable Cell -->
                          <td class="p-1">
                            <select
                              value={item.dia}
                              onchange={(e) => updateDeliveredCell(item.id, 'dia', (e.target as HTMLSelectElement).value)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-900 dark:text-white"
                            >
                              {#each dias as dia}
                                <option value={dia.value}>{dia.value}</option>
                              {/each}
                            </select>
                          </td>

                          <!-- GSM Editable Cell -->
                          <td class="p-1">
                            <input
                              type="text"
                              value={item.gsm || ''}
                              onblur={(e) => updateDeliveredCell(item.id, 'gsm', (e.target as HTMLInputElement).value)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs text-center text-slate-600 dark:text-neutral-300"
                            />
                          </td>

                          <!-- Rolls Editable Cell -->
                          <td class="p-1">
                            <input
                              type="number"
                              value={item.rolls ?? ''}
                              onblur={(e) => updateDeliveredCell(item.id, 'rolls', Number((e.target as HTMLInputElement).value) || undefined)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs text-center font-mono font-semibold text-slate-700 dark:text-neutral-200"
                            />
                          </td>

                          <!-- Weight (kg) Editable Cell -->
                          <td class="p-1">
                            <input
                              type="number"
                              step="0.01"
                              value={item.weight_kg}
                              onblur={(e) => updateDeliveredCell(item.id, 'weight_kg', Number((e.target as HTMLInputElement).value) || item.weight_kg)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400"
                            />
                          </td>

                          <!-- Note Editable Cell -->
                          <td class="p-1">
                            <input
                              type="text"
                              value={item.note || ''}
                              onblur={(e) => updateDeliveredCell(item.id, 'note', (e.target as HTMLInputElement).value)}
                              class="w-full bg-transparent hover:bg-white dark:hover:bg-neutral-800 border border-transparent focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs text-slate-500 dark:text-neutral-400"
                            />
                          </td>

                          <!-- Delete Action -->
                          <td class="p-1 text-center">
                            <button
                              type="button"
                              onclick={() => deleteDeliveredRecord(item.id)}
                              class="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                              title="Delete Tally Row"
                            >
                              <Trash2 class="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      {/each}
                    {/if}
                  </tbody>

                  <!-- TOTALS FOOTER ROW -->
                  <tfoot class="bg-emerald-100/70 dark:bg-emerald-950/60 font-bold text-xs text-slate-900 dark:text-white border-t-2 border-emerald-500">
                    <tr class="divide-x divide-emerald-200 dark:divide-emerald-900">
                      <td colspan="3" class="px-3 py-2 text-right uppercase tracking-wider font-extrabold text-[11px] text-emerald-800 dark:text-emerald-300">
                        Delivered Totals:
                      </td>
                      <td class="px-2 py-2 text-center font-mono text-slate-800 dark:text-neutral-100">
                        {todayDeliveredTotalRolls} rolls
                      </td>
                      <td class="px-2.5 py-2 text-right font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                        {todayDeliveredTotalKg.toFixed(1)} kg
                      </td>
                      <td colspan="2" class="px-2 py-2 text-[10px] text-slate-500 italic">
                        {todayDeliveredList.length} rows
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>

        {:else}
          <!-- HISTORICAL RECORDS VIEW -->
          <div class="space-y-6">
            <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
              <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
                <span>Historical Records for {selectedClient.name}</span>
                <span class="text-xs text-slate-500 font-normal">Showing previous dates logs</span>
              </h2>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Past Received -->
                <div>
                  <h3 class="text-sm font-bold text-blue-600 dark:text-blue-400 mb-3 flex items-center justify-between">
                    <span>Past Received ({pastReceivedList.length})</span>
                    <span>Total: {pastReceivedTotalKg.toFixed(1)} kg</span>
                  </h3>
                  {#if pastReceivedList.length === 0}
                    <div class="p-4 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                      No historical received records.
                    </div>
                  {:else}
                    <div class="overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-xl">
                      <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 dark:bg-neutral-800 text-slate-500 border-b border-slate-200 dark:border-neutral-700 uppercase">
                          <tr>
                            <th class="px-3 py-2">Date</th>
                            <th class="px-3 py-2">Fabric</th>
                            <th class="px-3 py-2">Dia</th>
                            <th class="px-3 py-2 font-bold">Weight</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
                          {#each pastReceivedList as item}
                            <tr>
                              <td class="px-3 py-2 font-mono text-[11px] text-slate-500">{item.date}</td>
                              <td class="px-3 py-2 font-medium text-slate-900 dark:text-white">{item.fabric_type}</td>
                              <td class="px-3 py-2">{item.dia}</td>
                              <td class="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">{item.weight_kg} kg</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  {/if}
                </div>

                <!-- Past Delivered -->
                <div>
                  <h3 class="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center justify-between">
                    <span>Past Delivered ({pastDeliveredList.length})</span>
                    <span>Total: {pastDeliveredTotalKg.toFixed(1)} kg</span>
                  </h3>
                  {#if pastDeliveredList.length === 0}
                    <div class="p-4 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                      No historical delivered records.
                    </div>
                  {:else}
                    <div class="overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-xl">
                      <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 dark:bg-neutral-800 text-slate-500 border-b border-slate-200 dark:border-neutral-700 uppercase">
                          <tr>
                            <th class="px-3 py-2">Date</th>
                            <th class="px-3 py-2">Fabric</th>
                            <th class="px-3 py-2">Dia</th>
                            <th class="px-3 py-2 font-bold">Weight</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
                          {#each pastDeliveredList as item}
                            <tr>
                              <td class="px-3 py-2 font-mono text-[11px] text-slate-500">{item.date}</td>
                              <td class="px-3 py-2 font-medium text-slate-900 dark:text-white">{item.fabric_type}</td>
                              <td class="px-3 py-2">{item.dia}</td>
                              <td class="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{item.weight_kg} kg</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>
