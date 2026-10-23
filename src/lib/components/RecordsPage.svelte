<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type SaleRecord } from '../db';
  import { formatCurrency, formatDate } from '../utils';
  import Card from './ui/Card.svelte';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Badge from './ui/Badge.svelte';
  import Dialog from './ui/Dialog.svelte';
  import {
    Receipt,
    Search,
    Printer,
    Eye,
    RotateCcw,
    Download,
    DollarSign,
    Filter
  } from 'lucide-svelte';

  let allSales = $state<SaleRecord[]>([]);
  let filteredSales = $state<SaleRecord[]>([]);

  let searchFilter = $state('');
  let dateFilter = $state(''); // "YYYY-MM-DD"
  let paymentMethodFilter = $state('ALL');

  // Selected sale modal
  let selectedSale = $state<SaleRecord | null>(null);
  let showDetailsDialog = $state(false);

  async function loadSales() {
    try {
      allSales = await db.sales.orderBy('timestamp').reverse().toArray();
      applyFilters();
    } catch (e) {
      console.error('Failed to load sales history:', e);
    }
  }

  onMount(() => {
    loadSales();
  });

  function applyFilters() {
    let result = [...allSales];

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      result = result.filter((s) => {
        const codeMatch = s.sale_code.toLowerCase().includes(q);
        const itemMatch = s.items.some(
          (item) =>
            item.brand_name.toLowerCase().includes(q) ||
            item.generic_names.some((g) => g.toLowerCase().includes(q))
        );
        return codeMatch || itemMatch;
      });
    }

    if (dateFilter) {
      result = result.filter((s) => s.timestamp.startsWith(dateFilter));
    }

    if (paymentMethodFilter !== 'ALL') {
      result = result.filter((s) => s.payment_method === paymentMethodFilter);
    }

    filteredSales = result;
  }

  $effect(() => {
    applyFilters();
  });

  let totalRevenueInView = $derived(
    filteredSales
      .filter((s) => s.status === 'Completed')
      .reduce((sum, s) => sum + s.net_amount, 0)
  );

  let totalCompletedCount = $derived(filteredSales.filter((s) => s.status === 'Completed').length);

  function viewSaleDetails(sale: SaleRecord) {
    selectedSale = sale;
    showDetailsDialog = true;
  }

  async function voidTransaction(sale: SaleRecord) {
    if (!confirm(`Are you sure you want to mark transaction ${sale.sale_code} as Refunded/Void? This will restock the sold items.`)) {
      return;
    }

    try {
      await db.transaction('rw', db.sales, db.inventory, async () => {
        await db.sales.update(sale.id!, { status: 'Refunded' });

        // Restock items into inventory
        for (const item of sale.items) {
          const inv = await db.inventory.get(item.inventory_id);
          if (inv) {
            await db.inventory.update(item.inventory_id, {
              stock_quantity: inv.stock_quantity + item.quantity,
            });
          }
        }
      });

      if (selectedSale && selectedSale.id === sale.id) {
        selectedSale.status = 'Refunded';
      }

      await loadSales();
    } catch (err: any) {
      alert('Failed to void transaction: ' + err.message);
    }
  }

  function exportCSV() {
    if (filteredSales.length === 0) return;

    const headers = ['Sale Code', 'Date/Time', 'Status', 'Payment Method', 'Items Count', 'Subtotal', 'Discount', 'Net Total'];
    const rows = filteredSales.map((s) => [
      s.sale_code,
      s.timestamp,
      s.status,
      s.payment_method,
      s.items.length,
      s.total_amount,
      s.discount_amount,
      s.net_amount,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printReceipt() {
    window.print();
  }
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 space-y-6">
  <!-- Header Title -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sales & Audit Records</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Comprehensive audit trail of all transactions and sales history.</p>
    </div>

    <Button variant="outline" onclick={exportCSV} class="flex items-center gap-2">
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
          placeholder="Filter by Sale Code or Medicine Brand/Generic..."
          bind:value={searchFilter}
          class="pl-9 h-9 text-xs"
        />
      </div>

      <!-- Date Filter -->
      <div class="md:col-span-3 relative">
        <Input type="date" bind:value={dateFilter} class="h-9 text-xs" />
      </div>

      <!-- Payment Method Filter -->
      <div class="md:col-span-3">
        <select
          bind:value={paymentMethodFilter}
          class="flex h-9 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">All Payment Methods</option>
          <option value="Cash">Cash Only</option>
          <option value="Card">Card Only</option>
          <option value="Mobile Banking">Mobile Banking</option>
        </select>
      </div>

      <!-- Reset Filters Button -->
      <div class="md:col-span-1">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => {
            searchFilter = '';
            dateFilter = '';
            paymentMethodFilter = 'ALL';
          }}
          class="w-full h-9 text-xs"
          title="Reset Filters"
        >
          Reset
        </Button>
      </div>
    </div>
  </Card>

  <!-- Filter Summary Stats Bar -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
      <div>
        <div class="text-xs text-slate-500">Filtered Sales Revenue</div>
        <div class="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRevenueInView)}</div>
      </div>
      <div class="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
        <DollarSign class="h-4 w-4" />
      </div>
    </div>

    <div class="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
      <div>
        <div class="text-xs text-slate-500">Completed Transactions</div>
        <div class="text-xl font-bold text-slate-900 dark:text-white">{totalCompletedCount} records</div>
      </div>
      <div class="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
        <Receipt class="h-4 w-4" />
      </div>
    </div>

    <div class="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
      <div>
        <div class="text-xs text-slate-500">Total Logged Records</div>
        <div class="text-xl font-bold text-slate-900 dark:text-white">{filteredSales.length} total</div>
      </div>
      <div class="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
        <Filter class="h-4 w-4" />
      </div>
    </div>
  </div>

  <!-- Records Data Table -->
  <Card title="Sales History Log">
    {#if filteredSales.length === 0}
      <div class="py-16 text-center text-slate-400">
        <Receipt class="h-12 w-12 mx-auto mb-2 text-slate-300 dark:text-slate-700 stroke-1" />
        <p class="font-medium text-sm">No sales records found</p>
        <p class="text-xs text-slate-400 mt-1">Try adjusting search parameters or complete a new sale on POS.</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
            <tr>
              <th class="pb-3 font-semibold">Sale Code</th>
              <th class="pb-3 font-semibold">Timestamp</th>
              <th class="pb-3 font-semibold">Purchased Items</th>
              <th class="pb-3 font-semibold">Payment</th>
              <th class="pb-3 font-semibold">Status</th>
              <th class="pb-3 font-semibold text-right">Net Amount</th>
              <th class="pb-3 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            {#each filteredSales as sale}
              <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td class="py-3.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {sale.sale_code}
                </td>
                <td class="py-3.5 text-slate-500">{formatDate(sale.timestamp)}</td>
                <td class="py-3.5 font-medium text-slate-800 dark:text-slate-200">
                  {sale.items.map((i) => i.brand_name).slice(0, 2).join(', ')}
                  {#if sale.items.length > 2}
                    <span class="text-slate-400 font-normal">+{sale.items.length - 2} more</span>
                  {/if}
                </td>
                <td class="py-3.5">
                  <Badge variant="secondary" class="text-[10px]">{sale.payment_method}</Badge>
                </td>
                <td class="py-3.5">
                  {#if sale.status === 'Completed'}
                    <Badge variant="success" class="text-[10px]">Completed</Badge>
                  {:else}
                    <Badge variant="destructive" class="text-[10px]">Refunded / Void</Badge>
                  {/if}
                </td>
                <td class="py-3.5 font-bold text-right text-slate-900 dark:text-slate-100 text-sm">
                  {formatCurrency(sale.net_amount)}
                </td>
                <td class="py-3.5 text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onclick={() => viewSaleDetails(sale)}
                      class="h-7 px-2 text-slate-600 dark:text-slate-300"
                      title="View Details"
                    >
                      <Eye class="h-3.5 w-3.5" />
                    </Button>
                    {#if sale.status === 'Completed'}
                      <Button
                        size="sm"
                        variant="ghost"
                        onclick={() => voidTransaction(sale)}
                        class="h-7 px-2 text-rose-600 hover:text-rose-700"
                        title="Refund / Void Transaction"
                      >
                        <RotateCcw class="h-3.5 w-3.5" />
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>

<!-- Transaction Details & Receipt Modal -->
<Dialog open={showDetailsDialog} onclose={() => (showDetailsDialog = false)} title="Transaction Details" maxWidth="max-w-md">
  {#if selectedSale}
    <div class="p-4 bg-white text-slate-900 font-mono text-xs border border-slate-200 rounded-lg space-y-3 my-2" id="printable-receipt">
      <div class="text-center border-b border-dashed border-slate-300 pb-3">
        <h3 class="font-bold text-base text-slate-900 font-sans">THE HALAL PHARMACY</h3>
        <p class="text-[11px] text-slate-600">Islamic Pharmacy & Medicine Outlet</p>
        <p class="text-[10px] text-slate-500 mt-1">Invoice: {selectedSale.sale_code}</p>
        <p class="text-[10px] text-slate-500">{formatDate(selectedSale.timestamp)}</p>
        <p class="text-[10px] font-bold text-slate-800 mt-1 uppercase">Status: {selectedSale.status}</p>
      </div>

      <div class="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
        {#each selectedSale.items as item}
          <div class="flex justify-between items-start">
            <div>
              <div class="font-bold">{item.brand_name} {item.power}</div>
              <div class="text-[10px] text-slate-500">{item.quantity} x {formatCurrency(item.unit_price)}</div>
            </div>
            <div class="font-bold">{formatCurrency(item.subtotal)}</div>
          </div>
        {/each}
      </div>

      <div class="space-y-1 text-right">
        <div class="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(selectedSale.total_amount)}</span>
        </div>
        {#if selectedSale.discount_amount > 0}
          <div class="flex justify-between text-rose-600">
            <span>Discount:</span>
            <span>-{formatCurrency(selectedSale.discount_amount)}</span>
          </div>
        {/if}
        <div class="flex justify-between font-bold text-sm border-t border-slate-300 pt-1 text-slate-900">
          <span>Net Total:</span>
          <span>{formatCurrency(selectedSale.net_amount)}</span>
        </div>
        <div class="flex justify-between text-[11px] text-slate-500 pt-1">
          <span>Payment Method:</span>
          <span>{selectedSale.payment_method}</span>
        </div>
      </div>
    </div>
  {/if}

  {#snippet footer()}
    {#if selectedSale && selectedSale.status === 'Completed'}
      <Button variant="destructive" onclick={() => voidTransaction(selectedSale!)} class="mr-auto">
        Refund / Void
      </Button>
    {/if}

    <Button variant="outline" onclick={printReceipt} class="flex items-center gap-1.5">
      <Printer class="h-4 w-4" />
      <span>Print Receipt</span>
    </Button>
    <Button variant="default" onclick={() => (showDetailsDialog = false)}>Close</Button>
  {/snippet}
</Dialog>
