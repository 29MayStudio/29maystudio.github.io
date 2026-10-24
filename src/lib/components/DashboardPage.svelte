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
    PiggyBank,
    Percent,
    Receipt,
    Calendar,
    Sparkles,
    ShieldAlert,
    BarChart3
  } from 'lucide-svelte';

  // Overall Financials & Today metrics
  let todayRevenue = $state(0);
  let todayWholesaleCost = $state(0);
  let todayProfit = $state(0);
  let todayProfitMargin = $state(0);
  let todayDiscountTotal = $state(0);
  let todaySalesCount = $state(0);
  let todayAvgBasket = $state(0);
  let totalItemsSoldToday = $state(0);

  // All-Time Summary Metrics
  let lifetimeRevenue = $state(0);
  let lifetimeProfit = $state(0);
  let lifetimeSalesCount = $state(0);

  // Stock Metrics
  let totalInventoryCount = $state(0);
  let totalStockUnits = $state(0);
  let totalInventoryValue = $state(0);
  let lowStockCount = $state(0);
  let outOfStockCount = $state(0);
  let expiringSoonCount = $state(0);

  let recentSales = $state<SaleRecord[]>([]);
  let lowStockItems = $state<InventoryItem[]>([]);
  let topSellingItems = $state<{ brand_name: string; power: string; count: number; total: number; profit: number }[]>([]);
  let topProfitableItems = $state<{ brand_name: string; power: string; count: number; totalProfit: number }[]>([]);

  async function loadDashboardData() {
    try {
      const allSales = await db.sales.toArray();
      const allInventory = await db.inventory.toArray();

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      // Filter Completed Sales
      const completedSales = allSales.filter((s) => s.status === 'Completed');
      const todaySales = completedSales.filter((s) => s.timestamp.startsWith(todayStr));

      // Today Metrics
      todayRevenue = todaySales.reduce((sum, s) => sum + s.net_amount, 0);
      todayDiscountTotal = todaySales.reduce((sum, s) => sum + (s.discount_amount || 0), 0);
      todaySalesCount = todaySales.length;
      todayAvgBasket = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0;

      let costSum = 0;
      for (const sale of todaySales) {
        for (const item of sale.items) {
          const wholesale = item.wholesale_price || item.unit_price;
          costSum += wholesale * item.quantity;
        }
      }
      todayWholesaleCost = costSum;
      todayProfit = todayRevenue - todayWholesaleCost;
      todayProfitMargin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

      totalItemsSoldToday = todaySales.reduce((sum, s) => {
        return sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
      }, 0);

      // All-time Metrics
      lifetimeRevenue = completedSales.reduce((sum, s) => sum + s.net_amount, 0);
      lifetimeSalesCount = completedSales.length;
      let lifetimeCost = 0;
      for (const sale of completedSales) {
        for (const item of sale.items) {
          const wholesale = item.wholesale_price || item.unit_price;
          lifetimeCost += wholesale * item.quantity;
        }
      }
      lifetimeProfit = lifetimeRevenue - lifetimeCost;

      // Inventory Metrics
      totalInventoryCount = allInventory.length;
      totalStockUnits = allInventory.reduce((sum, i) => sum + i.stock_quantity, 0);
      totalInventoryValue = allInventory.reduce((sum, i) => sum + (i.unit_price * i.stock_quantity), 0);

      outOfStockCount = allInventory.filter((i) => i.stock_quantity <= 0).length;
      lowStockItems = allInventory.filter((i) => i.stock_quantity <= 10).sort((a, b) => a.stock_quantity - b.stock_quantity);
      lowStockCount = lowStockItems.length;

      const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString().slice(0, 7);
      expiringSoonCount = allInventory.filter(
        (i) => i.expiry_month && i.expiry_month <= threeMonthsLater
      ).length;

      // Recent Sales Table (Compact Top 6)
      recentSales = [...allSales].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 6);

      // Top Selling & Top Profitable Analysis
      const itemMap = new Map<string, { brand_name: string; power: string; count: number; total: number; profit: number }>();
      for (const sale of completedSales) {
        for (const item of sale.items) {
          const key = `${item.brand_name}-${item.power}`;
          const wholesale = item.wholesale_price || item.unit_price;
          const profit = (item.unit_price - wholesale) * item.quantity;
          const existing = itemMap.get(key) || { brand_name: item.brand_name, power: item.power, count: 0, total: 0, profit: 0 };
          existing.count += item.quantity;
          existing.total += item.subtotal;
          existing.profit += profit;
          itemMap.set(key, existing);
        }
      }

      const allRanked = Array.from(itemMap.values());
      topSellingItems = [...allRanked].sort((a, b) => b.count - a.count).slice(0, 5);
      topProfitableItems = [...allRanked]
        .map((i) => ({ brand_name: i.brand_name, power: i.power, count: i.count, totalProfit: i.profit }))
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 5);

    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    }
  }

  onMount(() => {
    loadDashboardData();

    const handleDbUpdate = () => {
      loadDashboardData();
    };

    window.addEventListener('pharmacy-db-updated', handleDbUpdate);
    window.addEventListener('focus', handleDbUpdate);

    return () => {
      window.removeEventListener('pharmacy-db-updated', handleDbUpdate);
      window.removeEventListener('focus', handleDbUpdate);
    };
  });
</script>

<div class="h-full flex flex-col overflow-y-auto p-4 md:p-6 space-y-4">
  <!-- Top Header Bar -->
  <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-neutral-800">
    <div>
      <h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
        <span>Pharmacy Analytics & Operations</span>
        <Badge variant="success" class="text-[10px] font-mono">Live Sync</Badge>
      </h2>
      <p class="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">High-density overview of daily sales, profit margins, stock valuation and inventory health.</p>
    </div>

    <div class="flex items-center gap-2">
      <div class="text-left sm:text-right">
        <div class="text-xs font-bold text-slate-900 dark:text-slate-100">Stock Valuation</div>
        <div class="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-semibold">{formatCurrency(totalInventoryValue)}</div>
      </div>
    </div>
  </div>

  <!-- Row 1: Compact 6-KPI Header Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
    <!-- Today Revenue -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black flex flex-col justify-between shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Today Revenue</span>
        <DollarSign class="h-4 w-4 text-emerald-500 shrink-0" />
      </div>
      <div class="mt-2">
        <div class="text-lg font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(todayRevenue)}</div>
        <div class="text-[10px] text-slate-500 dark:text-neutral-400 flex items-center justify-between mt-0.5">
          <span>{todaySalesCount} sales</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-medium">Avg {formatCurrency(todayAvgBasket)}</span>
        </div>
      </div>
    </div>

    <!-- Wholesale Cost -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black flex flex-col justify-between shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Wholesale Cost</span>
        <ShoppingBag class="h-4 w-4 text-blue-500 shrink-0" />
      </div>
      <div class="mt-2">
        <div class="text-lg font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(todayWholesaleCost)}</div>
        <div class="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5">
          {totalItemsSoldToday} units sold today
        </div>
      </div>
    </div>

    <!-- Net Profit Today -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black flex flex-col justify-between shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Net Profit Today</span>
        <PiggyBank class="h-4 w-4 text-teal-500 shrink-0" />
      </div>
      <div class="mt-2">
        <div class={`text-lg font-bold font-mono ${todayProfit >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600'}`}>
          {formatCurrency(todayProfit)}
        </div>
        <div class="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5">
          After {formatCurrency(todayDiscountTotal)} discounts
        </div>
      </div>
    </div>

    <!-- Profit Margin % -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black flex flex-col justify-between shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Margin %</span>
        <Percent class="h-4 w-4 text-indigo-500 shrink-0" />
      </div>
      <div class="mt-2">
        <div class="text-lg font-bold text-slate-900 dark:text-white font-mono">
          {todayProfitMargin.toFixed(1)}%
        </div>
        <div class="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5">
          Lifetime: {formatCurrency(lifetimeProfit)}
        </div>
      </div>
    </div>

    <!-- Active Catalog & Stock -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black flex flex-col justify-between shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Inventory Items</span>
        <Package class="h-4 w-4 text-purple-500 shrink-0" />
      </div>
      <div class="mt-2">
        <div class="text-lg font-bold text-slate-900 dark:text-white font-mono">{totalInventoryCount} items</div>
        <div class="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5">
          {totalStockUnits.toLocaleString()} total units
        </div>
      </div>
    </div>

    <!-- Inventory Alerts -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black flex flex-col justify-between shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Stock Alerts</span>
        <AlertTriangle class="h-4 w-4 text-amber-500 shrink-0" />
      </div>
      <div class="mt-2">
        <div class="text-lg font-bold text-slate-900 dark:text-white font-mono">
          {lowStockCount} Low
        </div>
        <div class="text-[10px] text-slate-500 dark:text-neutral-400 flex justify-between mt-0.5">
          <span class="text-rose-500 font-medium">{outOfStockCount} empty</span>
          <span class="text-amber-500 font-medium">{expiringSoonCount} exp 3m</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Row 2: Recent Sales Log (7 cols) + Top Selling / Profit (5 cols) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <!-- Left Column: Compact Sales Audit Table (7 Cols) -->
    <div class="lg:col-span-7">
      <Card class="p-4" title="Recent Sales Activity" description="Real-time audit log of latest customer checkouts">
        {#if recentSales.length === 0}
          <div class="py-10 text-center text-slate-400">
            <Clock class="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-neutral-700 stroke-1" />
            <p class="font-medium text-xs">No recent sales recorded today</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="border-b border-slate-200 dark:border-neutral-800 text-slate-500 text-[10px] uppercase font-bold">
                <tr>
                  <th class="pb-2">Invoice Code</th>
                  <th class="pb-2">Time</th>
                  <th class="pb-2">Items</th>
                  <th class="pb-2 text-right">Discount</th>
                  <th class="pb-2 text-right">Net Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
                {#each recentSales as sale}
                  <tr class="hover:bg-slate-50 dark:hover:bg-neutral-900/40">
                    <td class="py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                      {sale.sale_code}
                    </td>
                    <td class="py-2.5 text-slate-500 text-[11px]">{formatDate(sale.timestamp)}</td>
                    <td class="py-2.5 font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                      {sale.items.map((i) => i.brand_name).slice(0, 2).join(', ')}
                      {#if sale.items.length > 2}
                        <span class="text-slate-400 font-normal">+{sale.items.length - 2}</span>
                      {/if}
                    </td>
                    <td class="py-2.5 text-right font-mono text-[11px] text-rose-500">
                      {sale.discount_amount > 0 ? `-${formatCurrency(sale.discount_amount)}` : '-'}
                    </td>
                    <td class="py-2.5 text-right font-bold font-mono text-slate-900 dark:text-slate-100 text-xs">
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

    <!-- Right Column: Top Selling & Highest Profit Medicines (5 Cols) -->
    <div class="lg:col-span-5 space-y-4">
      <Card class="p-4" title="Top 5 Selling Medicines" description="Most popular stock items by quantity sold">
        {#if topSellingItems.length === 0}
          <div class="py-6 text-center text-slate-400 text-xs">No sales data recorded yet.</div>
        {:else}
          <div class="space-y-2">
            {#each topSellingItems as item, idx}
              <div class="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-900/40">
                <div class="flex items-center gap-2.5">
                  <span class="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <div class="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">{item.brand_name}</div>
                    <div class="text-[10px] text-slate-500">{item.power}</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">{item.count} sold</div>
                  <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium font-mono">{formatCurrency(item.total)}</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <Card class="p-4" title="Highest Profit Generator" description="Medicines contributing most to total net margin">
        {#if topProfitableItems.length === 0}
          <div class="py-6 text-center text-slate-400 text-xs">No profit data recorded yet.</div>
        {:else}
          <div class="space-y-2">
            {#each topProfitableItems as item, idx}
              <div class="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-900/40">
                <div class="flex items-center gap-2.5">
                  <span class="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 font-bold text-[10px] flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <div class="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">{item.brand_name}</div>
                    <div class="text-[10px] text-slate-500">{item.power} &bull; {item.count} units</div>
                  </div>
                </div>
                <div class="text-right font-mono">
                  <div class="font-bold text-xs text-teal-600 dark:text-teal-400">+{formatCurrency(item.totalProfit)}</div>
                  <div class="text-[10px] text-slate-400">Net Profit</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>
  </div>

  <!-- Row 3: High-Density Low Stock & Out of Stock Warning Table -->
  {#if lowStockItems.length > 0}
    <Card class="p-4" title="Critical Stock & Reorder Alerts (< 10 units)" description="Stock items requiring urgent replenishment from suppliers">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-slate-200 dark:border-neutral-800 text-slate-500 text-[10px] uppercase font-bold">
            <tr>
              <th class="pb-2">Brand Name</th>
              <th class="pb-2">Generic Composition</th>
              <th class="pb-2">Strength</th>
              <th class="pb-2">Wholesale</th>
              <th class="pb-2">Retail Price</th>
              <th class="pb-2">Expiry</th>
              <th class="pb-2">Current Stock</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
            {#each lowStockItems as item}
              <tr class="hover:bg-slate-50 dark:hover:bg-neutral-900/40">
                <td class="py-2.5 font-bold text-slate-900 dark:text-slate-100">{item.brand_name}</td>
                <td class="py-2.5 text-slate-500 text-[11px] truncate max-w-[200px]">{item.generic_names.join(', ')}</td>
                <td class="py-2.5 text-slate-500">{item.power}</td>
                <td class="py-2.5 font-mono text-slate-500">{formatCurrency(item.wholesale_price || item.unit_price)}</td>
                <td class="py-2.5 font-mono font-medium text-slate-900 dark:text-slate-100">{formatCurrency(item.unit_price)}</td>
                <td class="py-2.5 text-slate-500 font-mono text-[11px]">{item.expiry_month || 'N/A'}</td>
                <td class="py-2.5">
                  {#if item.stock_quantity <= 0}
                    <Badge variant="destructive" class="text-[10px]">Out of Stock (0)</Badge>
                  {:else}
                    <Badge variant="warning" class="text-[10px]">{item.stock_quantity} left</Badge>
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
