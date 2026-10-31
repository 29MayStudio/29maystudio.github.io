<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type ReceivedRecord, type DeliveredRecord, type Client } from '../db';
  import { formatDateDMY } from '../utils';
  import * as XLSX from 'xlsx';
  import Card from './ui/Card.svelte';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Dialog from './ui/Dialog.svelte';
  import { Receipt, Search, Eye, X, Download, FileSpreadsheet, Users, UserPlus, Pencil, Trash2, Plus, AlertTriangle, AlertCircle, CheckCircle2, Database } from 'lucide-svelte';

  type AuditLogEntry = {
    id?: number;
    type: 'Received' | 'Delivered';
    client_name: string;
    date: string;
    time: string;
    rawRecord: ReceivedRecord | DeliveredRecord;
  };

  let nameFilter = $state('');
  let challanFilter = $state('');
  let yarnFilter = $state('');
  let diaFilter = $state('');
  let dateFilter = $state('');
  let typeFilter = $state<'all' | 'received' | 'delivered'>('all');

  let receivedList = $state<ReceivedRecord[]>([]);
  let deliveredList = $state<DeliveredRecord[]>([]);
  let clientsList = $state<Client[]>([]);

  let selectedRecord = $state<AuditLogEntry | null>(null);

  // Infinite Scroll State
  let displayedCount = $state(20);
  const BATCH_SIZE = 20;

  // Excel Export Modal state
  let isExcelModalOpen = $state(false);
  let selectedExportTarget = $state<string>('ALL'); // 'ALL' or client.id as string

  // Client Management Modal state
  let isClientModalOpen = $state(false);
  let newClientName = $state('');
  let newClientAddress = $state('');
  let clientActionError = $state('');
  let clientActionSuccess = $state('');
  let isGeneratingMockData = $state(false);

  let editingClient = $state<{ open: boolean; client: Client | null; name: string; address: string }>({
    open: false,
    client: null,
    name: '',
    address: ''
  });

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

  function openClientModal() {
    newClientName = '';
    newClientAddress = '';
    clientActionError = '';
    clientActionSuccess = '';
    isClientModalOpen = true;
  }

  async function handleAddClient(e: SubmitEvent) {
    e.preventDefault();
    clientActionError = '';
    clientActionSuccess = '';
    if (!newClientName.trim()) {
      clientActionError = 'Client name is required.';
      return;
    }

    const existing = clientsList.find(
      (c) => c.name.toLowerCase() === newClientName.trim().toLowerCase()
    );
    if (existing) {
      clientActionError = 'A client with this name already exists.';
      return;
    }

    await db.clients.add({
      name: newClientName.trim(),
      address: newClientAddress.trim() || undefined,
      created_at: new Date().toISOString()
    });

    newClientName = '';
    newClientAddress = '';
    clientActionSuccess = 'Client added successfully!';
    await loadRecords();
    window.dispatchEvent(new CustomEvent('db-updated'));
    setTimeout(() => (clientActionSuccess = ''), 3000);
  }

  function openEditClientModal(client: Client) {
    clientActionError = '';
    clientActionSuccess = '';
    editingClient = {
      open: true,
      client,
      name: client.name,
      address: client.address || ''
    };
  }

  async function handleSaveEditClient() {
    if (!editingClient.client || !editingClient.client.id) return;
    const oldName = editingClient.client.name;
    const newName = editingClient.name.trim();
    const newAddress = editingClient.address.trim() || undefined;

    if (!newName) {
      clientActionError = 'Client name is required.';
      return;
    }

    const existing = clientsList.find(
      (c) => c.id !== editingClient.client!.id && c.name.toLowerCase() === newName.toLowerCase()
    );
    if (existing) {
      clientActionError = 'A client with this name already exists.';
      return;
    }

    const updatedClient = {
      ...editingClient.client,
      name: newName,
      address: newAddress
    };

    await db.clients.put(JSON.parse(JSON.stringify(updatedClient)));

    if (oldName !== newName) {
      const rxRecords = await db.receivedRecords.where('client_id').equals(editingClient.client.id).toArray();
      for (const rec of rxRecords) {
        rec.client_name = newName;
        await db.receivedRecords.put(JSON.parse(JSON.stringify(rec)));
      }

      const dxRecords = await db.deliveredRecords.where('client_id').equals(editingClient.client.id).toArray();
      for (const rec of dxRecords) {
        rec.client_name = newName;
        await db.deliveredRecords.put(JSON.parse(JSON.stringify(rec)));
      }
    }

    editingClient.open = false;
    clientActionSuccess = 'Client details updated successfully!';
    await loadRecords();
    window.dispatchEvent(new CustomEvent('db-updated'));
    setTimeout(() => (clientActionSuccess = ''), 3000);
  }

  async function handleDeleteClient(client: Client) {
    if (!client.id) return;
    clientActionError = '';
    clientActionSuccess = '';

    // Check if client has data in received or delivered records
    const rxCount = await db.receivedRecords.where('client_id').equals(client.id).count();
    const dxCount = await db.deliveredRecords.where('client_id').equals(client.id).count();

    if (rxCount > 0 || dxCount > 0) {
      clientActionError = `Cannot delete client "${client.name}" because they have existing tally entries (${rxCount} received, ${dxCount} delivered). Deleting clients with data is not allowed to prevent data loss.`;
      return;
    }

    confirmModal = {
      open: true,
      title: 'Delete Client',
      message: `Are you sure you want to delete client "${client.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        confirmModal.open = false;
        await db.clients.delete(client.id!);
        clientActionSuccess = `Client "${client.name}" deleted successfully.`;
        await loadRecords();
        window.dispatchEvent(new CustomEvent('db-updated'));
        setTimeout(() => (clientActionSuccess = ''), 3000);
      }
    };
  }

  async function generateMockData() {
    isGeneratingMockData = true;
    clientActionError = '';
    clientActionSuccess = '';
    try {
      const targetClientNames = [
        'A&Z Knit Fabrics',
        'A.B. Knitting',
        'K.S.T. Knitting',
        'New Somrat',
        'Ruhul Knit',
        'Saiful & Brothers',
        'TOP Enterprises'
      ];

      const clientMap = new Map<string, number>();

      for (const name of targetClientNames) {
        let existing = await db.clients.where('name').equalsIgnoreCase(name).first();
        if (!existing) {
          const id = await db.clients.add({
            name,
            address: 'Narayanganj, Bangladesh',
            created_at: new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString()
          });
          clientMap.set(name, id as number);
        } else {
          clientMap.set(name, existing.id!);
        }
      }

      const yarnCounts = ['30s Cotton', '28s Polyester', 'Single Jersey', '1x1 Rib', '2x2 Rib', 'Interlock', 'Terry / French Terry'];
      const diaList = ['24"', '28"', '30"', '32"', '36"'];

      const today = new Date();
      const rxToAdd: any[] = [];
      const dxToAdd: any[] = [];

      let challanCounter = 1001;

      for (let dayOffset = 240; dayOffset >= 0; dayOffset -= Math.floor(Math.random() * 3) + 4) {
        const entryDateObj = new Date(today.getTime() - dayOffset * 24 * 60 * 60 * 1000);
        const dateStr = entryDateObj.toISOString().split('T')[0];

        for (const [cName, cId] of clientMap.entries()) {
          const addRx = Math.random() > 0.3;
          const addDx = Math.random() > 0.3;

          if (addRx) {
            const chNo = `RX-${challanCounter++}`;
            const itemCount = Math.floor(Math.random() * 2) + 1;
            const items = [];
            let totalBags = 0;
            let totalWeight = 0;

            for (let i = 0; i < itemCount; i++) {
              const yarn = yarnCounts[Math.floor(Math.random() * yarnCounts.length)];
              const bags = Math.floor(Math.random() * 30) + 10;
              const weight = Number((bags * (22 + Math.random() * 5)).toFixed(2));
              items.push({ yarn_count: yarn, bags, weight_kg: weight });
              totalBags += bags;
              totalWeight += weight;
            }
            totalWeight = Number(totalWeight.toFixed(2));

            rxToAdd.push({
              client_id: cId,
              client_name: cName,
              date: dateStr,
              ch_no: chNo,
              yarn_count: items[0].yarn_count,
              bags: totalBags,
              weight_kg: totalWeight,
              total_weight_kg: totalWeight,
              items,
              timestamp: new Date(entryDateObj.getTime() + Math.floor(Math.random() * 36000000)).toISOString()
            });
          }

          if (addDx) {
            const chNo = `DX-${challanCounter++}`;
            const itemCount = Math.floor(Math.random() * 2) + 1;
            const items = [];
            let totalRolls = 0;
            let totalWeight = 0;

            for (let i = 0; i < itemCount; i++) {
              const yarn = yarnCounts[Math.floor(Math.random() * yarnCounts.length)];
              const dia = diaList[Math.floor(Math.random() * diaList.length)];
              const rolls = Math.floor(Math.random() * 25) + 5;
              const weight = Number((rolls * (18 + Math.random() * 6)).toFixed(2));
              items.push({ yarn_count: yarn, dia, rolls, weight_kg: weight });
              totalRolls += rolls;
              totalWeight += weight;
            }
            totalWeight = Number(totalWeight.toFixed(2));

            dxToAdd.push({
              client_id: cId,
              client_name: cName,
              date: dateStr,
              ch_no: chNo,
              yarn_count: items[0].yarn_count,
              dia: items[0].dia,
              rolls: totalRolls,
              weight_kg: totalWeight,
              total_weight_kg: totalWeight,
              items,
              timestamp: new Date(entryDateObj.getTime() + Math.floor(Math.random() * 36000000) + 3600000).toISOString()
            });
          }
        }
      }

      if (rxToAdd.length > 0) {
        await db.receivedRecords.bulkAdd(JSON.parse(JSON.stringify(rxToAdd)));
      }
      if (dxToAdd.length > 0) {
        await db.deliveredRecords.bulkAdd(JSON.parse(JSON.stringify(dxToAdd)));
      }

      clientActionSuccess = 'Successfully generated 8 months of mock data!';
      await loadRecords();
      window.dispatchEvent(new CustomEvent('db-updated'));
      setTimeout(() => (clientActionSuccess = ''), 4000);
    } catch (err: any) {
      clientActionError = err?.message || 'Failed to generate mock data.';
    } finally {
      isGeneratingMockData = false;
    }
  }

  async function loadRecords() {
    try {
      receivedList = await db.receivedRecords.orderBy('timestamp').reverse().toArray();
      deliveredList = await db.deliveredRecords.orderBy('timestamp').reverse().toArray();
      clientsList = await db.clients.orderBy('name').toArray();
    } catch (e) {
      console.error('Failed to load records:', e);
    }
  }

  onMount(() => {
    loadRecords();
    const handleDbUpdate = () => loadRecords();
    window.addEventListener('db-updated', handleDbUpdate);
    window.addEventListener('focus', handleDbUpdate);
    return () => {
      window.removeEventListener('db-updated', handleDbUpdate);
      window.removeEventListener('focus', handleDbUpdate);
    };
  });

  function formatTime(timestampIso: string): string {
    if (!timestampIso) return '-';
    try {
      const dateObj = new Date(timestampIso);
      return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch {
      return '-';
    }
  }

  let auditLogs = $derived.by<AuditLogEntry[]>(() => {
    const rx: AuditLogEntry[] = receivedList.map((r) => ({
      id: r.id,
      type: 'Received',
      client_name: r.client_name,
      date: r.date,
      time: formatTime(r.timestamp),
      rawRecord: r
    }));

    const dx: AuditLogEntry[] = deliveredList.map((d) => ({
      id: d.id,
      type: 'Delivered',
      client_name: d.client_name,
      date: d.date,
      time: formatTime(d.timestamp),
      rawRecord: d
    }));

    let logs = [...rx, ...dx];
    logs.sort((a, b) => new Date(b.rawRecord.timestamp).getTime() - new Date(a.rawRecord.timestamp).getTime());

    if (nameFilter.trim()) {
      const q = nameFilter.toLowerCase().trim();
      logs = logs.filter((log) => log.client_name.toLowerCase().includes(q));
    }

    if (challanFilter.trim()) {
      const c = challanFilter.toLowerCase().trim();
      logs = logs.filter((log) => {
        const ch = log.rawRecord.ch_no;
        return ch && ch.toLowerCase().includes(c);
      });
    }

    if (yarnFilter.trim()) {
      const y = yarnFilter.toLowerCase().trim();
      logs = logs.filter((log) => {
        const rec = log.rawRecord;
        if (rec.yarn_count && rec.yarn_count.toLowerCase() === y) return true;
        if (rec.items && rec.items.some((i) => i.yarn_count.toLowerCase() === y)) return true;
        return false;
      });
    }

    if (diaFilter.trim()) {
      const d = diaFilter.toLowerCase().trim();
      logs = logs.filter((log) => {
        const rec = log.rawRecord;
        if ('dia' in rec && rec.dia && rec.dia.toLowerCase() === d) return true;
        if (rec.items && rec.items.some((i) => 'dia' in i && (i as any).dia && (i as any).dia.toLowerCase() === d)) return true;
        return false;
      });
    }

    if (dateFilter) {
      logs = logs.filter((log) => log.date === dateFilter);
    }

    if (typeFilter !== 'all') {
      logs = logs.filter((log) => log.type.toLowerCase() === typeFilter);
    }

    return logs;
  });

  // Reset displayedCount whenever filters change
  $effect(() => {
    // Access filter states to create reactivity dependency
    nameFilter; challanFilter; yarnFilter; diaFilter; dateFilter; typeFilter;
    displayedCount = BATCH_SIZE;
  });

  let visibleAuditLogs = $derived(auditLogs.slice(0, displayedCount));

  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    if (!target) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
      if (displayedCount < auditLogs.length) {
        displayedCount += BATCH_SIZE;
      }
    }
  }

  function openDetailModal(log: AuditLogEntry) {
    selectedRecord = log;
  }

  function closeDetailModal() {
    selectedRecord = null;
  }

  function openExcelModal() {
    selectedExportTarget = 'ALL';
    isExcelModalOpen = true;
  }

  function generateExcelForClientRecords(clientName: string, logs: AuditLogEntry[]) {
    const rows: any[] = [];

    // Sort logs chronologically ascending (oldest first) to compute running balance
    const sortedLogs = [...logs].sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return new Date(a.rawRecord.timestamp).getTime() - new Date(b.rawRecord.timestamp).getTime();
    });

    let runningBalance = 0;
    const balanceMap = new Map<AuditLogEntry, number>();

    sortedLogs.forEach((log) => {
      const totalWeight = Number(log.rawRecord.total_weight_kg || log.rawRecord.weight_kg || 0);
      if (log.type === 'Received') {
        runningBalance += totalWeight;
      } else {
        runningBalance -= totalWeight;
      }
      balanceMap.set(log, Number(runningBalance.toFixed(2)));
    });

    // Output logs in user's audit log order (descending by timestamp)
    logs.forEach((log) => {
      const rec = log.rawRecord;
      const bal = balanceMap.get(log) ?? 0;
      const items = rec.items && rec.items.length > 0
        ? rec.items
        : [{
            yarn_count: rec.yarn_count,
            dia: 'dia' in rec ? rec.dia : undefined,
            bags: 'bags' in rec ? rec.bags : undefined,
            rolls: 'rolls' in rec ? rec.rolls : undefined,
            weight_kg: rec.weight_kg
          }];

      items.forEach((item, itemIdx) => {
        rows.push({
          'Date': itemIdx === 0 ? formatDateDMY(log.date) : '',
          'Time': itemIdx === 0 ? log.time : '',
          'Client': itemIdx === 0 ? log.client_name : '',
          'Type': itemIdx === 0 ? log.type : '',
          'Challan': itemIdx === 0 ? (rec.ch_no || '-') : '',
          'Yarn Count': item.yarn_count || '-',
          'Dia': 'dia' in item && (item as any).dia ? (item as any).dia : ('dia' in rec ? rec.dia : '-'),
          'Bags': 'bags' in item && item.bags !== undefined ? item.bags : ('bags' in rec ? rec.bags : '-'),
          'Rolls': 'rolls' in item && item.rolls !== undefined ? item.rolls : ('rolls' in rec ? rec.rolls : '-'),
          'Item Weight (Kg)': item.weight_kg,
          'Total Weight (Kg)': itemIdx === 0 ? (rec.total_weight_kg || rec.weight_kg) : '',
          'Balance (Kg)': itemIdx === 0 ? bal : ''
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tally Records');

    const cleanClient = clientName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${cleanClient}_Tally_Records_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  function handleExecuteExcelExport() {
    isExcelModalOpen = false;

    if (selectedExportTarget === 'ALL') {
      // Group audit logs by Client Name
      const groups = new Map<string, AuditLogEntry[]>();
      auditLogs.forEach((log) => {
        const list = groups.get(log.client_name) || [];
        list.push(log);
        groups.set(log.client_name, list);
      });

      if (groups.size === 0) {
        alert('No records available to export.');
        return;
      }

      groups.forEach((logs, clientName) => {
        generateExcelForClientRecords(clientName, logs);
      });
    } else {
      const clientId = Number(selectedExportTarget);
      const client = clientsList.find((c) => c.id === clientId);
      if (!client) return;

      const clientLogs = auditLogs.filter((log) => log.client_name === client.name);
      if (clientLogs.length === 0) {
        alert(`No records found for ${client.name}.`);
        return;
      }

      generateExcelForClientRecords(client.name, clientLogs);
    }
  }
</script>

<div class="h-full flex flex-col overflow-hidden p-4 md:p-6 space-y-4">
  <!-- Minimal Header -->
  <div class="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-normal text-slate-900 dark:text-white">All Records & Audit Logs</h1>
      <p class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Comprehensive audit history of received and delivered yarn challans.</p>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <Button variant="outline" size="sm" onclick={openClientModal} class="flex items-center gap-1.5 cursor-pointer text-xs">
        <Users class="h-4 w-4" />
        <span>Client Management</span>
      </Button>

      <Button variant="default" size="sm" onclick={openExcelModal} class="flex items-center gap-1.5 cursor-pointer text-xs">
        <FileSpreadsheet class="h-4 w-4" />
        <span>Export Excel</span>
      </Button>
    </div>
  </div>

  <!-- Filter & Search Controls -->
  <div class="shrink-0 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-3.5 shadow-xs">
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-center">
      <!-- Client Name Filter -->
      <div class="md:col-span-3 relative">
        <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          type="text"
          placeholder="Filter by Client..."
          bind:value={nameFilter}
          class="pl-8 h-8 text-xs bg-slate-50 dark:bg-neutral-800 border-none"
        />
      </div>

      <!-- Challan Filter Text Input -->
      <div class="md:col-span-2">
        <Input
          type="text"
          placeholder="Filter by Challan..."
          bind:value={challanFilter}
          class="h-8 text-xs bg-slate-50 dark:bg-neutral-800 border-none"
        />
      </div>

      <!-- Yarn Type Filter Text Input -->
      <div class="md:col-span-2">
        <Input
          type="text"
          placeholder="Filter by Yarn..."
          bind:value={yarnFilter}
          class="h-8 text-xs bg-slate-50 dark:bg-neutral-800 border-none"
        />
      </div>

      <!-- Dia Filter Text Input -->
      <div class="md:col-span-1">
        <Input
          type="text"
          placeholder="Dia..."
          bind:value={diaFilter}
          class="h-8 text-xs bg-slate-50 dark:bg-neutral-800 border-none"
        />
      </div>

      <!-- Date Filter -->
      <div class="md:col-span-2">
        <Input type="date" bind:value={dateFilter} class="h-8 text-xs bg-slate-50 dark:bg-neutral-800 border-none" />
      </div>

      <!-- Type Filter Buttons -->
      <div class="md:col-span-2 flex bg-slate-100 dark:bg-neutral-800 p-0.5 rounded-xl">
        <button
          type="button"
          onclick={() => (typeFilter = 'all')}
          class={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
            typeFilter === 'all'
              ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onclick={() => (typeFilter = 'received')}
          class={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
            typeFilter === 'received'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          Received
        </button>
        <button
          type="button"
          onclick={() => (typeFilter = 'delivered')}
          class={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
            typeFilter === 'delivered'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          Delivered
        </button>
      </div>

      <!-- Reset Button -->
      <div class="md:col-span-1">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => {
            nameFilter = '';
            challanFilter = '';
            yarnFilter = '';
            diaFilter = '';
            dateFilter = '';
            typeFilter = 'all';
          }}
          class="w-full h-8 text-xs cursor-pointer px-1"
        >
          Reset
        </Button>
      </div>
    </div>
  </div>

  <!-- Audit Logs Spreadsheet Table -->
  <div class="flex-1 min-h-0 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-xs">
    {#if auditLogs.length === 0}
      <div class="py-16 text-center text-slate-400">
        <Receipt class="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-neutral-700 stroke-1" />
        <p class="font-medium text-sm">No audit logs found</p>
      </div>
    {:else}
      <div class="flex-1 overflow-auto" onscroll={handleScroll}>
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-b border-slate-200 dark:border-neutral-700 text-[11px] font-semibold">
            <tr>
              <th class="py-2.5 px-3 w-28">Date & Time</th>
              <th class="py-2.5 px-3">Client Name</th>
              <th class="py-2.5 px-3 w-20">Type</th>
              <th class="py-2.5 px-3 w-20">Challan</th>
              <th class="py-2.5 px-3">Challan Items Breakdown</th>
              <th class="py-2.5 px-3 w-24 text-right">Total Weight</th>
              <th class="py-2.5 px-3 w-16 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
            {#each visibleAuditLogs as log}
              {@const rec = log.rawRecord}
              {@const items = rec.items && rec.items.length > 0 ? rec.items : [{ yarn_count: rec.yarn_count, dia: 'dia' in rec ? rec.dia : undefined, bags: 'bags' in rec ? rec.bags : undefined, rolls: 'rolls' in rec ? rec.rolls : undefined, weight_kg: rec.weight_kg }]}
              <tr class="hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors">
                <!-- Date & Time -->
                <td class="p-3 align-top">
                  <div class="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{formatDateDMY(log.date)}</div>
                  <div class="font-mono text-[10px] text-slate-400">{log.time}</div>
                </td>

                <!-- Client Name -->
                <td class="p-3 align-top font-bold text-slate-900 dark:text-white">
                  {log.client_name}
                </td>

                <!-- Type -->
                <td class="p-3 align-top">
                  {#if log.type === 'Received'}
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      Received
                    </span>
                  {:else}
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      Delivered
                    </span>
                  {/if}
                </td>

                <!-- Challan -->
                <td class="p-3 align-top font-semibold text-slate-800 dark:text-slate-200">
                  {rec.ch_no || '-'}
                </td>

                <!-- Multi-Item Breakdown List -->
                <td class="p-3 align-top">
                  <div class="space-y-1">
                    {#each items as item}
                      <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-neutral-300">
                        <span class="font-semibold text-slate-900 dark:text-white">{item.yarn_count || '-'}</span>
                        {#if 'dia' in item && item.dia}<span class="text-[10px] bg-slate-100 dark:bg-neutral-800 px-1.5 rounded font-semibold text-emerald-600 dark:text-emerald-400">Dia: {item.dia}</span>{/if}
                        {#if 'bags' in item && item.bags !== undefined}<span class="text-[11px] font-mono text-blue-600 dark:text-blue-400">{item.bags} Bags</span>{/if}
                        {#if 'rolls' in item && item.rolls !== undefined}<span class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">{item.rolls} Rolls</span>{/if}
                        <span class="font-mono font-bold text-slate-800 dark:text-slate-200">({item.weight_kg} kg)</span>
                      </div>
                    {/each}
                  </div>
                </td>

                <!-- Total Weight -->
                <td class="p-3 align-top text-right font-mono font-black text-sm text-slate-900 dark:text-white">
                  {rec.total_weight_kg || rec.weight_kg} kg
                </td>

                <!-- Action Button -->
                <td class="p-3 align-top text-center">
                  <button
                    type="button"
                    onclick={() => openDetailModal(log)}
                    class="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="View Full Details"
                  >
                    <Eye class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if displayedCount < auditLogs.length}
        <div class="p-3 text-center text-xs text-slate-500 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 font-medium">
          Showing {visibleAuditLogs.length} of {auditLogs.length} logs &mdash; Scroll down to load more...
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Excel Export Dialog Modal -->
<Dialog open={isExcelModalOpen} onclose={() => (isExcelModalOpen = false)} title="Export Excel Records" maxWidth="max-w-md">
  <div class="space-y-4 text-xs">
    <p class="text-slate-500 dark:text-neutral-400">Select whether to export records for ALL clients into separate Excel files or choose a specific client.</p>

    <div class="space-y-2 bg-slate-50 dark:bg-neutral-800 p-3.5 rounded-xl border border-slate-200 dark:border-neutral-700">
      <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-700/60 cursor-pointer font-bold text-slate-900 dark:text-white">
        <input
          type="radio"
          name="exportTarget"
          value="ALL"
          bind:group={selectedExportTarget}
          class="accent-emerald-600 w-4 h-4"
        />
        <span>ALL Clients (Generate separate .xlsx file for each client)</span>
      </label>

      <div class="border-t border-slate-200 dark:border-neutral-700 my-1 pt-2">
        <div class="text-[11px] font-semibold text-slate-400 dark:text-neutral-400 mb-2 px-1">Or Select One Client:</div>
        <div class="max-h-44 overflow-y-auto space-y-1 pr-1">
          {#each clientsList as client}
            <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-700/60 cursor-pointer text-slate-800 dark:text-slate-200">
              <input
                type="radio"
                name="exportTarget"
                value={String(client.id)}
                bind:group={selectedExportTarget}
                class="accent-emerald-600 w-4 h-4"
              />
              <span class="font-medium">{client.name}</span>
            </label>
          {/each}
        </div>
      </div>
    </div>

    <div class="pt-3 border-t border-slate-100 dark:border-neutral-800 flex justify-end gap-2">
      <button
        type="button"
        onclick={() => (isExcelModalOpen = false)}
        class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-neutral-800 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-neutral-700 text-slate-800 dark:text-neutral-200 cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleExecuteExcelExport}
        class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
      >
        <FileSpreadsheet class="w-4 h-4" /> Download Excel
      </button>
    </div>
  </div>
</Dialog>

<!-- CLIENT MANAGEMENT MODAL -->
<Dialog open={isClientModalOpen} onclose={() => (isClientModalOpen = false)} title="Client Management" maxWidth="max-w-2xl">
  <div class="space-y-5 text-xs font-sans">
    <!-- Header alert / status messages -->
    {#if clientActionError}
      <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
        <AlertCircle class="w-4 h-4 shrink-0" />
        <span>{clientActionError}</span>
      </div>
    {/if}

    {#if clientActionSuccess}
      <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 shrink-0" />
        <span>{clientActionSuccess}</span>
      </div>
    {/if}

    <!-- Add Client Section -->
    <div class="bg-slate-50 dark:bg-neutral-800/60 p-4 rounded-2xl border border-slate-200 dark:border-neutral-700/60">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <UserPlus class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Add New Client</span>
        </h3>

        <button
          type="button"
          onclick={generateMockData}
          disabled={isGeneratingMockData}
          class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          title="Add 8 months worth of mock tally records for default clients"
        >
          <Database class="w-3.5 h-3.5" />
          <span>{isGeneratingMockData ? 'Generating...' : 'Add Mock Data'}</span>
        </button>
      </div>

      <form onsubmit={handleAddClient} class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
        <div class="sm:col-span-5">
          <label for="new-client-name" class="block font-semibold text-slate-600 dark:text-neutral-300 mb-1">
            Client / Company Name *
          </label>
          <Input
            id="new-client-name"
            type="text"
            bind:value={newClientName}
            placeholder="e.g. Apex Knitwear Ltd."
            class="h-8 text-xs"
            required
          />
        </div>

        <div class="sm:col-span-5">
          <label for="new-client-address" class="block font-semibold text-slate-600 dark:text-neutral-300 mb-1">
            Address / Location (Optional)
          </label>
          <Input
            id="new-client-address"
            type="text"
            bind:value={newClientAddress}
            placeholder="e.g. Gazipur, Dhaka"
            class="h-8 text-xs"
          />
        </div>

        <div class="sm:col-span-2">
          <button
            type="submit"
            class="w-full h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </form>
    </div>

    <!-- Registered Clients Table -->
    <div class="space-y-2">
      <div class="flex items-center justify-between font-bold text-slate-800 dark:text-neutral-200">
        <span>Registered Clients ({clientsList.length})</span>
        <span class="text-[11px] text-slate-400 font-normal">Clients with data cannot be deleted</span>
      </div>

      <div class="max-h-64 overflow-y-auto border border-slate-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900">
        {#if clientsList.length === 0}
          <div class="p-6 text-center text-slate-400">No clients registered yet.</div>
        {:else}
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 font-semibold border-b border-slate-200 dark:border-neutral-700">
              <tr>
                <th class="p-2.5">Client Name</th>
                <th class="p-2.5">Address</th>
                <th class="p-2.5 text-right w-20">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
              {#each clientsList as client}
                <tr class="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td class="p-2.5 font-bold text-slate-900 dark:text-white">{client.name}</td>
                  <td class="p-2.5 text-slate-500 dark:text-neutral-400">{client.address || '-'}</td>
                  <td class="p-2.5 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onclick={() => openEditClientModal(client)}
                        class="p-1 text-slate-400 hover:text-blue-500 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        title="Edit Client"
                      >
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onclick={() => handleDeleteClient(client)}
                        class="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        title="Delete Client"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>

    <div class="pt-3 border-t border-slate-100 dark:border-neutral-800 flex justify-end">
      <button
        type="button"
        onclick={() => (isClientModalOpen = false)}
        class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-neutral-800 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-neutral-700 text-slate-800 dark:text-neutral-200 cursor-pointer"
      >
        Close
      </button>
    </div>
  </div>
</Dialog>

<!-- EDIT CLIENT MODAL -->
<Dialog open={editingClient.open} onclose={() => (editingClient.open = false)} title="Edit Client Details" maxWidth="max-w-md">
  <div class="space-y-4 text-xs">
    <div>
      <label for="edit-client-name" class="block font-semibold text-slate-600 dark:text-neutral-300 mb-1">
        Client Name *
      </label>
      <Input
        id="edit-client-name"
        type="text"
        bind:value={editingClient.name}
        class="h-8 text-xs"
        required
      />
    </div>

    <div>
      <label for="edit-client-address" class="block font-semibold text-slate-600 dark:text-neutral-300 mb-1">
        Address / Location
      </label>
      <textarea
        id="edit-client-address"
        bind:value={editingClient.address}
        rows="3"
        class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white text-xs resize-none"
      ></textarea>
    </div>

    <div class="pt-3 border-t border-slate-100 dark:border-neutral-800 flex justify-end gap-2">
      <button
        type="button"
        onclick={() => (editingClient.open = false)}
        class="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-neutral-800 hover:bg-slate-300 dark:hover:bg-neutral-700 text-slate-800 dark:text-neutral-200 text-xs font-semibold cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleSaveEditClient}
        class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
      >
        Save Changes
      </button>
    </div>
  </div>
</Dialog>

<!-- CONFIRM DELETE DIALOG -->
<Dialog open={confirmModal.open} onclose={() => (confirmModal.open = false)} variant="warning" maxWidth="max-w-sm">
  <div class="flex flex-col items-center text-center p-2">
    <div class="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
      <AlertTriangle class="w-6 h-6" />
    </div>
    <h2 class="text-lg font-bold text-rose-600 dark:text-rose-400 mb-1">{confirmModal.title}</h2>
    <p class="text-xs text-slate-600 dark:text-neutral-300 my-1">{confirmModal.message}</p>

    <div class="mt-4 w-full flex justify-end gap-2 pt-2 border-t border-rose-500/10">
      <button
        type="button"
        onclick={() => (confirmModal.open = false)}
        class="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-neutral-800 hover:bg-slate-300 dark:hover:bg-neutral-700 text-xs font-semibold text-slate-800 dark:text-neutral-200 cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={confirmModal.onConfirm}
        class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
      >
        Delete Client
      </button>
    </div>
  </div>
</Dialog>

<!-- Complete Data Record Detail Popup Modal -->
<Dialog open={selectedRecord !== null} onclose={closeDetailModal} title="Record Detail Log" maxWidth="max-w-lg">
  {#if selectedRecord}
    {@const rec = selectedRecord.rawRecord}
    {@const items = rec.items && rec.items.length > 0 ? rec.items : [{ yarn_count: rec.yarn_count, dia: 'dia' in rec ? rec.dia : undefined, bags: 'bags' in rec ? rec.bags : undefined, rolls: 'rolls' in rec ? rec.rolls : undefined, weight_kg: rec.weight_kg }]}
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-neutral-800">
        <div>
          <h3 class="font-bold text-base text-slate-900 dark:text-white">{selectedRecord.client_name}</h3>
          <p class="text-xs text-slate-400">{formatDateDMY(selectedRecord.date)} at {selectedRecord.time} | Challan: {rec.ch_no}</p>
        </div>
        {#if selectedRecord.type === 'Received'}
          <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
            Received Entry
          </span>
        {:else}
          <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Delivered Entry
          </span>
        {/if}
      </div>

      <!-- Itemized Table Breakdown -->
      <div class="bg-slate-50 dark:bg-neutral-900 rounded-xl p-3 border border-slate-200 dark:border-neutral-800">
        <div class="font-bold mb-2 text-slate-700 dark:text-neutral-300">Challan Item List:</div>
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-neutral-700 text-slate-400 text-[10px] font-semibold">
              <th class="py-1">Yarn Count</th>
              {#if selectedRecord.type === 'Delivered'}
                <th class="py-1">Dia</th>
                <th class="py-1 text-center">Rolls</th>
              {:else}
                <th class="py-1 text-center">Bags</th>
              {/if}
              <th class="py-1 text-right">Weight (Kg)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-neutral-800">
            {#each items as item}
              <tr>
                <td class="py-1.5 font-bold text-slate-800 dark:text-slate-200">{item.yarn_count}</td>
                {#if selectedRecord.type === 'Delivered'}
                  <td class="py-1.5 font-semibold text-emerald-600 dark:text-emerald-400">{'dia' in item ? item.dia : '-'}</td>
                  <td class="py-1.5 text-center font-mono font-semibold">{'rolls' in item ? item.rolls : '-'}</td>
                {:else}
                  <td class="py-1.5 text-center font-mono font-semibold">{'bags' in item ? item.bags : '-'}</td>
                {/if}
                <td class="py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white">{item.weight_kg} kg</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-slate-300 dark:border-neutral-700 font-bold text-slate-900 dark:text-white">
              <td colspan={selectedRecord.type === 'Delivered' ? 2 : 1} class="pt-2 text-right">Challan Total:</td>
              <td class="pt-2 text-center font-mono">
                {selectedRecord.type === 'Delivered' ? ('rolls' in rec ? rec.rolls : '-') : ('bags' in rec ? rec.bags : '-')}
              </td>
              <td class="pt-2 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                {rec.total_weight_kg || rec.weight_kg} kg
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  {/if}
</Dialog>
