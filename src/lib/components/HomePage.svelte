<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
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

  // Multi-item received form state
  interface RxDraftItem {
    yarn_count: string;
    lot: string;
    bags: number | undefined;
    weight_kg: number | undefined;
  }

  interface DxDraftItem {
    yarn_count: string;
    lot: string;
    dia: string;
    rolls: number | undefined;
    weight_kg: number | undefined;
  }

  let rxDate = $state(getTodayString());
  let rxChNo = $state('');
  let rxItems = $state<RxDraftItem[]>([
    { yarn_count: '', lot: '', bags: undefined, weight_kg: undefined }
  ]);

  let rxTotalBags = $derived(
    rxItems.reduce((acc, item) => acc + (item.bags ? Number(item.bags) : 0), 0)
  );
  let rxTotalWeight = $derived(
    Number(
      rxItems
        .reduce((acc, item) => acc + (item.weight_kg ? Number(item.weight_kg) : 0), 0)
        .toFixed(2)
    )
  );

  // Multi-item delivered form state
  let dxDate = $state(getTodayString());
  let dxChNo = $state('');
  let dxItems = $state<DxDraftItem[]>([
    { yarn_count: '', lot: '', dia: '', rolls: undefined, weight_kg: undefined }
  ]);

  let dxTotalRolls = $derived(
    dxItems.reduce((acc, item) => acc + (item.rolls ? Number(item.rolls) : 0), 0)
  );
  let dxTotalWeight = $derived(
    Number(
      dxItems
        .reduce((acc, item) => acc + (item.weight_kg ? Number(item.weight_kg) : 0), 0)
        .toFixed(2)
    )
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
      if (dxItems.length > 0 && !dxItems[0].dia) {
        dxItems[0].dia = dias[0].value;
      }
    }
  }

  async function selectClient(client: Client) {
    selectedClient = client;
    searchQuery = '';
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
  }

  async function loadClientRecords(clientId: number) {
    // Oldest top, below the latest (ascending order)
    todayReceivedList = await db.receivedRecords
      .where('client_id')
      .equals(clientId)
      .sortBy('timestamp');

    todayDeliveredList = await db.deliveredRecords
      .where('client_id')
      .equals(clientId)
      .sortBy('timestamp');
  }

  function addRxDraftRow() {
    rxItems.push({ yarn_count: '', lot: '', bags: undefined, weight_kg: undefined });
  }

  function removeRxDraftRow(index: number) {
    if (rxItems.length > 1) {
      rxItems.splice(index, 1);
    }
  }

  function addDxDraftRow() {
    dxItems.push({ yarn_count: '', lot: '', dia: dias[0]?.value || '', rolls: undefined, weight_kg: undefined });
  }

  function removeDxDraftRow(index: number) {
    if (dxItems.length > 1) {
      dxItems.splice(index, 1);
    }
  }

  // Add Received Record
  async function addReceivedRow() {
    if (!selectedClient?.id) return;

    // Filter valid items that have weight > 0
    const validItems = rxItems.filter((i) => i.weight_kg && i.weight_kg > 0);
    if (validItems.length === 0) return;

    const totalBagsSum = validItems.reduce((acc, i) => acc + (i.bags ? Number(i.bags) : 0), 0);
    const totalWeightSum = Number(
      validItems.reduce((acc, i) => acc + (i.weight_kg ? Number(i.weight_kg) : 0), 0).toFixed(2)
    );

    const first = validItems[0];
    const itemsArray = validItems.map((i) => ({
      yarn_count: i.yarn_count.trim() || '-',
      lot: i.lot.trim() || undefined,
      bags: i.bags ? Number(i.bags) : 0,
      weight_kg: Number(i.weight_kg)
    }));

    await db.receivedRecords.add({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      date: rxDate || getTodayString(),
      ch_no: rxChNo.trim() || '-',
      yarn_count: first.yarn_count.trim() || '-',
      lot: first.lot.trim() || undefined,
      bags: totalBagsSum,
      weight_kg: totalWeightSum,
      total_weight_kg: totalWeightSum,
      items: itemsArray,
      timestamp: new Date().toISOString()
    });

    // Reset inputs
    rxChNo = '';
    rxItems = [{ yarn_count: '', lot: '', bags: undefined, weight_kg: undefined }];

    await loadClientRecords(selectedClient.id);
  }

  // Add Delivered Record
  async function addDeliveredRow() {
    if (!selectedClient?.id) return;

    const validItems = dxItems.filter((i) => i.weight_kg && i.weight_kg > 0);
    if (validItems.length === 0) return;

    const totalRollsSum = validItems.reduce((acc, i) => acc + (i.rolls ? Number(i.rolls) : 0), 0);
    const totalWeightSum = Number(
      validItems.reduce((acc, i) => acc + (i.weight_kg ? Number(i.weight_kg) : 0), 0).toFixed(2)
    );

    const first = validItems[0];
    const itemsArray = validItems.map((i) => ({
      yarn_count: i.yarn_count.trim() || '-',
      lot: i.lot.trim() || undefined,
      dia: i.dia.trim() || (dias[0]?.value ?? '30"'),
      rolls: i.rolls ? Number(i.rolls) : 0,
      weight_kg: Number(i.weight_kg)
    }));

    await db.deliveredRecords.add({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      date: dxDate || getTodayString(),
      ch_no: dxChNo.trim() || '-',
      yarn_count: first.yarn_count.trim() || '-',
      lot: first.lot.trim() || undefined,
      dia: first.dia.trim() || (dias[0]?.value ?? '30"'),
      rolls: totalRollsSum,
      weight_kg: totalWeightSum,
      total_weight_kg: totalWeightSum,
      items: itemsArray,
      timestamp: new Date().toISOString()
    });

    // Reset inputs
    dxChNo = '';
    dxItems = [{ yarn_count: '', lot: '', dia: dias[0]?.value || '', rolls: undefined, weight_kg: undefined }];

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
    <div in:fade={{ duration: 250 }} out:fade={{ duration: 150 }} class="flex-1 flex flex-col items-center justify-center p-6">
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
    <div in:fade={{ duration: 250 }} out:fade={{ duration: 150 }} class="h-full flex flex-col overflow-hidden bg-white dark:bg-black">
      <!-- Top Sticky Bar with Search & Selected Client Big Headline -->
      <header class="bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 px-6 py-3 shrink-0 shadow-sm transition-all">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <!-- Client Name Title -->
          <div>
            <h1 class="text-2xl md:text-3xl font-normal text-slate-900 dark:text-white uppercase">
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
                      <div>{client.name}</div>
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

      <!-- Main Full-Page Dual View (Received | Thick Dividing Line | Delivered) -->
      <main class="flex-1 flex flex-col md:flex-row overflow-hidden divide-y-4 md:divide-y-0 md:divide-x-4 divide-slate-300 dark:divide-neutral-700">

        <!-- ================= LEFT SIDE: RECEIVED ================= -->
        <section class="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-neutral-950/50">
          <div class="bg-blue-700 text-white px-4 py-2 flex items-center justify-between shrink-0">
            <h2 class="text-base font-normal uppercase tracking-wider">Received Tally</h2>
            <span class="text-xs bg-blue-800 px-2.5 py-0.5 rounded-full font-sans">
              Entries: {todayReceivedList.length}
            </span>
          </div>

          <!-- Existing Entries Spreadsheet Table (Scrollable, Ascending Order) -->
          <div class="flex-1 overflow-auto">
            <table class="w-full text-left text-xs border-collapse font-sans">
              <thead class="bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 font-semibold text-xs sticky top-0 z-10 border-b border-slate-300 dark:border-neutral-700">
                <tr class="divide-x divide-slate-300 dark:divide-neutral-700">
                  <th class="px-2.5 py-2 w-24">Date</th>
                  <th class="px-2.5 py-2">CH No.</th>
                  <th class="px-2.5 py-2">Yarn Count</th>
                  <th class="px-2.5 py-2">Lot</th>
                  <th class="px-2.5 py-2 w-16 text-center">Bags</th>
                  <th class="px-2.5 py-2 w-24 text-right">Weight (Kg)</th>
                  <th class="px-2.5 py-2 w-10 text-center">Del</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                {#if todayReceivedList.length === 0}
                  <tr>
                    <td colspan="7" class="p-8 text-center text-slate-400 text-sm italic">
                      No received tally entries found for this client.
                    </td>
                  </tr>
                {:else}
                  {#each todayReceivedList as record}
                    {#if record.items && record.items.length > 0}
                      {#each record.items as item, itemIdx}
                        <tr class="hover:bg-blue-50/40 dark:hover:bg-neutral-800/60 divide-x divide-slate-100 dark:divide-neutral-800">
                          {#if itemIdx === 0}
                            <td rowspan={record.items.length} class="p-2 font-mono text-xs align-top bg-slate-50/30 dark:bg-neutral-900/30">{record.date}</td>
                            <td rowspan={record.items.length} class="p-2 font-semibold text-xs align-top bg-slate-50/30 dark:bg-neutral-900/30">{record.ch_no}</td>
                          {/if}
                          <td class="p-2">{item.yarn_count}</td>
                          <td class="p-2 text-slate-500">{item.lot || '-'}</td>
                          <td class="p-2 text-center font-mono">{item.bags}</td>
                          <td class="p-2 text-right font-mono font-bold text-blue-700 dark:text-blue-400">{item.weight_kg}</td>
                          {#if itemIdx === 0}
                            <td rowspan={record.items.length} class="p-2 text-center align-middle bg-slate-50/30 dark:bg-neutral-900/30">
                              <button
                                type="button"
                                onclick={() => deleteReceivedRecord(record.id)}
                                class="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                                title="Delete Challan Entry"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            </td>
                          {/if}
                        </tr>
                      {/each}
                      <!-- Summary Row for Multi-Item Received Challan -->
                      {#if record.items.length > 1}
                        <tr class="bg-blue-50/60 dark:bg-blue-950/40 font-bold border-b-2 border-blue-200 dark:border-blue-900/50">
                          <td colspan="4" class="p-1.5 text-right text-[11px] uppercase tracking-wider text-blue-800 dark:text-blue-300">
                            Challan Total:
                          </td>
                          <td class="p-1.5 text-center font-mono text-blue-800 dark:text-blue-300">{record.bags}</td>
                          <td class="p-1.5 text-right font-mono text-blue-800 dark:text-blue-300">{record.total_weight_kg} kg</td>
                          <td></td>
                        </tr>
                      {/if}
                    {:else}
                      <!-- Legacy Record Fallback -->
                      <tr class="hover:bg-blue-50/40 dark:hover:bg-neutral-800/60 divide-x divide-slate-100 dark:divide-neutral-800">
                        <td class="p-2 font-mono text-xs">{record.date}</td>
                        <td class="p-2 font-semibold text-xs">{record.ch_no}</td>
                        <td class="p-2">{record.yarn_count}</td>
                        <td class="p-2 text-slate-500">{record.lot || '-'}</td>
                        <td class="p-2 text-center font-mono">{record.bags}</td>
                        <td class="p-2 text-right font-mono font-bold text-blue-700 dark:text-blue-400">{record.weight_kg}</td>
                        <td class="p-2 text-center">
                          <button
                            type="button"
                            onclick={() => deleteReceivedRecord(record.id)}
                            class="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    {/if}
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>

          <!-- BOTTOM FORM: ADD RECEIVED ENTRY -->
          <div class="bg-white dark:bg-neutral-900 border-t-2 border-blue-600 p-3 shrink-0 shadow-lg space-y-2">
            <div class="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-400">
              <span>+ NEW RECEIVED ENTRY FORM</span>
              <span>Total: {rxTotalBags} Bags | {rxTotalWeight} Kg</span>
            </div>

            <!-- Header Row: Date & CH No -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="rx-date" class="block text-[10px] uppercase font-bold text-slate-500">Date</label>
                <input
                  id="rx-date"
                  type="date"
                  bind:value={rxDate}
                  class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label for="rx-ch-no" class="block text-[10px] uppercase font-bold text-slate-500">CH No.</label>
                <input
                  id="rx-ch-no"
                  type="text"
                  bind:value={rxChNo}
                  placeholder="e.g. 1042"
                  class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>

            <!-- Dynamic Yarn Item Draft Inputs -->
            <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {#each rxItems as draftItem, index}
                <div class="flex items-center gap-1.5 bg-blue-50/50 dark:bg-blue-950/20 p-1.5 rounded-lg border border-blue-200/60 dark:border-blue-900/40">
                  <select
                    bind:value={draftItem.yarn_count}
                    class="flex-1 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs"
                  >
                    <option value="">Yarn Count</option>
                    {#each fabricTypes as fabric}
                      <option value={fabric.name}>{fabric.name}</option>
                    {/each}
                  </select>

                  <input
                    type="text"
                    bind:value={draftItem.lot}
                    placeholder="Lot"
                    class="w-16 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs"
                  />

                  <input
                    type="number"
                    bind:value={draftItem.bags}
                    placeholder="Bags"
                    class="w-16 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs text-center"
                  />

                  <input
                    type="number"
                    step="0.01"
                    bind:value={draftItem.weight_kg}
                    placeholder="Kg"
                    class="w-24 bg-white dark:bg-neutral-800 border-2 border-blue-500 rounded px-1.5 py-1 text-xs font-bold text-right"
                  />

                  {#if rxItems.length > 1}
                    <button
                      type="button"
                      onclick={() => removeRxDraftRow(index)}
                      class="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X class="w-3.5 h-3.5" />
                    </button>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Form Actions -->
            <div class="flex items-center justify-between pt-1">
              <button
                type="button"
                onclick={addRxDraftRow}
                class="px-2.5 py-1 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" /> Add Yarn Item
              </button>

              <button
                type="button"
                onclick={addReceivedRow}
                class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus class="w-4 h-4" /> Save Received Entry
              </button>
            </div>
          </div>
        </section>


        <!-- ================= RIGHT SIDE: DELIVERED ================= -->
        <section class="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-neutral-950/50">
          <div class="bg-emerald-700 text-white px-4 py-2 flex items-center justify-between shrink-0">
            <h2 class="text-base font-normal uppercase tracking-wider">Delivered Tally</h2>
            <span class="text-xs bg-emerald-800 px-2.5 py-0.5 rounded-full font-sans">
              Entries: {todayDeliveredList.length}
            </span>
          </div>

          <!-- Existing Entries Spreadsheet Table (Scrollable, Ascending Order) -->
          <div class="flex-1 overflow-auto">
            <table class="w-full text-left text-xs border-collapse font-sans">
              <thead class="bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 font-semibold text-xs sticky top-0 z-10 border-b border-slate-300 dark:border-neutral-700">
                <tr class="divide-x divide-slate-300 dark:divide-neutral-700">
                  <th class="px-2.5 py-2 w-24">Date</th>
                  <th class="px-2.5 py-2">CH No.</th>
                  <th class="px-2.5 py-2">Yarn Count</th>
                  <th class="px-2.5 py-2">Lot</th>
                  <th class="px-2.5 py-2 w-14">Dia</th>
                  <th class="px-2.5 py-2 w-16 text-center">Rolls</th>
                  <th class="px-2.5 py-2 w-24 text-right">Weight (Kg)</th>
                  <th class="px-2.5 py-2 w-10 text-center">Del</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                {#if todayDeliveredList.length === 0}
                  <tr>
                    <td colspan="8" class="p-8 text-center text-slate-400 text-sm italic">
                      No delivered tally entries found for this client.
                    </td>
                  </tr>
                {:else}
                  {#each todayDeliveredList as record}
                    {#if record.items && record.items.length > 0}
                      {#each record.items as item, itemIdx}
                        <tr class="hover:bg-emerald-50/40 dark:hover:bg-neutral-800/60 divide-x divide-slate-100 dark:divide-neutral-800">
                          {#if itemIdx === 0}
                            <td rowspan={record.items.length} class="p-2 font-mono text-xs align-top bg-slate-50/30 dark:bg-neutral-900/30">{record.date}</td>
                            <td rowspan={record.items.length} class="p-2 font-semibold text-xs align-top bg-slate-50/30 dark:bg-neutral-900/30">{record.ch_no}</td>
                          {/if}
                          <td class="p-2">{item.yarn_count}</td>
                          <td class="p-2 text-slate-500">{item.lot || '-'}</td>
                          <td class="p-2 font-semibold text-slate-700 dark:text-neutral-300">{item.dia}</td>
                          <td class="p-2 text-center font-mono">{item.rolls}</td>
                          <td class="p-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{item.weight_kg}</td>
                          {#if itemIdx === 0}
                            <td rowspan={record.items.length} class="p-2 text-center align-middle bg-slate-50/30 dark:bg-neutral-900/30">
                              <button
                                type="button"
                                onclick={() => deleteDeliveredRecord(record.id)}
                                class="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                                title="Delete Challan Entry"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            </td>
                          {/if}
                        </tr>
                      {/each}
                      <!-- Summary Row for Multi-Item Delivered Challan -->
                      {#if record.items.length > 1}
                        <tr class="bg-emerald-50/60 dark:bg-emerald-950/40 font-bold border-b-2 border-emerald-200 dark:border-emerald-900/50">
                          <td colspan="5" class="p-1.5 text-right text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Challan Total:
                          </td>
                          <td class="p-1.5 text-center font-mono text-emerald-800 dark:text-emerald-300">{record.rolls}</td>
                          <td class="p-1.5 text-right font-mono text-emerald-800 dark:text-emerald-300">{record.total_weight_kg} kg</td>
                          <td></td>
                        </tr>
                      {/if}
                    {:else}
                      <!-- Legacy Record Fallback -->
                      <tr class="hover:bg-emerald-50/40 dark:hover:bg-neutral-800/60 divide-x divide-slate-100 dark:divide-neutral-800">
                        <td class="p-2 font-mono text-xs">{record.date}</td>
                        <td class="p-2 font-semibold text-xs">{record.ch_no}</td>
                        <td class="p-2">{record.yarn_count}</td>
                        <td class="p-2 text-slate-500">{record.lot || '-'}</td>
                        <td class="p-2 font-semibold">{record.dia}</td>
                        <td class="p-2 text-center font-mono">{record.rolls}</td>
                        <td class="p-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{record.weight_kg}</td>
                        <td class="p-2 text-center">
                          <button
                            type="button"
                            onclick={() => deleteDeliveredRecord(record.id)}
                            class="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    {/if}
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>

          <!-- BOTTOM FORM: ADD DELIVERED ENTRY -->
          <div class="bg-white dark:bg-neutral-900 border-t-2 border-emerald-600 p-3 shrink-0 shadow-lg space-y-2">
            <div class="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span>+ NEW DELIVERED ENTRY FORM</span>
              <span>Total: {dxTotalRolls} Rolls | {dxTotalWeight} Kg</span>
            </div>

            <!-- Header Row: Date & CH No -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="dx-date" class="block text-[10px] uppercase font-bold text-slate-500">Date</label>
                <input
                  id="dx-date"
                  type="date"
                  bind:value={dxDate}
                  class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label for="dx-ch-no" class="block text-[10px] uppercase font-bold text-slate-500">CH No.</label>
                <input
                  id="dx-ch-no"
                  type="text"
                  bind:value={dxChNo}
                  placeholder="e.g. 5021"
                  class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>

            <!-- Dynamic Yarn Item Draft Inputs -->
            <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {#each dxItems as draftItem, index}
                <div class="flex items-center gap-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 p-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                  <select
                    bind:value={draftItem.yarn_count}
                    class="flex-1 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs"
                  >
                    <option value="">Yarn Count</option>
                    {#each fabricTypes as fabric}
                      <option value={fabric.name}>{fabric.name}</option>
                    {/each}
                  </select>

                  <input
                    type="text"
                    bind:value={draftItem.lot}
                    placeholder="Lot"
                    class="w-14 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs"
                  />

                  <select
                    bind:value={draftItem.dia}
                    class="w-16 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-1 py-1 text-xs font-semibold"
                  >
                    {#each dias as dia}
                      <option value={dia.value}>{dia.value}</option>
                    {/each}
                  </select>

                  <input
                    type="number"
                    bind:value={draftItem.rolls}
                    placeholder="Rolls"
                    class="w-14 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-1.5 py-1 text-xs text-center"
                  />

                  <input
                    type="number"
                    step="0.01"
                    bind:value={draftItem.weight_kg}
                    placeholder="Kg"
                    class="w-20 bg-white dark:bg-neutral-800 border-2 border-emerald-500 rounded px-1.5 py-1 text-xs font-bold text-right"
                  />

                  {#if dxItems.length > 1}
                    <button
                      type="button"
                      onclick={() => removeDxDraftRow(index)}
                      class="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X class="w-3.5 h-3.5" />
                    </button>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Form Actions -->
            <div class="flex items-center justify-between pt-1">
              <button
                type="button"
                onclick={addDxDraftRow}
                class="px-2.5 py-1 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" /> Add Yarn Item
              </button>

              <button
                type="button"
                onclick={addDeliveredRow}
                class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus class="w-4 h-4" /> Save Delivered Entry
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  {/if}
</div>
