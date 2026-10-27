<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type ReceivedRecord, type DeliveredRecord } from '../db';
  import Card from './ui/Card.svelte';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Dialog from './ui/Dialog.svelte';
  import { Receipt, Search, Eye, X, Download } from 'lucide-svelte';

  type AuditLogEntry = {
    id?: number;
    type: 'Received' | 'Delivered';
    client_name: string;
    date: string;
    time: string;
    rawRecord: ReceivedRecord | DeliveredRecord;
  };

  let searchFilter = $state('');
  let dateFilter = $state('');
  let typeFilter = $state<'all' | 'received' | 'delivered'>('all');

  let receivedList = $state<ReceivedRecord[]>([]);
  let deliveredList = $state<DeliveredRecord[]>([]);
  let selectedRecord = $state<AuditLogEntry | null>(null);

  async function loadRecords() {
    try {
      receivedList = await db.receivedRecords.orderBy('timestamp').reverse().toArray();
      deliveredList = await db.deliveredRecords.orderBy('timestamp').reverse().toArray();
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
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      logs = logs.filter((log) => log.client_name.toLowerCase().includes(q));
    }

    if (dateFilter) {
      logs = logs.filter((log) => log.date === dateFilter);
    }

    if (typeFilter !== 'all') {
      logs = logs.filter((log) => log.type.toLowerCase() === typeFilter);
    }

    return logs;
  });

  function openDetailModal(log: AuditLogEntry) {
    selectedRecord = log;
  }

  function closeDetailModal() {
    selectedRecord = null;
  }

  function exportCSV() {
    if (auditLogs.length === 0) return;

    const exportData = auditLogs.map((log) => {
      const rec = log.rawRecord;
      return {
        Date: log.date,
        Time: log.time,
        Client: log.client_name,
        Type: log.type,
        'CH No.': rec.ch_no || '-',
        'Yarn Count': rec.yarn_count || '-',
        Lot: rec.lot || '-',
        Dia: 'dia' in rec ? rec.dia : '-',
        'Bags / Rolls': 'bags' in rec ? rec.bags : 'rolls' in rec ? rec.rolls : '-',
        'Weight (Kg)': rec.weight_kg,
        'Total Weight (Kg)': rec.total_weight_kg
      };
    });

    const headers = Object.keys(exportData[0]);
    const rows = exportData.map((obj) =>
      headers.map((h) => `"${String((obj as any)[h] || '').replace(/"/g, '""')}"`).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
</script>

<div class="h-full flex flex-col overflow-y-auto p-4 md:p-6 space-y-6">
  <!-- Header Title -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">All Records & Audit Logs</h2>
      <p class="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">Log entry records by date, time, client name, and type.</p>
    </div>

    <Button variant="outline" onclick={exportCSV} class="flex items-center gap-2 cursor-pointer shrink-0">
      <Download class="h-4 w-4" />
      <span>Export CSV</span>
    </Button>
  </div>

  <!-- Filter & Search Controls -->
  <Card class="p-4">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
      <!-- Client Search -->
      <div class="md:col-span-5 relative">
        <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Filter by Client Name..."
          bind:value={searchFilter}
          class="pl-9 h-9 text-xs"
        />
      </div>

      <!-- Date Filter -->
      <div class="md:col-span-3 relative">
        <Input type="date" bind:value={dateFilter} class="h-9 text-xs" />
      </div>

      <!-- Type Filter Buttons -->
      <div class="md:col-span-3 flex bg-slate-100 dark:bg-neutral-800 p-1 rounded-xl">
        <button
          type="button"
          onclick={() => (typeFilter = 'all')}
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
            typeFilter === 'all'
              ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onclick={() => (typeFilter = 'received')}
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
            typeFilter === 'received'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500'
          }`}
        >
          Received
        </button>
        <button
          type="button"
          onclick={() => (typeFilter = 'delivered')}
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
            typeFilter === 'delivered'
              ? 'bg-emerald-600 text-white shadow-sm'
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
            searchFilter = '';
            dateFilter = '';
            typeFilter = 'all';
          }}
          class="w-full h-9 text-xs cursor-pointer"
        >
          Reset
        </Button>
      </div>
    </div>
  </Card>

  <!-- Audit Logs Table -->
  <Card title="Audit Logs">
    {#if auditLogs.length === 0}
      <div class="py-16 text-center text-slate-400">
        <Receipt class="h-12 w-12 mx-auto mb-2 text-slate-300 dark:text-neutral-700 stroke-1" />
        <p class="font-medium text-sm">No audit logs found</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-slate-200 dark:border-neutral-800 text-slate-500 uppercase tracking-wider text-[11px]">
            <tr>
              <th class="pb-3 font-semibold">Date</th>
              <th class="pb-3 font-semibold">Time</th>
              <th class="pb-3 font-semibold">Client Name</th>
              <th class="pb-3 font-semibold">Type</th>
              <th class="pb-3 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
            {#each auditLogs as log}
              <tr class="hover:bg-slate-50 dark:hover:bg-neutral-900/40 transition-colors">
                <td class="py-3.5 font-mono text-slate-600 dark:text-neutral-400">{log.date}</td>
                <td class="py-3.5 font-mono text-slate-500">{log.time}</td>
                <td class="py-3.5 font-bold text-slate-900 dark:text-white">{log.client_name}</td>
                <td class="py-3.5">
                  {#if log.type === 'Received'}
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      Received
                    </span>
                  {:else}
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      Delivered
                    </span>
                  {/if}
                </td>
                <td class="py-3.5 text-center">
                  <button
                    type="button"
                    onclick={() => openDetailModal(log)}
                    class="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    <Eye class="w-3.5 h-3.5" /> View
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>

<!-- Complete Data Record Popup Modal -->
<Dialog open={selectedRecord !== null} onclose={closeDetailModal} title="Record Detail Log" maxWidth="max-w-md">
  {#if selectedRecord}
    {@const rec = selectedRecord.rawRecord}
    <div class="space-y-4 text-sm">
      <div class="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-neutral-800">
        <div>
          <h3 class="font-bold text-lg text-slate-900 dark:text-white">{selectedRecord.client_name}</h3>
          <p class="text-xs text-slate-400">{selectedRecord.date} at {selectedRecord.time}</p>
        </div>
        {#if selectedRecord.type === 'Received'}
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
            Received Record
          </span>
        {:else}
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Delivered Record
          </span>
        {/if}
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-neutral-900 p-4 rounded-xl border border-slate-200 dark:border-neutral-800">
        <div>
          <span class="text-slate-400 block font-semibold uppercase text-[10px]">Challan Number (CH No.)</span>
          <span class="font-bold text-slate-800 dark:text-slate-200">{rec.ch_no || '-'}</span>
        </div>

        <div>
          <span class="text-slate-400 block font-semibold uppercase text-[10px]">Yarn Count</span>
          <span class="font-bold text-slate-800 dark:text-slate-200">{rec.yarn_count || '-'}</span>
        </div>

        <div>
          <span class="text-slate-400 block font-semibold uppercase text-[10px]">Lot</span>
          <span class="font-bold text-slate-800 dark:text-slate-200">{rec.lot || '-'}</span>
        </div>

        {#if selectedRecord.type === 'Delivered' && 'dia' in rec}
          <div>
            <span class="text-slate-400 block font-semibold uppercase text-[10px]">Dia</span>
            <span class="font-bold text-slate-800 dark:text-slate-200">{rec.dia}</span>
          </div>
        {/if}

        {#if 'bags' in rec}
          <div>
            <span class="text-slate-400 block font-semibold uppercase text-[10px]">Bags</span>
            <span class="font-bold text-slate-800 dark:text-slate-200">{rec.bags}</span>
          </div>
        {/if}

        {#if 'rolls' in rec}
          <div>
            <span class="text-slate-400 block font-semibold uppercase text-[10px]">Rolls</span>
            <span class="font-bold text-slate-800 dark:text-slate-200">{rec.rolls}</span>
          </div>
        {/if}

        <div>
          <span class="text-slate-400 block font-semibold uppercase text-[10px]">Weight (Kg)</span>
          <span class="font-bold text-slate-800 dark:text-slate-200">{rec.weight_kg} kg</span>
        </div>

        <div>
          <span class="text-slate-400 block font-semibold uppercase text-[10px]">Total Weight</span>
          <span class="font-black text-base text-emerald-600 dark:text-emerald-400">{rec.total_weight_kg} kg</span>
        </div>
      </div>
    </div>
  {/if}
</Dialog>
