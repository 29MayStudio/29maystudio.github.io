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
    Users,
    History,
    Check,
    Layers,
    Ruler
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

  // Form states - Received
  let rxFabric = $state('');
  let rxDia = $state('');
  let rxGsm = $state('');
  let rxRolls = $state<number | undefined>(undefined);
  let rxWeight = $state<number | undefined>(undefined);
  let rxNote = $state('');
  let rxDate = $state(getTodayString());
  let rxError = $state('');

  // Form states - Delivered
  let dxFabric = $state('');
  let dxDia = $state('');
  let dxGsm = $state('');
  let dxRolls = $state<number | undefined>(undefined);
  let dxWeight = $state<number | undefined>(undefined);
  let dxNote = $state('');
  let dxDate = $state(getTodayString());
  let dxError = $state('');

  onMount(() => {
    seedInitialData().then(() => loadBaseData());

    // Listen for database updates from other screens
    const handleDbUpdate = async () => {
      await loadBaseData();
      if (selectedClient) {
        await loadClientRecords(selectedClient.id!);
      }
    };

    window.addEventListener('db-updated', handleDbUpdate);
    return () => window.removeEventListener('db-updated', handleDbUpdate);
  });

  async function loadBaseData() {
    allClients = await db.clients.orderBy('name').toArray();
    fabricTypes = await db.fabricTypes.orderBy('name').toArray();
    dias = await db.dias.toArray();

    if (fabricTypes.length > 0 && !rxFabric) rxFabric = fabricTypes[0].name;
    if (dias.length > 0 && !rxDia) rxDia = dias[0].value;
    if (fabricTypes.length > 0 && !dxFabric) dxFabric = fabricTypes[0].name;
    if (dias.length > 0 && !dxDia) dxDia = dias[0].value;
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

    // Today's received & delivered
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

    // Past received & delivered (all dates before today or all records)
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

  // Submit Received Record
  async function handleAddReceived(e: SubmitEvent) {
    e.preventDefault();
    rxError = '';

    if (!selectedClient || !selectedClient.id) {
      rxError = 'Please select a client first.';
      return;
    }

    if (!rxWeight || rxWeight <= 0) {
      rxError = 'Please enter a valid fabric weight (kg).';
      return;
    }

    if (!rxFabric.trim()) {
      rxError = 'Please select or enter a fabric type.';
      return;
    }

    if (!rxDia.trim()) {
      rxError = 'Please select or enter a Dia.';
      return;
    }

    await db.receivedRecords.add({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      fabric_type: rxFabric.trim(),
      dia: rxDia.trim(),
      gsm: rxGsm.trim() || undefined,
      rolls: rxRolls || undefined,
      weight_kg: Number(rxWeight),
      date: rxDate || getTodayString(),
      timestamp: new Date().toISOString(),
      note: rxNote.trim() || undefined
    });

    // Reset fields
    rxGsm = '';
    rxRolls = undefined;
    rxWeight = undefined;
    rxNote = '';

    await loadClientRecords(selectedClient.id);
  }

  async function handleDeleteReceived(id?: number) {
    if (!id || !selectedClient?.id) return;
    if (confirm('Delete this received record?')) {
      await db.receivedRecords.delete(id);
      await loadClientRecords(selectedClient.id);
    }
  }

  // Submit Delivered Record
  async function handleAddDelivered(e: SubmitEvent) {
    e.preventDefault();
    dxError = '';

    if (!selectedClient || !selectedClient.id) {
      dxError = 'Please select a client first.';
      return;
    }

    if (!dxWeight || dxWeight <= 0) {
      dxError = 'Please enter a valid fabric weight (kg).';
      return;
    }

    if (!dxFabric.trim()) {
      dxError = 'Please select or enter a fabric type.';
      return;
    }

    if (!dxDia.trim()) {
      dxError = 'Please select or enter a Dia.';
      return;
    }

    await db.deliveredRecords.add({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      fabric_type: dxFabric.trim(),
      dia: dxDia.trim(),
      gsm: dxGsm.trim() || undefined,
      rolls: dxRolls || undefined,
      weight_kg: Number(dxWeight),
      date: dxDate || getTodayString(),
      timestamp: new Date().toISOString(),
      note: dxNote.trim() || undefined
    });

    // Reset fields
    dxGsm = '';
    dxRolls = undefined;
    dxWeight = undefined;
    dxNote = '';

    await loadClientRecords(selectedClient.id);
  }

  async function handleDeleteDelivered(id?: number) {
    if (!id || !selectedClient?.id) return;
    if (confirm('Delete this delivered record?')) {
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
            Select or search a client to view and manage Received & Delivered fabric records.
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
    <!-- SELECTED CLIENT TOP SCREEN -->
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

      <!-- Main Dual Column Area (Left: 3.1 Received | Right: 3.2 Delivered) -->
      <main class="flex-1 overflow-y-auto p-6">
        <!-- Date Bar & History Mode Toggle -->
        <div class="flex items-center justify-between mb-6 bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm">
          <div class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-neutral-300">
            <Calendar class="w-4 h-4 text-emerald-600" />
            <span>Today's Ledger Date: <span class="font-bold text-slate-900 dark:text-white">{todayDate}</span></span>
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
              Today's Records
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
          <!-- TODAY'S TWO SIDE-BY-SIDE PANELS -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            <!-- ================= LEFT COLUMN: 3.1 RECEIVED ================= -->
            <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex flex-col space-y-5">
              <!-- Header -->
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <ArrowDownLeft class="w-5 h-5" />
                  </div>
                  <div>
                    <h2 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      3.1 Received
                    </h2>
                    <p class="text-xs text-slate-500 dark:text-neutral-400">Yarn / Fabric received into factory today</p>
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-xs text-slate-400">Today Total</div>
                  <div class="text-base font-extrabold text-blue-600 dark:text-blue-400">
                    {todayReceivedTotalKg.toFixed(1)} kg
                  </div>
                </div>
              </div>

              <!-- Quick Form: Add Received -->
              <form onsubmit={handleAddReceived} class="bg-slate-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-neutral-800 space-y-3">
                {#if rxError}
                  <div class="text-xs text-rose-500 font-semibold">{rxError}</div>
                {/if}

                <div class="grid grid-cols-2 gap-3">
                  <!-- Fabric Type -->
                  <div>
                    <label for="rx-fabric-select" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                      Fabric Type
                    </label>
                    <select
                      id="rx-fabric-select"
                      bind:value={rxFabric}
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {#each fabricTypes as fabric}
                        <option value={fabric.name}>{fabric.name}</option>
                      {/each}
                    </select>
                  </div>

                  <!-- Dia -->
                  <div>
                    <label for="rx-dia-select" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                      Dia
                    </label>
                    <select
                      id="rx-dia-select"
                      bind:value={rxDia}
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {#each dias as dia}
                        <option value={dia.value}>{dia.value}</option>
                      {/each}
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-3">
                  <!-- Weight in KG (Required) -->
                  <div>
                    <label for="rx-weight-input" class="block text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                      Weight (kg) *
                    </label>
                    <input
                      id="rx-weight-input"
                      type="number"
                      step="0.01"
                      bind:value={rxWeight}
                      placeholder="e.g. 150.5"
                      class="w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-800/80 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <!-- Rolls -->
                  <div>
                    <label for="rx-rolls-input" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                      Rolls
                    </label>
                    <input
                      id="rx-rolls-input"
                      type="number"
                      bind:value={rxRolls}
                      placeholder="e.g. 6"
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <!-- GSM -->
                  <div>
                    <label for="rx-gsm-input" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                      GSM
                    </label>
                    <input
                      id="rx-gsm-input"
                      type="text"
                      bind:value={rxGsm}
                      placeholder="e.g. 180"
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    bind:value={rxNote}
                    placeholder="Note / Remarks (e.g. Lot #12, Machine 4)"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus class="w-4 h-4" /> Save Received Record
                </button>
              </form>

              <!-- Table: Today's Received Items -->
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-3 flex items-center justify-between">
                  <span>Today Received Records ({todayReceivedList.length})</span>
                  <span>Total Rolls: {todayReceivedTotalRolls}</span>
                </h3>

                {#if todayReceivedList.length === 0}
                  <div class="p-6 text-center text-slate-400 dark:text-neutral-500 text-xs border border-dashed border-slate-200 dark:border-neutral-800 rounded-xl">
                    No received fabric records logged for today yet.
                  </div>
                {:else}
                  <div class="overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-xl">
                    <table class="w-full text-left text-xs">
                      <thead class="bg-slate-50 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border-b border-slate-200 dark:border-neutral-700 uppercase">
                        <tr>
                          <th class="px-3 py-2">Fabric</th>
                          <th class="px-3 py-2">Dia/GSM</th>
                          <th class="px-3 py-2">Rolls</th>
                          <th class="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">Weight</th>
                          <th class="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
                        {#each todayReceivedList as item}
                          <tr class="hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                            <td class="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                              {item.fabric_type}
                              {#if item.note}
                                <div class="text-[10px] text-slate-400 font-normal">{item.note}</div>
                              {/if}
                            </td>
                            <td class="px-3 py-2 text-slate-600 dark:text-neutral-300">
                              {item.dia} {#if item.gsm}<span class="text-slate-400">({item.gsm})</span>{/if}
                            </td>
                            <td class="px-3 py-2 text-slate-600 dark:text-neutral-300">
                              {item.rolls ?? '-'}
                            </td>
                            <td class="px-3 py-2 font-extrabold text-blue-600 dark:text-blue-400">
                              {item.weight_kg} kg
                            </td>
                            <td class="px-3 py-2 text-right">
                              <button
                                type="button"
                                onclick={() => handleDeleteReceived(item.id)}
                                class="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                                title="Delete record"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </div>
            </div>


            <!-- ================= RIGHT COLUMN: 3.2 DELIVERED ================= -->
            <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex flex-col space-y-5">
              <!-- Header -->
              <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <ArrowUpRight class="w-5 h-5" />
                  </div>
                  <div>
                    <h2 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      3.2 Delivered
                    </h2>
                    <p class="text-xs text-slate-500 dark:text-neutral-400">Finished knitted fabric delivered to client today</p>
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-xs text-slate-400">Today Total</div>
                  <div class="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {todayDeliveredTotalKg.toFixed(1)} kg
                  </div>
                </div>
              </div>

              <!-- Quick Form: Add Delivered -->
              <form onsubmit={handleAddDelivered} class="bg-slate-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-neutral-800 space-y-3">
                {#if dxError}
                  <div class="text-xs text-rose-500 font-semibold">{dxError}</div>
                {/if}

                <div class="grid grid-cols-2 gap-3">
                  <!-- Fabric Type -->
                  <div>
                    <label for="dx-fabric-select" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                      Fabric Type
                    </label>
                    <select
                      id="dx-fabric-select"
                      bind:value={dxFabric}
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {#each fabricTypes as fabric}
                        <option value={fabric.name}>{fabric.name}</option>
                      {/each}
                    </select>
                  </div>

                  <!-- Dia -->
                  <div>
                    <label for="dx-dia-select" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                      Dia
                    </label>
                    <select
                      id="dx-dia-select"
                      bind:value={dxDia}
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {#each dias as dia}
                        <option value={dia.value}>{dia.value}</option>
                      {/each}
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-3">
                  <!-- Weight in KG (Required) -->
                  <div>
                    <label for="dx-weight-input" class="block text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                      Weight (kg) *
                    </label>
                    <input
                      id="dx-weight-input"
                      type="number"
                      step="0.01"
                      bind:value={dxWeight}
                      placeholder="e.g. 145.0"
                      class="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <!-- Rolls -->
                  <div>
                    <label for="dx-rolls-input" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                      Rolls
                    </label>
                    <input
                      id="dx-rolls-input"
                      type="number"
                      bind:value={dxRolls}
                      placeholder="e.g. 6"
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <!-- GSM -->
                  <div>
                    <label for="dx-gsm-input" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                      GSM
                    </label>
                    <input
                      id="dx-gsm-input"
                      type="text"
                      bind:value={dxGsm}
                      placeholder="e.g. 180"
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    bind:value={dxNote}
                    placeholder="Note / Challan # (e.g. Challan #9012)"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus class="w-4 h-4" /> Save Delivered Record
                </button>
              </form>

              <!-- Table: Today's Delivered Items -->
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-3 flex items-center justify-between">
                  <span>Today Delivered Records ({todayDeliveredList.length})</span>
                  <span>Total Rolls: {todayDeliveredTotalRolls}</span>
                </h3>

                {#if todayDeliveredList.length === 0}
                  <div class="p-6 text-center text-slate-400 dark:text-neutral-500 text-xs border border-dashed border-slate-200 dark:border-neutral-800 rounded-xl">
                    No delivered fabric records logged for today yet.
                  </div>
                {:else}
                  <div class="overflow-x-auto border border-slate-200 dark:border-neutral-800 rounded-xl">
                    <table class="w-full text-left text-xs">
                      <thead class="bg-slate-50 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border-b border-slate-200 dark:border-neutral-700 uppercase">
                        <tr>
                          <th class="px-3 py-2">Fabric</th>
                          <th class="px-3 py-2">Dia/GSM</th>
                          <th class="px-3 py-2">Rolls</th>
                          <th class="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">Weight</th>
                          <th class="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
                        {#each todayDeliveredList as item}
                          <tr class="hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                            <td class="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                              {item.fabric_type}
                              {#if item.note}
                                <div class="text-[10px] text-slate-400 font-normal">{item.note}</div>
                              {/if}
                            </td>
                            <td class="px-3 py-2 text-slate-600 dark:text-neutral-300">
                              {item.dia} {#if item.gsm}<span class="text-slate-400">({item.gsm})</span>{/if}
                            </td>
                            <td class="px-3 py-2 text-slate-600 dark:text-neutral-300">
                              {item.rolls ?? '-'}
                            </td>
                            <td class="px-3 py-2 font-extrabold text-emerald-600 dark:text-emerald-400">
                              {item.weight_kg} kg
                            </td>
                            <td class="px-3 py-2 text-right">
                              <button
                                type="button"
                                onclick={() => handleDeleteDelivered(item.id)}
                                class="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                                title="Delete record"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
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
