<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type SaleRecord, type InventoryItem } from '../db';
  import { formatCurrency, formatDate } from '../utils';
  import Card from './ui/Card.svelte';
  import Badge from './ui/Badge.svelte';
  import {
    DollarSign,
    ShoppingBag,
    Package,
    AlertTriangle,
    TrendingUp,
    Clock,
    Pill,
    ArrowUpRight
  } from 'lucide-svelte';

  let todayRevenue = $state(0);
  let todaySalesCount = $state(0);
  let totalItemsSoldToday = $state(0);
  let totalInventoryCount = $state(0);
  let lowStockCount = $state(0);
  let expiringSoonCount = $state(0);

  let recentSales = $state<SaleRecord[]>([]);
  let lowStockItems = $state<InventoryItem[]>([]);
  let topSellingItems = $state<{ brand_name: string; power: string; count: number; total: number }[]>([]);

  async function loadDashboardData() {
    try {
      const allSales = await db.sales.toArray();
      const allInventory = await db.inventory.toArray();

      // Filter today's sales
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      const todaySales = allSales.filter((s) => s.status === 'Completed' && s.timestamp.startsWith(todayStr));

      todayRevenue = todaySales.reduce((sum, s) => sum + s.net_amount, 0);
      todaySalesCount = todaySales.length;

      totalItemsSoldToday = todaySales.reduce((sum, s) => {
        return sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
      }, 0);

      // Inventory metrics
      totalInventoryCount = allInventory.length;
      lowStockItems = allInventory.filter((i) => i.stock_quantity <= 10);
      lowStockCount = lowStockItems.length;

      // Expiring soon (e.g. within 3 months)
      const currentYearMonth = now.toISOString().slice(0, 7); // "YYYY-MM"
      const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString().slice(0, 7);

      expiringSoonCount = allInventory.filter(
        (i) => i.expiry_month && i.expiry_month <= threeMonthsLater
      ).length;

      // Recent 5 sales
      recentSales = [...allSales].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

      // Calculate top selling medicines across all sales
      const itemMap = new Map<string, { brand_name: string; power: string; count: number; total: number }>();
      for (const sale of allSales) {
        if (sale.status !== 'Completed') continue;
        for (const item of sale.items) {
          const key = `${item.brand_name}-${item.power}`;
          const existing = itemMap.get(key) || { brand_name: item.brand_name, power: item.power, count: 0, total: 0 };
          existing.count += item.quantity;
          existing.total += item.subtotal;
          itemMap.set(key, existing);
        }
      }

      topSellingItems = Array.from(itemMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    }
  }

  onMount(() => {
    loadDashboardData();
  });
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 space-y-6">
  <!-- Top Title Banner -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pharmacy Overview</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time financials, inventory alerts, and sales performance.</p>
    </div>

    <div class="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
      <TrendingUp class="h-4 w-4 text-emerald-600" />
      <span>Live POS Data</span>
    </div>
  </div>

  <!-- Key Financial Metrics Cards Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Today Revenue -->
    <Card class="p-5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Revenue</span>
        <div class="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <DollarSign class="h-5 w-5" />
        </div>
      </div>
      <div class="mt-3">
        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(todayRevenue)}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{todaySalesCount} completed bills today</p>
      </div>
    </Card>

    <!-- Items Sold Today -->
    <Card class="p-5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Items Sold Today</span>
        <div class="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <ShoppingBag class="h-5 w-5" />
        </div>
      </div>
      <div class="mt-3">
        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">{totalItemsSoldToday} units</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Total medicine quantity</p>
      </div>
    </Card>

    <!-- Active Inventory Count -->
    <Card class="p-5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inventory Medicines</span>
        <div class="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <Package class="h-5 w-5" />
        </div>
      </div>
      <div class="mt-3">
        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">{totalInventoryCount} products</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">In local stock database</p>
      </div>
    </Card>

    <!-- Stock / Expiry Alerts -->
    <Card class="p-5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock Alerts</span>
        <div class="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <AlertTriangle class="h-5 w-5" />
        </div>
      </div>
      <div class="mt-3">
        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">{lowStockCount} Low</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{expiringSoonCount} expiring within 3 months</p>
      </div>
    </Card>
  </div>

  <!-- Middle Grid: Recent Sales & Top Sellers -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Recent Sales Table (7 Cols) -->
    <div class="lg:col-span-7">
      <Card title="Recent Sales Transactions" description="Latest completed customer purchases">
        {#if recentSales.length === 0}
          <div class="py-12 text-center text-slate-400">
            <Clock class="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700 stroke-1" />
            <p class="font-medium text-sm">No recent transactions recorded</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th class="pb-3 font-semibold">Sale Code</th>
                  <th class="pb-3 font-semibold">Time</th>
                  <th class="pb-3 font-semibold">Items</th>
                  <th class="pb-3 font-semibold">Payment</th>
                  <th class="pb-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                {#each recentSales as sale}
                  <tr>
                    <td class="py-3 font-bold font-mono text-emerald-600 dark:text-emerald-400">{sale.sale_code}</td>
                    <td class="py-3 text-slate-500">{formatDate(sale.timestamp)}</td>
                    <td class="py-3 font-medium text-slate-800 dark:text-slate-200">{sale.items.length} medicines</td>
                    <td class="py-3">
                      <Badge variant="secondary" class="text-[10px]">{sale.payment_method}</Badge>
                    </td>
                    <td class="py-3 font-bold text-right text-slate-900 dark:text-slate-100">
                      {formatCurrency(sale.net_amount)}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card>
    </div>

    <!-- Top Selling Medicines (5 Cols) -->
    <div class="lg:col-span-5">
      <Card title="Top Selling Medicines" description="Most frequently purchased stock items">
        {#if topSellingItems.length === 0}
          <div class="py-12 text-center text-slate-400">
            <Pill class="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700 stroke-1" />
            <p class="font-medium text-sm">No sales data yet</p>
          </div>
        {:else}
          <div class="space-y-3">
            {#each topSellingItems as item, idx}
              <div class="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50">
                <div class="flex items-center gap-3">
                  <div class="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                    #{idx + 1}
                  </div>
                  <div>
                    <div class="font-bold text-xs text-slate-900 dark:text-slate-100">{item.brand_name}</div>
                    <div class="text-[10px] text-slate-500">{item.power}</div>
                  </div>
                </div>

                <div class="text-right">
                  <div class="font-bold text-xs text-slate-900 dark:text-slate-100">{item.count} sold</div>
                  <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(item.total)}</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>
  </div>

  <!-- Low Stock Items Warning Table -->
  {#if lowStockItems.length > 0}
    <Card title="Low Stock Warning (< 10 units)" description="Medicines requiring reorder or restock">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-slate-200 dark:border-slate-800 text-slate-500">
            <tr>
              <th class="pb-3 font-semibold">Brand Name</th>
              <th class="pb-3 font-semibold">Generic Name</th>
              <th class="pb-3 font-semibold">Strength</th>
              <th class="pb-3 font-semibold">Unit Price</th>
              <th class="pb-3 font-semibold">Current Stock</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            {#each lowStockItems as item}
              <tr>
                <td class="py-3 font-bold text-slate-900 dark:text-slate-100">{item.brand_name}</td>
                <td class="py-3 text-slate-500">{item.generic_names.join(', ')}</td>
                <td class="py-3 text-slate-500">{item.power}</td>
                <td class="py-3 font-medium">{formatCurrency(item.unit_price)}</td>
                <td class="py-3">
                  {#if item.stock_quantity <= 0}
                    <Badge variant="destructive">Out of Stock</Badge>
                  {:else}
                    <Badge variant="warning">{item.stock_quantity} left</Badge>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</div>
