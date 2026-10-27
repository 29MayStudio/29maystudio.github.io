<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type ReceivedRecord, type DeliveredRecord, type Client } from '../db';
  import Card from './ui/Card.svelte';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import {
    Receipt,
    Search,
    Download,
    ArrowDownLeft,
    ArrowUpRight,
    Filter,
    Trash2,
    Calendar
  } from 'lucide-svelte';

  let recordType = $state<'all' | 'received' | 'delivered'>('all');
  let searchFilter = $state('');
  let dateFilter = $state('');

  let receivedList = $state<ReceivedRecord[]>([]);
  let deliveredList = $state<DeliveredRecord[]>([]);
  let clientsList = $state<Client[]>([]);

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

    const handleDbUpdate = () => {
      loadRecords();
    };

    window.addEventListener('db-updated', handleDbUpdate);
    window.addEventListener('focus', handleDbUpdate);

    return () => {
      window.removeEventListener('db-updated', handleDbUpdate);
      window.removeEventListener('focus', handleDbUpdate);
    };
  });

  // Filtered lists
  let filteredReceived = $derived.by(() => {
    let result = [...receivedList];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.client_name.toLowerCase().includes(q) ||
          r.fabric_type.toLowerCase().includes(q) ||
          r.dia.toLowerCase().includes(q) ||
          (r.note && r.note.toLowerCase().includes(q))
      );
    }
    if (dateFilter) {
      result = result.filter((r) => r.date === dateFilter);
    }
    return result;
  });

  let filteredDelivered = $derived.by(() => {
    let result = [...deliveredList];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.client_name.toLowerCase().includes(q) ||
          r.fabric_type.toLowerCase().includes(q) ||
          r.dia.toLowerCase().includes(q) ||
          (r.note && r.note.toLowerCase().includes(q))
      );
    }
    if (dateFilter) {
      result = result.filter((r) => r.date === dateFilter);
    }
    return result;
  });

  // Combined records for "all" view
  interface CombinedRecord {
    id?: number;
    type: 'Received' | 'Delivered';
    client_name: string;
    fabric_type: string;
    dia: string;
    gsm?: string;
    rolls?: number;
    weight_kg: number;
    date: string;
    timestamp: string;
    note?: string;
  }

  let combinedRecords = $derived.by<CombinedRecord[]>(() => {
    const rx = filteredReceived.map((r) => ({ ...r, type: 'Received' as const }));
    const dx = filteredDelivered.map((d) => ({ ...d, type: 'Delivered' as const }));
    const combined = [...rx, ...dx];
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return combined;
  });

  let totalReceivedKg = $derived(filteredReceived.reduce((acc, r) => acc + (r.weight_kg || 0), 0));
  let totalDeliveredKg = $derived(filteredDelivered.reduce((acc, d) => acc + (d.weight_kg || 0), 0));

  async function deleteReceivedRecord(id?: number) {
    if (!id) return;
    if (confirm('Delete this received record?')) {
      await db.receivedRecords.delete(id);
      await loadRecords();
    }
  }

  async function deleteDeliveredRecord(id?: number) {
    if (!id) return;
    if (confirm('Delete this delivered record?')) {
      await db.deliveredRecords.delete(id);
      await loadRecords();
    }
  }

  function exportCSV() {
    let exportData: any[] = [];
    if (recordType === 'received') {
      exportData = filteredReceived.map((r) => ({
        Type: 'Received',
        Client: r.client_name,
        Date: r.date,
        'Fabric Type': r.fabric_type,
        Dia: r.dia,
        GSM: r.gsm || '',
        Rolls: r.rolls || 0,
        'Weight (kg)': r.weight_kg,
        Note: r.note || ''
      }));
    } else if (recordType === 'delivered') {
      exportData = filteredDelivered.map((d) => ({
        Type: 'Delivered',
        Client: d.client_name,
        Date: d.date,
        'Fabric Type': d.fabric_type,
        Dia: d.dia,
        GSM: d.gsm || '',
        Rolls: d.rolls || 0,
        'Weight (kg)': d.weight_kg,
        Note: d.note || ''
      }));
    } else {
      exportData = combinedRecords.map((c) => ({
        Type: c.type,
        Client: c.client_name,
        Date: c.date,
        'Fabric Type': c.fabric_type,
        Dia: c.dia,
        GSM: c.gsm || '',
        Rolls: c.rolls || 0,
        'Weight (kg)': c.weight_kg,
        Note: c.note || ''
      }));
    }

    if (exportData.length === 0) return;

    const headers = Object.keys(exportData[0]);
    const rows = exportData.map((obj) =>
      headers.map((h) => `"${String(obj[h] || '').replace(/"/g, '""')}"`).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `knitting_records_${new Date().toISOString().slice(0, 10)}.csv`);
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
      <p class="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">Filter, search, and export received and delivered fabric logs.</p>
    </div>

    <Button variant="outline" onclick={exportCSV} class="flex items-center gap-2 cursor-pointer shrink-0">
      <Download class="h-4 w-4" />
      <span>Export CSV</span>
    </Button>
  </div>

  <!-- Filter & Search Control Panel -->
  <Card class="p-4">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
      <!-- Search Input -->
      <div class="md:col-span-5 relative">
        <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Filter by Client Name, Fabric, Dia, or Note..."
          bind:value={searchFilter}
          class="pl-9 h-9 text-xs"
        />
      </div>

      <!-- Date Filter -->
      <div class="md:col-span-3 relative">
        <Input type="date" bind:value={dateFilter} class="h-9 text-xs" />
      </div>

      <!-- Type Filter -->
      <div class="md:col-span-3 flex bg-slate-100 dark:bg-neutral-800 p-1 rounded-xl">
        <button
          type="button"
          onclick={() => (recordType = 'all')}
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
            recordType === 'all'
              ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onclick={() => (recordType = 'received')}
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
            recordType === 'received'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500'
          }`}
        >
          Received
        </button>
        <button
          type="button"
          onclick={() => (recordType = 'delivered')}
          class={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
            recordType === 'delivered'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500'
          }`}
        >
          Delivered
        </button>
      </div>

      <!-- Reset Filters Button -->
      <div class="md:col-span-1">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => {
            searchFilter = '';
            dateFilter = '';
            recordType = 'all';
          }}
          class="w-full h-9 text-xs cursor-pointer"
          title="Reset Filters"
        >
          Reset
        </Button>
      </div>
    </div>
  </Card>

  <!-- Summary Stats Bar -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="p-4 rounded-xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 flex items-center justify-between">
      <div>
        <div class="text-xs text-slate-500 dark:text-neutral-400">Total Received Weight</div>
        <div class="text-xl font-bold text-blue-600 dark:text-blue-400">{totalReceivedKg.toFixed(1)} kg</div>
      </div>
      <div class="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
        <ArrowDownLeft class="h-4 w-4" />
      </div>
    </div>

    <div class="p-4 rounded-xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 flex items-center justify-between">
      <div>
        <div class="text-xs text-slate-500 dark:text-neutral-400">Total Delivered Weight</div>
        <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalDeliveredKg.toFixed(1)} kg</div>
      </div>
      <div class="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
        <ArrowUpRight class="h-4 w-4" />
      </div>
    </div>

    <div class="p-4 rounded-xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 flex items-center justify-between">
      <div>
        <div class="text-xs text-slate-500 dark:text-neutral-400">Net Balance (Received - Delivered)</div>
        <div class="text-xl font-bold text-purple-600 dark:text-purple-400">
          {(totalReceivedKg - totalDeliveredKg).toFixed(1)} kg
        </div>
      </div>
      <div class="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
        <Filter class="h-4 w-4" />
      </div>
    </div>
  </div>

  <!-- Records Data Table -->
  <Card title="Activity Records Table">
    {#if combinedRecords.length === 0}
      <div class="py-16 text-center text-slate-400">
        <Receipt class="h-12 w-12 mx-auto mb-2 text-slate-300 dark:text-neutral-700 stroke-1" />
        <p class="font-medium text-sm">No activity records found</p>
        <p class="text-xs text-slate-400 mt-1">Try adjusting search parameters or add records on the Home screen.</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-slate-200 dark:border-neutral-800 text-slate-500 uppercase tracking-wider text-[11px]">
            <tr>
              <th class="pb-3 font-semibold">Type</th>
              <th class="pb-3 font-semibold">Client Name</th>
              <th class="pb-3 font-semibold">Date</th>
              <th class="pb-3 font-semibold">Fabric Type</th>
              <th class="pb-3 font-semibold">Dia / GSM</th>
              <th class="pb-3 font-semibold">Rolls</th>
              <th class="pb-3 font-semibold text-right">Weight (kg)</th>
              <th class="pb-3 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
            {#each combinedRecords as record}
              {#if recordType === 'all' || recordType === record.type.toLowerCase()}
                <tr class="hover:bg-slate-50 dark:hover:bg-neutral-900/40 transition-colors">
                  <td class="py-3.5">
                    {#if record.type === 'Received'}
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                        Received
                      </span>
                    {:else}
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        Delivered
                      </span>
                    {/if}
                  </td>
                  <td class="py-3.5 font-bold text-slate-900 dark:text-white">
                    {record.client_name}
                  </td>
                  <td class="py-3.5 text-slate-500 font-mono text-[11px]">{record.date}</td>
                  <td class="py-3.5 font-medium text-slate-800 dark:text-slate-200">
                    {record.fabric_type}
                    {#if record.note}
                      <div class="text-[10px] text-slate-400 font-normal">{record.note}</div>
                    {/if}
                  </td>
                  <td class="py-3.5 text-slate-600 dark:text-neutral-300">
                    {record.dia} {#if record.gsm}<span class="text-slate-400">({record.gsm})</span>{/if}
                  </td>
                  <td class="py-3.5 text-slate-600 dark:text-neutral-300">
                    {record.rolls ?? '-'}
                  </td>
                  <td class={`py-3.5 font-extrabold text-right text-sm ${record.type === 'Received' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {record.weight_kg} kg
                  </td>
                  <td class="py-3.5 text-center">
                    <button
                      type="button"
                      onclick={() =>
                        record.type === 'Received'
                          ? deleteReceivedRecord(record.id)
                          : deleteDeliveredRecord(record.id)}
                      class="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                      title="Delete entry"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>
