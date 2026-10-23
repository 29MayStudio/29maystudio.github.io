<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type InventoryItem, type CartItem, type HeldBill, type SaleRecord } from '../db';
  import { formatCurrency, formatDate } from '../utils';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Badge from './ui/Badge.svelte';
  import Dialog from './ui/Dialog.svelte';
  import {
    Search,
    Plus,
    Minus,
    Trash2,
    PauseCircle,
    Play,
    CheckCircle2,
    Printer,
    Pill,
    X,
    AlertCircle,
    ShoppingBag,
    History
  } from 'lucide-svelte';

  // Search and inventory
  let searchQuery = $state('');
  let searchResults = $state<InventoryItem[]>([]);
  let inventoryList = $state<InventoryItem[]>([]);

  // Active Cart State
  let cart = $state<CartItem[]>([]);
  let discount = $state<number>(0);
  let isManualDiscount = $state<boolean>(false);

  // Held Bills state & dialogs
  let heldBills = $state<HeldBill[]>([]);
  let showHoldDialog = $state(false);
  let showHeldBillsListDialog = $state(false);
  let holdNote = $state('');

  // Checkout success receipt state
  let lastCompletedSale = $state<SaleRecord | null>(null);
  let showReceiptDialog = $state(false);

  // Quick info alert
  let alertMessage = $state<string | null>(null);

  function showAlert(msg: string) {
    alertMessage = msg;
    setTimeout(() => {
      alertMessage = null;
    }, 3000);
  }

  async function loadInventory() {
    try {
      inventoryList = await db.inventory.toArray();
      filterSearchResults();
    } catch (err) {
      console.error(err);
    }
  }

  async function loadHeldBills() {
    try {
      heldBills = await db.heldBills.orderBy('held_at').reverse().toArray();
    } catch (err) {
      console.error(err);
    }
  }

  onMount(() => {
    loadInventory();
    loadHeldBills();

    const handleDbUpdate = () => {
      loadInventory();
      loadHeldBills();
    };

    window.addEventListener('pharmacy-db-updated', handleDbUpdate);
    window.addEventListener('focus', handleDbUpdate);

    return () => {
      window.removeEventListener('pharmacy-db-updated', handleDbUpdate);
      window.removeEventListener('focus', handleDbUpdate);
    };
  });

  function filterSearchResults() {
    if (!searchQuery.trim()) {
      searchResults = inventoryList.slice(0, 15);
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    searchResults = inventoryList.filter((item: InventoryItem) => {
      const brandMatch = item.brand_name.toLowerCase().includes(q);
      const genericMatch = item.generic_names.some((g: string) => g.toLowerCase().includes(q));
      const powerMatch = item.power.toLowerCase().includes(q);
      return brandMatch || genericMatch || powerMatch;
    });
  }

  $effect(() => {
    filterSearchResults();
  });

  function calculateAutoDiscount(subtotal: number): number {
    if (subtotal <= 50) return 0;
    const lastDigit = Math.floor(subtotal) % 10;
    if (lastDigit >= 1 && lastDigit <= 4) {
      return lastDigit;
    } else if (lastDigit >= 6 && lastDigit <= 9) {
      return lastDigit - 5;
    }
    return 0;
  }

  function addToCart(item: InventoryItem) {
    if (item.stock_quantity <= 0) {
      showAlert(`"${item.brand_name}" is currently out of stock!`);
      return;
    }

    const existingIndex = cart.findIndex((c) => c.inventory_id === item.id);
    if (existingIndex >= 0) {
      if (cart[existingIndex].quantity + 1 > item.stock_quantity) {
        showAlert(`Cannot exceed available stock (${item.stock_quantity}) for "${item.brand_name}"`);
        return;
      }
      cart[existingIndex].quantity += 1;
      cart[existingIndex].subtotal = cart[existingIndex].quantity * cart[existingIndex].unit_price;
    } else {
      cart.push({
        inventory_id: item.id!,
        brand_name: item.brand_name,
        generic_names: item.generic_names,
        power: item.power,
        dosage_form: item.dosage_form,
        unit_price: item.unit_price,
        wholesale_price: item.wholesale_price,
        quantity: 1,
        expiry_month: item.expiry_month,
        subtotal: item.unit_price,
      });
    }

    if (!isManualDiscount) {
      discount = calculateAutoDiscount(subtotalAmount);
    }
  }

  function updateCartQuantity(index: number, delta: number) {
    const item = cart[index];
    const inventoryItem = inventoryList.find((i) => i.id === item.inventory_id);
    const maxStock = inventoryItem ? inventoryItem.stock_quantity : item.quantity;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }

    if (newQty > maxStock) {
      showAlert(`Max available stock is ${maxStock}`);
      return;
    }

    cart[index].quantity = newQty;
    cart[index].subtotal = newQty * item.unit_price;

    if (!isManualDiscount) {
      discount = calculateAutoDiscount(subtotalAmount);
    }
  }

  function removeFromCart(index: number) {
    cart.splice(index, 1);
    if (!isManualDiscount) {
      discount = calculateAutoDiscount(subtotalAmount);
    }
  }

  function clearCart() {
    cart = [];
    discount = 0;
    isManualDiscount = false;
  }

  function handleDiscountInput(e: Event) {
    const val = Number((e.target as HTMLInputElement).value);
    discount = isNaN(val) ? 0 : val;
    isManualDiscount = true;
  }

  function resetAutoDiscount() {
    isManualDiscount = false;
    discount = calculateAutoDiscount(subtotalAmount);
  }

  // Calculated totals & live profit evaluation
  let subtotalAmount = $derived(cart.reduce((sum, item) => sum + item.subtotal, 0));
  let netTotalAmount = $derived(Math.max(0, subtotalAmount - (discount || 0)));
  let totalWholesaleCost = $derived(
    cart.reduce((sum, item) => sum + (item.wholesale_price ?? item.unit_price) * item.quantity, 0)
  );
  let saleProfit = $derived(netTotalAmount - totalWholesaleCost);
  let saleMarginPercent = $derived(
    netTotalAmount > 0 ? (saleProfit / netTotalAmount) * 100 : 0
  );

  // Checkout process
  async function completeCheckout() {
    if (cart.length === 0) return;

    try {
      const saleCode = `INV-${Date.now().toString().slice(-6)}`;
      const nowIso = new Date().toISOString();

      const newSale: SaleRecord = {
        sale_code: saleCode,
        timestamp: nowIso,
        items: JSON.parse(JSON.stringify(cart)),
        total_amount: subtotalAmount,
        discount_amount: discount || 0,
        net_amount: netTotalAmount,
        status: 'Completed',
      };

      await db.transaction('rw', db.sales, db.inventory, async () => {
        const savedId = await db.sales.add(newSale);
        newSale.id = savedId as number;

        for (const item of cart) {
          const invItem = await db.inventory.get(item.inventory_id);
          if (invItem) {
            const updatedStock = Math.max(0, invItem.stock_quantity - item.quantity);
            await db.inventory.update(item.inventory_id, { stock_quantity: updatedStock });
          }
        }
      });

      lastCompletedSale = newSale;
      showReceiptDialog = true;

      window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));

      clearCart();
      await loadInventory();
    } catch (e: any) {
      console.error('Checkout error:', e);
      showAlert('Failed to complete transaction: ' + e.message);
    }
  }

  // Hold Bill logic
  async function confirmHoldBill() {
    if (cart.length === 0) return;

    try {
      const holdCode = `HOLD-${Date.now().toString().slice(-4)}`;
      const newHold: HeldBill = {
        hold_code: holdCode,
        held_at: new Date().toISOString(),
        note: holdNote.trim() || undefined,
        items: JSON.parse(JSON.stringify(cart)),
        total_amount: subtotalAmount,
      };

      await db.heldBills.add(newHold);
      window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));
      await loadHeldBills();

      clearCart();
      holdNote = '';
      showHoldDialog = false;
      showAlert(`Bill placed on hold (${holdCode})`);
    } catch (e: any) {
      showAlert('Failed to hold bill: ' + e.message);
    }
  }

  async function restoreHeldBill(heldBill: HeldBill) {
    if (cart.length > 0) {
      if (!confirm('Active cart is not empty. Replacing active cart with held bill?')) {
        return;
      }
    }

    cart = JSON.parse(JSON.stringify(heldBill.items));
    if (!isManualDiscount) {
      discount = calculateAutoDiscount(subtotalAmount);
    }
    if (heldBill.id) {
      await db.heldBills.delete(heldBill.id);
      window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));
      await loadHeldBills();
    }
    showHeldBillsListDialog = false;
    showAlert(`Restored held bill ${heldBill.hold_code}`);
  }

  async function deleteHeldBill(id: number) {
    await db.heldBills.delete(id);
    window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));
    await loadHeldBills();
  }

  function printReceipt() {
    window.print();
  }
</script>

<div class="h-full flex flex-col overflow-hidden">
  <!-- Top Bar -->
  <header class="bg-white dark:bg-black border-b border-slate-200 dark:border-neutral-800 px-6 py-3 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3">
      <h2 class="text-xl font-bold text-slate-900 dark:text-white">New Sale</h2>
      <Badge variant="outline" class="font-mono text-xs">Anonymous Checkout</Badge>
    </div>

    <div class="flex items-center gap-3">
      <!-- Held Bills Button -->
      <Button
        variant="outline"
        size="sm"
        onclick={() => (showHeldBillsListDialog = true)}
        class="relative flex items-center gap-2"
      >
        <History class="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span>Held Bills</span>
        {#if heldBills.length > 0}
          <span class="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
            {heldBills.length}
          </span>
        {/if}
      </Button>

      {#if cart.length > 0}
        <Button variant="secondary" size="sm" onclick={() => (showHoldDialog = true)} class="flex items-center gap-1.5">
          <PauseCircle class="h-4 w-4 text-amber-600" />
          <span>Hold Bill</span>
        </Button>
      {/if}
    </div>
  </header>

  <!-- Notification Banner -->
  {#if alertMessage}
    <div class="bg-amber-500 text-white text-sm font-medium px-6 py-2 flex items-center justify-between shadow-md">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4" />
        <span>{alertMessage}</span>
      </div>
      <button onclick={() => (alertMessage = null)} class="text-white/80 hover:text-white">
        <X class="h-4 w-4" />
      </button>
    </div>
  {/if}

  <!-- Main POS Grid: Left Medicine Catalogue/Search, Right Active Cart -->
  <div class="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
    <!-- Left Column: Search & Inventory Grid (7 Cols) -->
    <div class="col-span-7 border-r border-slate-200 dark:border-neutral-800 flex flex-col h-full bg-slate-50/50 dark:bg-black overflow-hidden">
      <!-- Search Bar Header -->
      <div class="p-4 bg-white dark:bg-black border-b border-slate-200 dark:border-neutral-800 space-y-2">
        <div class="relative">
          <Search class="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search medicine by Generic Name, Brand name, or Strength..."
            bind:value={searchQuery}
            class="pl-10 h-11 text-base shadow-xs border-slate-300 dark:border-neutral-800 focus:ring-emerald-500"
          />
          {#if searchQuery}
            <button
              onclick={() => (searchQuery = '')}
              class="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X class="h-4 w-4" />
            </button>
          {/if}
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Search by Generic, Brand, or Strength</span>
          <span>{searchResults.length} items found</span>
        </div>
      </div>

      <!-- Medicine Grid List -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if searchResults.length === 0}
          <div class="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Pill class="h-12 w-12 mb-3 text-slate-300 dark:text-neutral-700 stroke-1" />
            <p class="font-medium text-slate-600 dark:text-slate-400">No medicines found in inventory</p>
            <p class="text-xs text-slate-400 mt-1">Try searching another generic name or add medicines to inventory.</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {#each searchResults as item}
              <button
                type="button"
                onclick={() => addToCart(item)}
                disabled={item.stock_quantity <= 0}
                class={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer group hover:shadow-md ${
                  item.stock_quantity <= 0
                    ? 'bg-slate-100 dark:bg-neutral-900/40 border-slate-200 dark:border-neutral-800 opacity-60 cursor-not-allowed'
                    : 'bg-white dark:bg-black border-slate-200/80 dark:border-neutral-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50'
                }`}
              >
                <div>
                  <div class="flex items-start justify-between gap-1">
                    <h4 class="font-bold text-slate-900 dark:text-slate-100 text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {item.brand_name}
                    </h4>
                    <span class="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-900 shrink-0">
                      {item.dosage_form}
                    </span>
                  </div>

                  <p class="text-xs text-slate-500 dark:text-neutral-400 font-medium mt-0.5 line-clamp-1">
                    {item.power || 'N/A'}
                  </p>

                  <div class="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium line-clamp-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                    {item.generic_names.join(', ') || 'No Generic Info'}
                  </div>
                </div>

                <div class="mt-3 pt-2 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <span class="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {formatCurrency(item.unit_price)}
                  </span>

                  {#if item.stock_quantity <= 0}
                    <Badge variant="destructive" class="text-[10px]">Out of stock</Badge>
                  {:else if item.stock_quantity <= 10}
                    <Badge variant="warning" class="text-[10px]">{item.stock_quantity} left</Badge>
                  {:else}
                    <span class="text-slate-500 dark:text-neutral-400 font-medium text-[11px]">
                      Stock: {item.stock_quantity}
                    </span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right Column: Current Sale Cart & Quick Checkout (5 Cols) -->
    <div class="col-span-5 flex flex-col h-full bg-white dark:bg-black overflow-hidden">
      <!-- Cart Header -->
      <div class="p-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-black">
        <div class="flex items-center gap-2">
          <ShoppingBag class="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h3 class="font-bold text-slate-900 dark:text-slate-100">Current Order</h3>
          <span class="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full">
            {cart.reduce((sum, i) => sum + i.quantity, 0)} items
          </span>
        </div>

        {#if cart.length > 0}
          <button
            onclick={clearCart}
            class="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1 cursor-pointer"
          >
            <Trash2 class="h-3.5 w-3.5" />
            Clear
          </button>
        {/if}
      </div>

      <!-- Cart Item List -->
      <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
        {#if cart.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <ShoppingBag class="h-12 w-12 mb-3 text-slate-300 dark:text-neutral-700 stroke-1" />
            <p class="font-medium text-slate-600 dark:text-slate-400">Cart is empty</p>
            <p class="text-xs text-slate-400 mt-1">Select medicines from the left panel to add to bill.</p>
          </div>
        {:else}
          {#each cart as item, index}
            <div class="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/40 dark:bg-neutral-900/40 flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{item.brand_name}</span>
                  <span class="text-[11px] text-slate-500 dark:text-neutral-400 font-medium shrink-0">{item.power}</span>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                  {item.generic_names[0] || 'Generic'} &bull; {formatCurrency(item.unit_price)} each
                </div>
              </div>

              <!-- Quantity Controls -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onclick={() => updateCartQuantity(index, -1)}
                  class="h-7 w-7 rounded-md border border-slate-300 dark:border-neutral-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-900 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <Minus class="h-3.5 w-3.5" />
                </button>

                <span class="w-8 text-center font-bold text-sm text-slate-900 dark:text-slate-100">
                  {item.quantity}
                </span>

                <button
                  type="button"
                  onclick={() => updateCartQuantity(index, 1)}
                  class="h-7 w-7 rounded-md border border-slate-300 dark:border-neutral-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-900 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <Plus class="h-3.5 w-3.5" />
                </button>
              </div>

              <!-- Subtotal & Delete -->
              <div class="text-right shrink-0 min-w-[70px]">
                <div class="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {formatCurrency(item.subtotal)}
                </div>
                <button
                  type="button"
                  onclick={() => removeFromCart(index)}
                  class="text-[11px] text-rose-500 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Checkout Footer Summary -->
      <div class="p-4 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/80 dark:bg-black space-y-3 shrink-0">
        <!-- Subtotal & Discount -->
        <div class="space-y-2 text-sm">
          <div class="flex justify-between text-slate-600 dark:text-neutral-400">
            <span>Subtotal</span>
            <span class="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(subtotalAmount)}</span>
          </div>

          <div class="flex items-center justify-between text-slate-600 dark:text-neutral-400">
            <div class="flex items-center gap-1.5">
              <span>Discount (৳)</span>
              {#if !isManualDiscount && subtotalAmount > 50 && discount > 0}
                <span class="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">Auto Rounded</span>
              {/if}
              {#if isManualDiscount}
                <button
                  type="button"
                  onclick={resetAutoDiscount}
                  class="text-[10px] text-emerald-600 hover:underline cursor-pointer"
                >
                  Auto-fill
                </button>
              {/if}
            </div>
            <div class="w-28">
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={discount}
                oninput={handleDiscountInput}
                class="h-8 text-right font-medium text-sm py-0 dark:border-neutral-800"
              />
            </div>
          </div>

          <!-- Live Estimated Profit & Margin Section -->
          {#if cart.length > 0}
            <div class="p-2.5 rounded-lg border bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 space-y-1">
              <div class="flex justify-between items-center text-xs">
                <span class="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                  Estimated Sale Profit
                </span>
                <span class={`font-mono font-bold text-sm ${saleProfit >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCurrency(saleProfit)}
                </span>
              </div>
              <div class="flex justify-between items-center text-[11px] text-slate-500 dark:text-neutral-400">
                <span>Wholesale Cost: <strong class="font-mono text-slate-700 dark:text-slate-300">{formatCurrency(totalWholesaleCost)}</strong></span>
                <span class="font-mono font-semibold text-emerald-700 dark:text-emerald-400">Margin: {saleMarginPercent.toFixed(1)}%</span>
              </div>
            </div>
          {/if}

          <div class="flex justify-between items-center text-lg font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-neutral-800">
            <span>Net Payable</span>
            <span class="text-xl text-emerald-600 dark:text-emerald-400">{formatCurrency(netTotalAmount)}</span>
          </div>
        </div>

        <!-- Submit Checkout Button -->
        <Button
          variant="default"
          size="lg"
          disabled={cart.length === 0}
          onclick={completeCheckout}
          class="w-full h-12 text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
        >
          <CheckCircle2 class="h-5 w-5" />
          <span>Complete Sale ({formatCurrency(netTotalAmount)})</span>
        </Button>
      </div>
    </div>
  </div>
</div>

<!-- Dialog: Hold Bill Confirmation -->
<Dialog open={showHoldDialog} onclose={() => (showHoldDialog = false)} title="Hold Active Bill" description="Store current cart items on hold for later checkout.">
  <div class="space-y-4 py-2">
    <div>
      <label for="hold-note-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Optional Note / Customer Identifier</label>
      <Input id="hold-note-input" placeholder="e.g. Desk 2 / Waiting for doctor note" bind:value={holdNote} />
    </div>

    <div class="bg-slate-50 dark:bg-neutral-900 p-3 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs space-y-1">
      <div class="flex justify-between font-medium">
        <span>Cart Items:</span>
        <span>{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
      </div>
      <div class="flex justify-between font-bold text-slate-900 dark:text-slate-100">
        <span>Total Value:</span>
        <span>{formatCurrency(subtotalAmount)}</span>
      </div>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (showHoldDialog = false)}>Cancel</Button>
    <Button variant="default" onclick={confirmHoldBill}>Confirm Hold</Button>
  {/snippet}
</Dialog>

<!-- Dialog: View Held Bills List -->
<Dialog open={showHeldBillsListDialog} onclose={() => (showHeldBillsListDialog = false)} title="Held Bills List" description="Resume or manage current held sales bills." maxWidth="max-w-2xl">
  {#if heldBills.length === 0}
    <div class="py-12 text-center text-slate-400">
      <PauseCircle class="h-12 w-12 mx-auto mb-2 text-slate-300 dark:text-neutral-700 stroke-1" />
      <p class="font-medium">No bills on hold</p>
    </div>
  {:else}
    <div class="space-y-3 py-2">
      {#each heldBills as bill}
        <div class="p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm font-mono text-emerald-600 dark:text-emerald-400">{bill.hold_code}</span>
              <span class="text-xs text-slate-500">{formatDate(bill.held_at)}</span>
            </div>
            {#if bill.note}
              <p class="text-xs text-slate-600 dark:text-slate-300 italic mt-0.5">"{bill.note}"</p>
            {/if}
            <p class="text-xs text-slate-500 mt-1">
              {bill.items.length} unique medicines &bull; Total {formatCurrency(bill.total_amount)}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <Button size="sm" variant="outline" onclick={() => restoreHeldBill(bill)} class="flex items-center gap-1">
              <Play class="h-3.5 w-3.5 text-emerald-600" />
              <span>Resume</span>
            </Button>
            <Button size="sm" variant="ghost" onclick={() => deleteHeldBill(bill.id!)} class="text-rose-600 hover:text-rose-700">
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (showHeldBillsListDialog = false)}>Close</Button>
  {/snippet}
</Dialog>

<!-- Dialog: Sale Completed / Receipt View -->
<Dialog open={showReceiptDialog} onclose={() => (showReceiptDialog = false)} title="Receipt / Sale Completed" maxWidth="max-w-md">
  {#if lastCompletedSale}
    <div class="p-4 bg-white text-slate-900 font-mono text-xs border border-slate-200 rounded-lg space-y-3 my-2" id="printable-receipt">
      <div class="text-center border-b border-dashed border-slate-300 pb-3">
        <h3 class="font-bold text-base text-slate-900 font-sans">THE HALAL PHARMACY</h3>
        <p class="text-[11px] text-slate-600">Islamic Pharmacy & Medicine Outlet</p>
        <p class="text-[10px] text-slate-500 mt-1">Invoice: {lastCompletedSale.sale_code}</p>
        <p class="text-[10px] text-slate-500">{formatDate(lastCompletedSale.timestamp)}</p>
      </div>

      <div class="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
        {#each lastCompletedSale.items as item}
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
          <span>{formatCurrency(lastCompletedSale.total_amount)}</span>
        </div>
        {#if lastCompletedSale.discount_amount > 0}
          <div class="flex justify-between text-rose-600">
            <span>Discount:</span>
            <span>-{formatCurrency(lastCompletedSale.discount_amount)}</span>
          </div>
        {/if}
        <div class="flex justify-between font-bold text-sm border-t border-slate-300 pt-1 text-slate-900">
          <span>Net Total:</span>
          <span>{formatCurrency(lastCompletedSale.net_amount)}</span>
        </div>
      </div>

      <div class="text-center border-t border-dashed border-slate-300 pt-3 text-[10px] text-slate-500">
        <p>Thank you for choosing The Halal Pharmacy!</p>
        <p>May Allah grant you complete health & shifa.</p>
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={printReceipt} class="flex items-center gap-1.5">
      <Printer class="h-4 w-4" />
      <span>Print Receipt</span>
    </Button>
    <Button variant="default" onclick={() => (showReceiptDialog = false)}>Done</Button>
  {/snippet}
</Dialog>
