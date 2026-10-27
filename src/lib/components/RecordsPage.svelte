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

<div class="h-full flex flex-col overflow-y-auto p-4 md:p-6 space-y-5">
  <!-- Minimal Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-normal text-slate-900 dark:text-white">All Records & Audit Logs</h1>
      <p class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Comprehensive audit history of received and delivered yarn challans.</p>
    </div>

    <Button variant="outline" size="sm" onclick={exportCSV} class="flex items-center gap-1.5 cursor-pointer shrink-0 text-xs">
      <Download class="h-3.5 w-3.5" />
      <span>Export CSV</span>
    </Button>
  </div>

  <!-- Filter & Search Controls -->
  <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-3.5 shadow-xs">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
      <!-- Client Search -->
      <div class="md:col-span-5 relative">
        <Search class="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          type="text"
          placeholder="Filter by Client Name..."
          bind:value={searchFilter}
          class="pl-8 h-8 text-xs bg-slate-50 dark:bg-neutral-800 border-none"
        />
      </div>

      <!-- Date Filter -->
      <div class="md:col-span-3 relative">
        <Input type="date" bind:value={dateFilter} class="h-8 text-xs bg-slate-50 dark:bg-neutral-800 border-none" />
      </div>

      <!-- Type Filter Buttons -->
      <div class="md:col-span-3 flex bg-slate-100 dark:bg-neutral-800 p-0.5 rounded-xl">
        <button
          type="button"
          onclick={() => (typeFilter = 'all')}
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
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
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
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
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
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
            searchFilter = '';
            dateFilter = '';
            typeFilter = 'all';
          }}
          class="w-full h-8 text-xs cursor-pointer"
        >
          Reset
        </Button>
      </div>
    </div>
  </div>

  <!-- Audit Logs Spreadsheet Table -->
  <div class="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
    {#if auditLogs.length === 0}
      <div class="py-16 text-center text-slate-400">
        <Receipt class="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-neutral-700 stroke-1" />
        <p class="font-medium text-sm">No audit logs found</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-b border-slate-200 dark:border-neutral-700 text-[11px] font-semibold">
            <tr>
              <th class="py-2.5 px-3 w-28">Date & Time</th>
              <th class="py-2.5 px-3">Client Name</th>
              <th class="py-2.5 px-3 w-20">Type</th>
              <th class="py-2.5 px-3 w-20">CH No.</th>
              <th class="py-2.5 px-3">Challan Items Breakdown</th>
              <th class="py-2.5 px-3 w-24 text-right">Total Weight</th>
              <th class="py-2.5 px-3 w-16 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
            {#each auditLogs as log}
              {@const rec = log.rawRecord}
              {@const items = rec.items && rec.items.length > 0 ? rec.items : [{ yarn_count: rec.yarn_count, lot: rec.lot, dia: 'dia' in rec ? rec.dia : undefined, bags: 'bags' in rec ? rec.bags : undefined, rolls: 'rolls' in rec ? rec.rolls : undefined, weight_kg: rec.weight_kg }]}
              <tr class="hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors">
                <!-- Date & Time -->
                <td class="p-3 align-top">
                  <div class="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{log.date}</div>
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

                <!-- CH No. -->
                <td class="p-3 align-top font-semibold text-slate-800 dark:text-slate-200">
                  {rec.ch_no || '-'}
                </td>

                <!-- Multi-Item Breakdown List -->
                <td class="p-3 align-top">
                  <div class="space-y-1">
                    {#each items as item}
                      <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-neutral-300">
                        <span class="font-semibold text-slate-900 dark:text-white">{item.yarn_count || '-'}</span>
                        {#if item.lot}<span class="text-[10px] text-slate-400">Lot: {item.lot}</span>{/if}
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
    {/if}
  </div>
</div>

<!-- Complete Data Record Detail Popup Modal -->
<Dialog open={selectedRecord !== null} onclose={closeDetailModal} title="Record Detail Log" maxWidth="max-w-lg">
  {#if selectedRecord}
    {@const rec = selectedRecord.rawRecord}
    {@const items = rec.items && rec.items.length > 0 ? rec.items : [{ yarn_count: rec.yarn_count, lot: rec.lot, dia: 'dia' in rec ? rec.dia : undefined, bags: 'bags' in rec ? rec.bags : undefined, rolls: 'rolls' in rec ? rec.rolls : undefined, weight_kg: rec.weight_kg }]}
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-neutral-800">
        <div>
          <h3 class="font-bold text-base text-slate-900 dark:text-white">{selectedRecord.client_name}</h3>
          <p class="text-xs text-slate-400">{selectedRecord.date} at {selectedRecord.time} | CH No. {rec.ch_no}</p>
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
              <th class="py-1">Lot</th>
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
                <td class="py-1.5 text-slate-500">{item.lot || '-'}</td>
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
              <td colspan={selectedRecord.type === 'Delivered' ? 3 : 2} class="pt-2 text-right">Challan Total:</td>
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
