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
    Layers,
    CircleHelp,
    Pencil,
    FileText,
    Printer
  } from 'lucide-svelte';
  import Dialog from './ui/Dialog.svelte';

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

  // Active Popover state for Del column options
  let activePopover = $state<{ type: 'received' | 'delivered'; id: number } | null>(null);

  // Confirm Modal state
  let confirmModal = $state<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  function confirmDeleteRecord(type: 'received' | 'delivered', id: number) {
    confirmModal = {
      open: true,
      title: 'Delete Entry',
      message: `Are you sure you want to delete this ${type} entry? This action cannot be undone.`,
      onConfirm: async () => {
        confirmModal.open = false;
        if (type === 'received') {
          await db.receivedRecords.delete(id);
        } else {
          await db.deliveredRecords.delete(id);
        }
        if (selectedClient?.id) {
          await loadClientRecords(selectedClient.id);
        }
        window.dispatchEvent(new CustomEvent('db-updated'));
      }
    };
  }

  // Edit Received Record Modal state
  let editingReceived = $state<{
    open: boolean;
    id?: number;
    date: string;
    ch_no: string;
    items: { yarn_count: string; lot: string; bags: number | undefined; weight_kg: number | undefined }[];
  }>({
    open: false,
    date: '',
    ch_no: '',
    items: []
  });

  function openEditReceivedModal(record: ReceivedRecord) {
    if (!record.id) return;
    const items = record.items && record.items.length > 0
      ? record.items.map(i => ({ yarn_count: i.yarn_count, lot: i.lot || '', bags: i.bags, weight_kg: i.weight_kg }))
      : [{ yarn_count: record.yarn_count || '', lot: record.lot || '', bags: record.bags || 0, weight_kg: record.weight_kg || 0 }];

    editingReceived = {
      open: true,
      id: record.id,
      date: record.date,
      ch_no: record.ch_no,
      items
    };
  }

  async function saveEditReceived() {
    if (!editingReceived.id || !selectedClient?.id) return;
    const validItems = editingReceived.items.filter(i => i.weight_kg && Number(i.weight_kg) > 0);
    if (validItems.length === 0) return;

    const totalBagsSum = validItems.reduce((acc, i) => acc + (i.bags ? Number(i.bags) : 0), 0);
    const totalWeightSum = Number(
      validItems.reduce((acc, i) => acc + (i.weight_kg ? Number(i.weight_kg) : 0), 0).toFixed(2)
    );

    const first = validItems[0];
    const existing = await db.receivedRecords.get(editingReceived.id);

    await db.receivedRecords.put({
      ...existing,
      id: editingReceived.id,
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      date: editingReceived.date,
      ch_no: editingReceived.ch_no.trim() || '-',
      yarn_count: first.yarn_count.trim() || '-',
      lot: first.lot.trim() || undefined,
      bags: totalBagsSum,
      weight_kg: totalWeightSum,
      total_weight_kg: totalWeightSum,
      items: validItems.map(i => ({
        yarn_count: i.yarn_count.trim() || '-',
        lot: i.lot.trim() || undefined,
        bags: Number(i.bags) || 0,
        weight_kg: Number(i.weight_kg)
      })),
      timestamp: existing?.timestamp || new Date().toISOString()
    });

    editingReceived.open = false;
    await loadClientRecords(selectedClient.id);
    window.dispatchEvent(new CustomEvent('db-updated'));
  }

  // Edit Delivered Record Modal state
  let editingDelivered = $state<{
    open: boolean;
    id?: number;
    date: string;
    ch_no: string;
    items: { yarn_count: string; lot: string; dia: string; rolls: number | undefined; weight_kg: number | undefined }[];
  }>({
    open: false,
    date: '',
    ch_no: '',
    items: []
  });

  function openEditDeliveredModal(record: DeliveredRecord) {
    if (!record.id) return;
    const items = record.items && record.items.length > 0
      ? record.items.map(i => ({ yarn_count: i.yarn_count, lot: i.lot || '', dia: i.dia || (dias[0]?.value ?? '30"'), rolls: i.rolls, weight_kg: i.weight_kg }))
      : [{ yarn_count: record.yarn_count || '', lot: record.lot || '', dia: record.dia || (dias[0]?.value ?? '30"'), rolls: record.rolls || 0, weight_kg: record.weight_kg || 0 }];

    editingDelivered = {
      open: true,
      id: record.id,
      date: record.date,
      ch_no: record.ch_no,
      items
    };
  }

  async function saveEditDelivered() {
    if (!editingDelivered.id || !selectedClient?.id) return;
    const validItems = editingDelivered.items.filter(i => i.weight_kg && Number(i.weight_kg) > 0);
    if (validItems.length === 0) return;

    const totalRollsSum = validItems.reduce((acc, i) => acc + (i.rolls ? Number(i.rolls) : 0), 0);
    const totalWeightSum = Number(
      validItems.reduce((acc, i) => acc + (i.weight_kg ? Number(i.weight_kg) : 0), 0).toFixed(2)
    );

    const first = validItems[0];
    const existing = await db.deliveredRecords.get(editingDelivered.id);

    await db.deliveredRecords.put({
      ...existing,
      id: editingDelivered.id,
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      date: editingDelivered.date,
      ch_no: editingDelivered.ch_no.trim() || '-',
      yarn_count: first.yarn_count.trim() || '-',
      lot: first.lot.trim() || undefined,
      dia: first.dia.trim() || (dias[0]?.value ?? '30"'),
      rolls: totalRollsSum,
      weight_kg: totalWeightSum,
      total_weight_kg: totalWeightSum,
      items: validItems.map(i => ({
        yarn_count: i.yarn_count.trim() || '-',
        lot: i.lot.trim() || undefined,
        dia: i.dia.trim() || (dias[0]?.value ?? '30"'),
        rolls: Number(i.rolls) || 0,
        weight_kg: Number(i.weight_kg)
      })),
      timestamp: existing?.timestamp || new Date().toISOString()
    });

    editingDelivered.open = false;
    await loadClientRecords(selectedClient.id);
    window.dispatchEvent(new CustomEvent('db-updated'));
  }

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
    // Sort primarily by date ascending (oldest date on top, newest date on bottom), then by timestamp ascending
    const rx = await db.receivedRecords
      .where('client_id')
      .equals(clientId)
      .toArray();

    rx.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    todayReceivedList = rx;

    const dx = await db.deliveredRecords
      .where('client_id')
      .equals(clientId)
      .toArray();

    dx.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    todayDeliveredList = dx;
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
    window.dispatchEvent(new CustomEvent('db-updated'));
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
    window.dispatchEvent(new CustomEvent('db-updated'));
  }

  async function deleteReceivedRecord(id?: number) {
    if (!id) return;
    confirmDeleteRecord('received', id);
  }

  async function deleteDeliveredRecord(id?: number) {
    if (!id) return;
    confirmDeleteRecord('delivered', id);
  }

  // Statement Print Modal state
  let isStatementModalOpen = $state(false);
  let statementStartDate = $state('');
  let statementEndDate = $state('');

  function openStatementModal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    statementStartDate = `${year}-${month}-01`;
    statementEndDate = getTodayString();
    isStatementModalOpen = true;
  }

  let filteredStatementReceived = $derived.by(() => {
    if (!statementStartDate || !statementEndDate) return todayReceivedList;
    return todayReceivedList.filter(
      (r) => r.date >= statementStartDate && r.date <= statementEndDate
    );
  });

  let filteredStatementDelivered = $derived.by(() => {
    if (!statementStartDate || !statementEndDate) return todayDeliveredList;
    return todayDeliveredList.filter(
      (d) => d.date >= statementStartDate && d.date <= statementEndDate
    );
  });

  let statementRxTotalBags = $derived(
    filteredStatementReceived.reduce((acc, r) => acc + (r.bags || 0), 0)
  );
  let statementRxTotalWeight = $derived(
    Number(
      filteredStatementReceived.reduce((acc, r) => acc + (r.total_weight_kg || r.weight_kg || 0), 0).toFixed(2)
    )
  );

  let statementDxTotalRolls = $derived(
    filteredStatementDelivered.reduce((acc, d) => acc + (d.rolls || 0), 0)
  );
  let statementDxTotalWeight = $derived(
    Number(
      filteredStatementDelivered.reduce((acc, d) => acc + (d.total_weight_kg || d.weight_kg || 0), 0).toFixed(2)
    )
  );

  function handlePrintStatement() {
    window.print();
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
                  <div class="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-neutral-500">
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
          <!-- Client Name Title & Statement Button -->
          <div class="flex items-center gap-3">
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-2xl md:text-3xl font-normal text-slate-900 dark:text-white">
                  {selectedClient.name}
                </h1>
                <button
                  type="button"
                  onclick={openStatementModal}
                  class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText class="w-4 h-4" /> Statement
                </button>
              </div>
              {#if selectedClient.address}
                <div class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  📍 {selectedClient.address}
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
            <h2 class="text-base font-normal">Received Tally</h2>
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
                              <div class="relative inline-block text-left" role="presentation" onmouseleave={() => (activePopover = null)}>
                                <button
                                  type="button"
                                  onmouseenter={() => (activePopover = { type: 'received', id: record.id! })}
                                  onclick={() => {
                                    if (activePopover?.type === 'received' && activePopover?.id === record.id) {
                                      activePopover = null;
                                    } else {
                                      activePopover = { type: 'received', id: record.id! };
                                    }
                                  }}
                                  class="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                                  title="Actions"
                                >
                                  <CircleHelp class="w-4 h-4" />
                                </button>

                                {#if activePopover?.type === 'received' && activePopover?.id === record.id}
                                  <div class="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-xl z-30 p-1 font-sans">
                                    <button
                                      type="button"
                                      onclick={() => {
                                        activePopover = null;
                                        openEditReceivedModal(record);
                                      }}
                                      class="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Pencil class="w-3.5 h-3.5 text-blue-500" /> Edit
                                    </button>
                                    <button
                                      type="button"
                                      onclick={() => {
                                        activePopover = null;
                                        confirmDeleteRecord('received', record.id!);
                                      }}
                                      class="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Trash2 class="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </div>
                                {/if}
                              </div>
                            </td>
                          {/if}
                        </tr>
                      {/each}
                      <!-- Summary Row for Multi-Item Received Challan -->
                      {#if record.items.length > 1}
                        <tr class="bg-blue-50/60 dark:bg-blue-950/40 font-bold border-b-2 border-blue-200 dark:border-blue-900/50">
                          <td colspan="4" class="p-1.5 text-right text-[11px] text-blue-800 dark:text-blue-300">
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
                          <div class="relative inline-block text-left" role="presentation" onmouseleave={() => (activePopover = null)}>
                            <button
                              type="button"
                              onmouseenter={() => (activePopover = { type: 'received', id: record.id! })}
                              onclick={() => {
                                if (activePopover?.type === 'received' && activePopover?.id === record.id) {
                                  activePopover = null;
                                } else {
                                  activePopover = { type: 'received', id: record.id! };
                                }
                              }}
                              class="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Actions"
                            >
                              <CircleHelp class="w-4 h-4" />
                            </button>

                            {#if activePopover?.type === 'received' && activePopover?.id === record.id}
                              <div class="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-xl z-30 p-1 font-sans">
                                <button
                                  type="button"
                                  onclick={() => {
                                    activePopover = null;
                                    openEditReceivedModal(record);
                                  }}
                                  class="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Pencil class="w-3.5 h-3.5 text-blue-500" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onclick={() => {
                                    activePopover = null;
                                    confirmDeleteRecord('received', record.id!);
                                  }}
                                  class="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 class="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            {/if}
                          </div>
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
              <span>+ New Received Entry Form</span>
              <span>Total: {rxTotalBags} Bags | {rxTotalWeight} Kg</span>
            </div>

            <!-- Header Row: Date & CH No -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="rx-date" class="block text-[10px] font-bold text-slate-500">Date</label>
                <input
                  id="rx-date"
                  type="date"
                  bind:value={rxDate}
                  class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label for="rx-ch-no" class="block text-[10px] font-bold text-slate-500">CH No.</label>
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
            <h2 class="text-base font-normal">Delivered Tally</h2>
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
                              <div class="relative inline-block text-left" role="presentation" onmouseleave={() => (activePopover = null)}>
                                <button
                                  type="button"
                                  onmouseenter={() => (activePopover = { type: 'delivered', id: record.id! })}
                                  onclick={() => {
                                    if (activePopover?.type === 'delivered' && activePopover?.id === record.id) {
                                      activePopover = null;
                                    } else {
                                      activePopover = { type: 'delivered', id: record.id! };
                                    }
                                  }}
                                  class="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                                  title="Actions"
                                >
                                  <CircleHelp class="w-4 h-4" />
                                </button>

                                {#if activePopover?.type === 'delivered' && activePopover?.id === record.id}
                                  <div class="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-xl z-30 p-1 font-sans">
                                    <button
                                      type="button"
                                      onclick={() => {
                                        activePopover = null;
                                        openEditDeliveredModal(record);
                                      }}
                                      class="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Pencil class="w-3.5 h-3.5 text-emerald-500" /> Edit
                                    </button>
                                    <button
                                      type="button"
                                      onclick={() => {
                                        activePopover = null;
                                        confirmDeleteRecord('delivered', record.id!);
                                      }}
                                      class="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Trash2 class="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </div>
                                {/if}
                              </div>
                            </td>
                          {/if}
                        </tr>
                      {/each}
                      <!-- Summary Row for Multi-Item Delivered Challan -->
                      {#if record.items.length > 1}
                        <tr class="bg-emerald-50/60 dark:bg-emerald-950/40 font-bold border-b-2 border-emerald-200 dark:border-emerald-900/50">
                          <td colspan="5" class="p-1.5 text-right text-[11px] text-emerald-800 dark:text-emerald-300">
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
                          <div class="relative inline-block text-left" role="presentation" onmouseleave={() => (activePopover = null)}>
                            <button
                              type="button"
                              onmouseenter={() => (activePopover = { type: 'delivered', id: record.id! })}
                              onclick={() => {
                                if (activePopover?.type === 'delivered' && activePopover?.id === record.id) {
                                  activePopover = null;
                                } else {
                                  activePopover = { type: 'delivered', id: record.id! };
                                }
                              }}
                              class="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Actions"
                            >
                              <CircleHelp class="w-4 h-4" />
                            </button>

                            {#if activePopover?.type === 'delivered' && activePopover?.id === record.id}
                              <div class="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-xl z-30 p-1 font-sans">
                                <button
                                  type="button"
                                  onclick={() => {
                                    activePopover = null;
                                    openEditDeliveredModal(record);
                                  }}
                                  class="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Pencil class="w-3.5 h-3.5 text-emerald-500" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onclick={() => {
                                    activePopover = null;
                                    confirmDeleteRecord('delivered', record.id!);
                                  }}
                                  class="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 class="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            {/if}
                          </div>
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
              <span>+ New Delivered Entry Form</span>
              <span>Total: {dxTotalRolls} Rolls | {dxTotalWeight} Kg</span>
            </div>

            <!-- Header Row: Date & CH No -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="dx-date" class="block text-[10px] font-bold text-slate-500">Date</label>
                <input
                  id="dx-date"
                  type="date"
                  bind:value={dxDate}
                  class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label for="dx-ch-no" class="block text-[10px] font-bold text-slate-500">CH No.</label>
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

<!-- CUSTOM CONFIRMATION DIALOG -->
<Dialog open={confirmModal.open} onclose={() => (confirmModal.open = false)} title={confirmModal.title} maxWidth="max-w-sm">
  <p class="text-sm text-slate-600 dark:text-slate-300 my-2">{confirmModal.message}</p>
  <div class="mt-4 flex justify-end gap-2">
    <button
      type="button"
      onclick={() => (confirmModal.open = false)}
      class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-semibold text-slate-700 dark:text-neutral-300 cursor-pointer"
    >
      Cancel
    </button>
    <button
      type="button"
      onclick={confirmModal.onConfirm}
      class="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
    >
      Delete
    </button>
  </div>
</Dialog>

<!-- EDIT RECEIVED RECORD POPUP -->
<Dialog open={editingReceived.open} onclose={() => (editingReceived.open = false)} title="Edit Received Entry" maxWidth="max-w-lg">
  <div class="space-y-4 text-xs">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label for="edit-rx-date" class="block font-bold text-slate-500 mb-1">Date</label>
        <input
          id="edit-rx-date"
          type="date"
          bind:value={editingReceived.date}
          class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-lg p-2 text-xs"
        />
      </div>
      <div>
        <label for="edit-rx-ch" class="block font-bold text-slate-500 mb-1">CH No.</label>
        <input
          id="edit-rx-ch"
          type="text"
          bind:value={editingReceived.ch_no}
          class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-lg p-2 text-xs"
        />
      </div>
    </div>

    <div class="space-y-2">
      <div class="font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center">
        <span>Yarn Items</span>
        <button
          type="button"
          onclick={() => editingReceived.items.push({ yarn_count: '', lot: '', bags: undefined, weight_kg: undefined })}
          class="text-blue-600 dark:text-blue-400 font-semibold text-xs flex items-center gap-1 cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" /> Add Row
        </button>
      </div>

      {#each editingReceived.items as item, idx}
        <div class="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-200/50 dark:border-blue-900/40">
          <select
            bind:value={item.yarn_count}
            class="flex-1 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded p-1.5 text-xs"
          >
            <option value="">Yarn Count</option>
            {#each fabricTypes as fabric}
              <option value={fabric.name}>{fabric.name}</option>
            {/each}
          </select>

          <input
            type="text"
            bind:value={item.lot}
            placeholder="Lot"
            class="w-16 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded p-1.5 text-xs"
          />

          <input
            type="number"
            bind:value={item.bags}
            placeholder="Bags"
            class="w-16 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded p-1.5 text-xs text-center"
          />

          <input
            type="number"
            step="0.01"
            bind:value={item.weight_kg}
            placeholder="Kg"
            class="w-20 bg-white dark:bg-neutral-800 border border-blue-500 rounded p-1.5 text-xs font-bold text-right"
          />

          {#if editingReceived.items.length > 1}
            <button
              type="button"
              onclick={() => editingReceived.items.splice(idx, 1)}
              class="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <div class="pt-3 border-t border-slate-200 dark:border-neutral-800 flex justify-end gap-2">
      <button
        type="button"
        onclick={() => (editingReceived.open = false)}
        class="px-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={saveEditReceived}
        class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
      >
        Save Changes
      </button>
    </div>
  </div>
</Dialog>

<!-- STATEMENT DATE RANGE POPUP -->
<Dialog open={isStatementModalOpen} onclose={() => (isStatementModalOpen = false)} title="Client Statement - Date Range" maxWidth="max-w-md">
  <div class="space-y-4 text-xs">
    <p class="text-slate-500 dark:text-neutral-400">Select start and end dates to generate client statement chart for printing.</p>

    <div class="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-neutral-800 p-3 rounded-xl">
      <div>
        <label for="stmt-start-date" class="block font-bold text-slate-700 dark:text-neutral-300 mb-1">Start Date</label>
        <input
          id="stmt-start-date"
          type="date"
          bind:value={statementStartDate}
          class="w-full bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-lg p-2 text-xs"
        />
      </div>

      <div>
        <label for="stmt-end-date" class="block font-bold text-slate-700 dark:text-neutral-300 mb-1">End Date</label>
        <input
          id="stmt-end-date"
          type="date"
          bind:value={statementEndDate}
          class="w-full bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-lg p-2 text-xs"
        />
      </div>
    </div>

    <!-- Live Statement Summary Preview -->
    <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 space-y-1 text-slate-700 dark:text-neutral-200">
      <div class="font-bold text-emerald-800 dark:text-emerald-400 text-xs">Period Summary Preview</div>
      <div class="flex justify-between">
        <span>Received Tally:</span>
        <span class="font-bold">{filteredStatementReceived.length} Entries ({statementRxTotalBags} Bags, {statementRxTotalWeight} Kg)</span>
      </div>
      <div class="flex justify-between">
        <span>Delivered Tally:</span>
        <span class="font-bold">{filteredStatementDelivered.length} Entries ({statementDxTotalRolls} Rolls, {statementDxTotalWeight} Kg)</span>
      </div>
    </div>

    <div class="pt-3 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between">
      <button
        type="button"
        onclick={() => (isStatementModalOpen = false)}
        class="px-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
      >
        Close
      </button>

      {#if statementStartDate && statementEndDate}
        <button
          type="button"
          onclick={handlePrintStatement}
          class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <Printer class="w-4 h-4" /> Print Statement
        </button>
      {/if}
    </div>
  </div>
</Dialog>

<!-- PRINT-ONLY STATEMENT CHART (A4 LANDSCAPE, MINIMAL DESIGN) -->
{#if selectedClient}
  <div class="hidden print:block statement-print-area text-black font-sans w-full">
    <!-- Header: Client Name & Date Range -->
    <div class="mb-3 border-b border-black pb-2 flex items-baseline justify-between">
      <div>
        <span class="text-[10px] uppercase tracking-wider text-neutral-600 block font-semibold">Client Statement</span>
        <h1 class="text-xl font-bold text-black m-0 leading-tight">{selectedClient.name}</h1>
      </div>
      <div class="text-right text-xs text-black font-mono">
        <span class="font-bold">Date Range:</span> {statementStartDate || 'Beginning'} &mdash; {statementEndDate || 'Present'}
      </div>
    </div>

    <!-- Dual Side-By-Side Tally Charts in Landscape -->
    <div class="grid grid-cols-2 gap-3 text-xs">

      <!-- LEFT: RECEIVED TALLY CHART -->
      <div class="border border-black p-1.5">
        <div class="font-bold border-b border-black pb-1 mb-1 text-center text-xs tracking-wide uppercase bg-neutral-100">
          Received Tally
        </div>
        <table class="w-full text-left border-collapse text-[10px]">
          <thead>
            <tr class="border-b border-black font-bold bg-neutral-50">
              <th class="p-1 border-r border-neutral-300">Date</th>
              <th class="p-1 border-r border-neutral-300">CH No.</th>
              <th class="p-1 border-r border-neutral-300">Yarn Count</th>
              <th class="p-1 border-r border-neutral-300">Lot</th>
              <th class="p-1 border-r border-neutral-300 text-center">Bags</th>
              <th class="p-1 text-right">Weight (Kg)</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredStatementReceived.length === 0}
              <tr>
                <td colspan="6" class="p-3 text-center italic text-neutral-500">No received entries in selected period.</td>
              </tr>
            {:else}
              {#each filteredStatementReceived as rec}
                {#if rec.items && rec.items.length > 0}
                  {#each rec.items as item, itemIdx}
                    <tr class="border-b border-neutral-200">
                      {#if itemIdx === 0}
                        <td rowspan={rec.items.length} class="p-1 align-top font-mono border-r border-neutral-300">{rec.date}</td>
                        <td rowspan={rec.items.length} class="p-1 align-top font-semibold border-r border-neutral-300">{rec.ch_no}</td>
                      {/if}
                      <td class="p-1 border-r border-neutral-300">{item.yarn_count}</td>
                      <td class="p-1 border-r border-neutral-300">{item.lot || '-'}</td>
                      <td class="p-1 border-r border-neutral-300 text-center font-mono">{item.bags}</td>
                      <td class="p-1 text-right font-mono font-bold">{item.weight_kg}</td>
                    </tr>
                  {/each}
                {:else}
                  <tr class="border-b border-neutral-200">
                    <td class="p-1 font-mono border-r border-neutral-300">{rec.date}</td>
                    <td class="p-1 font-semibold border-r border-neutral-300">{rec.ch_no}</td>
                    <td class="p-1 border-r border-neutral-300">{rec.yarn_count}</td>
                    <td class="p-1 border-r border-neutral-300">{rec.lot || '-'}</td>
                    <td class="p-1 border-r border-neutral-300 text-center font-mono">{rec.bags}</td>
                    <td class="p-1 text-right font-mono font-bold">{rec.weight_kg}</td>
                  </tr>
                {/if}
              {/each}
            {/if}
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-black font-bold bg-neutral-100">
              <td colspan="4" class="p-1 text-right border-r border-neutral-300">Total:</td>
              <td class="p-1 text-center font-mono border-r border-neutral-300">{statementRxTotalBags}</td>
              <td class="p-1 text-right font-mono">{statementRxTotalWeight} Kg</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- RIGHT: DELIVERED TALLY CHART -->
      <div class="border border-black p-1.5">
        <div class="font-bold border-b border-black pb-1 mb-1 text-center text-xs tracking-wide uppercase bg-neutral-100">
          Delivered Tally
        </div>
        <table class="w-full text-left border-collapse text-[10px]">
          <thead>
            <tr class="border-b border-black font-bold bg-neutral-50">
              <th class="p-1 border-r border-neutral-300">Date</th>
              <th class="p-1 border-r border-neutral-300">CH No.</th>
              <th class="p-1 border-r border-neutral-300">Yarn Count</th>
              <th class="p-1 border-r border-neutral-300">Lot</th>
              <th class="p-1 border-r border-neutral-300">Dia</th>
              <th class="p-1 border-r border-neutral-300 text-center">Rolls</th>
              <th class="p-1 text-right">Weight (Kg)</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredStatementDelivered.length === 0}
              <tr>
                <td colspan="7" class="p-3 text-center italic text-neutral-500">No delivered entries in selected period.</td>
              </tr>
            {:else}
              {#each filteredStatementDelivered as del}
                {#if del.items && del.items.length > 0}
                  {#each del.items as item, itemIdx}
                    <tr class="border-b border-neutral-200">
                      {#if itemIdx === 0}
                        <td rowspan={del.items.length} class="p-1 align-top font-mono border-r border-neutral-300">{del.date}</td>
                        <td rowspan={del.items.length} class="p-1 align-top font-semibold border-r border-neutral-300">{del.ch_no}</td>
                      {/if}
                      <td class="p-1 border-r border-neutral-300">{item.yarn_count}</td>
                      <td class="p-1 border-r border-neutral-300">{item.lot || '-'}</td>
                      <td class="p-1 border-r border-neutral-300 font-semibold">{item.dia}</td>
                      <td class="p-1 border-r border-neutral-300 text-center font-mono">{item.rolls}</td>
                      <td class="p-1 text-right font-mono font-bold">{item.weight_kg}</td>
                    </tr>
                  {/each}
                {:else}
                  <tr class="border-b border-neutral-200">
                    <td class="p-1 font-mono border-r border-neutral-300">{del.date}</td>
                    <td class="p-1 font-semibold border-r border-neutral-300">{del.ch_no}</td>
                    <td class="p-1 border-r border-neutral-300">{del.yarn_count}</td>
                    <td class="p-1 border-r border-neutral-300">{del.lot || '-'}</td>
                    <td class="p-1 border-r border-neutral-300 font-semibold">{del.dia}</td>
                    <td class="p-1 border-r border-neutral-300 text-center font-mono">{del.rolls}</td>
                    <td class="p-1 text-right font-mono font-bold">{del.weight_kg}</td>
                  </tr>
                {/if}
              {/each}
            {/if}
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-black font-bold bg-neutral-100">
              <td colspan="5" class="p-1 text-right border-r border-neutral-300">Total:</td>
              <td class="p-1 text-center font-mono border-r border-neutral-300">{statementDxTotalRolls}</td>
              <td class="p-1 text-right font-mono">{statementDxTotalWeight} Kg</td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  </div>
{/if}

<!-- EDIT DELIVERED RECORD POPUP -->
<Dialog open={editingDelivered.open} onclose={() => (editingDelivered.open = false)} title="Edit Delivered Entry" maxWidth="max-w-xl">
  <div class="space-y-4 text-xs">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label for="edit-dx-date" class="block font-bold text-slate-500 mb-1">Date</label>
        <input
          id="edit-dx-date"
          type="date"
          bind:value={editingDelivered.date}
          class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-lg p-2 text-xs"
        />
      </div>
      <div>
        <label for="edit-dx-ch" class="block font-bold text-slate-500 mb-1">CH No.</label>
        <input
          id="edit-dx-ch"
          type="text"
          bind:value={editingDelivered.ch_no}
          class="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-lg p-2 text-xs"
        />
      </div>
    </div>

    <div class="space-y-2">
      <div class="font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center">
        <span>Yarn Items</span>
        <button
          type="button"
          onclick={() => editingDelivered.items.push({ yarn_count: '', lot: '', dia: dias[0]?.value || '30"', rolls: undefined, weight_kg: undefined })}
          class="text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center gap-1 cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" /> Add Row
        </button>
      </div>

      {#each editingDelivered.items as item, idx}
        <div class="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-200/50 dark:border-emerald-900/40">
          <select
            bind:value={item.yarn_count}
            class="flex-1 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded p-1.5 text-xs"
          >
            <option value="">Yarn Count</option>
            {#each fabricTypes as fabric}
              <option value={fabric.name}>{fabric.name}</option>
            {/each}
          </select>

          <input
            type="text"
            bind:value={item.lot}
            placeholder="Lot"
            class="w-14 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded p-1.5 text-xs"
          />

          <select
            bind:value={item.dia}
            class="w-16 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded p-1.5 text-xs font-semibold"
          >
            {#each dias as dia}
              <option value={dia.value}>{dia.value}</option>
            {/each}
          </select>

          <input
            type="number"
            bind:value={item.rolls}
            placeholder="Rolls"
            class="w-14 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded p-1.5 text-xs text-center"
          />

          <input
            type="number"
            step="0.01"
            bind:value={item.weight_kg}
            placeholder="Kg"
            class="w-20 bg-white dark:bg-neutral-800 border border-emerald-500 rounded p-1.5 text-xs font-bold text-right"
          />

          {#if editingDelivered.items.length > 1}
            <button
              type="button"
              onclick={() => editingDelivered.items.splice(idx, 1)}
              class="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <div class="pt-3 border-t border-slate-200 dark:border-neutral-800 flex justify-end gap-2">
      <button
        type="button"
        onclick={() => (editingDelivered.open = false)}
        class="px-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={saveEditDelivered}
        class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
      >
        Save Changes
      </button>
    </div>
  </div>
</Dialog>
