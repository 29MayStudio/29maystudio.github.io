<script lang="ts">
  import { db, type CatalogItem, type InventoryItem } from '../db';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Card from './ui/Card.svelte';
  import Badge from './ui/Badge.svelte';
  import {
    Sparkles,
    Edit3,
    Search,
    CheckCircle2,
    Plus,
    AlertCircle,
    Pill
  } from 'lucide-svelte';

  let mode = $state<'auto' | 'manual'>('auto');

  // Auto Mode State
  let catalogSearchQuery = $state('');
  let catalogResults = $state<CatalogItem[]>([]);
  let selectedCatalogItem = $state<CatalogItem | null>(null);

  let autoPower = $state('');
  let autoWholesalePrice = $state<number | ''>('');
  let autoUnitPrice = $state<number | ''>(''); // Retailer price
  let autoQuantity = $state<number | ''>('');
  let autoExpiryMonth = $state(''); // "YYYY-MM"

  // Manual Mode State
  let manualBrandName = $state('');
  let manualGenericName = $state('');
  let manualPower = $state('');
  let manualDosageForm = $state('Tablet');
  let manualManufacturer = $state('');
  let manualWholesalePrice = $state<number | ''>('');
  let manualUnitPrice = $state<number | ''>(''); // Retailer price
  let manualQuantity = $state<number | ''>('');
  let manualExpiryMonth = $state('');

  // Status & Feedback
  let successMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);

  function showNotification(success: boolean, text: string) {
    if (success) {
      successMsg = text;
      errorMsg = null;
      setTimeout(() => (successMsg = null), 4000);
    } else {
      errorMsg = text;
      successMsg = null;
      setTimeout(() => (errorMsg = null), 4000);
    }
  }

  // Catalog search effect - safe in-memory filtering
  async function searchCatalog() {
    if (!catalogSearchQuery.trim()) {
      catalogResults = [];
      return;
    }
    const q = catalogSearchQuery.toLowerCase().trim();
    try {
      const allCatalog = await db.catalog.toArray();
      catalogResults = allCatalog
        .filter((c) => {
          const brandMatch = c.brand_name ? c.brand_name.toLowerCase().includes(q) : false;
          const genericStrMatch = c.generic_search_string ? c.generic_search_string.toLowerCase().includes(q) : false;
          const genericNamesMatch = Array.isArray(c.generic_names) && c.generic_names.some((g) => g.toLowerCase().includes(q));
          return brandMatch || genericStrMatch || genericNamesMatch;
        })
        .slice(0, 20);
    } catch (e: any) {
      console.error('Catalog search error:', e);
      catalogResults = [];
    }
  }

  $effect(() => {
    searchCatalog();
  });

  function selectCatalogMedicine(item: CatalogItem) {
    selectedCatalogItem = item;
    autoPower = item.power || '';
  }

  async function handleAutoSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedCatalogItem) {
      showNotification(false, 'Please select a medicine from MedEx catalogue first.');
      return;
    }
    if (!autoUnitPrice || Number(autoUnitPrice) <= 0) {
      showNotification(false, 'Please enter a valid retailer unit price.');
      return;
    }
    if (!autoQuantity || Number(autoQuantity) <= 0) {
      showNotification(false, 'Please enter a valid stock quantity.');
      return;
    }

    try {
      const newItem: InventoryItem = {
        brand_name: selectedCatalogItem.brand_name,
        generic_names: selectedCatalogItem.generic_names || ['General Medicine'],
        power: autoPower || selectedCatalogItem.power || '',
        dosage_form: selectedCatalogItem.dosage_form || 'Tablet',
        manufacturer: selectedCatalogItem.manufacturer || 'Unknown',
        wholesale_price: autoWholesalePrice ? Number(autoWholesalePrice) : Number(autoUnitPrice),
        unit_price: Number(autoUnitPrice),
        stock_quantity: Number(autoQuantity),
        expiry_month: autoExpiryMonth || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        added_at: new Date().toISOString(),
        source: 'auto',
        catalog_id: selectedCatalogItem.id,
      };

      const cleanItem = JSON.parse(JSON.stringify(newItem));
      await db.inventory.add(cleanItem);

      window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));

      showNotification(true, `Successfully added "${newItem.brand_name}" (${newItem.power}) to inventory!`);

      selectedCatalogItem = null;
      catalogSearchQuery = '';
      autoPower = '';
      autoWholesalePrice = '';
      autoUnitPrice = '';
      autoQuantity = '';
      autoExpiryMonth = '';
    } catch (err: any) {
      showNotification(false, 'Error adding medicine: ' + err.message);
    }
  }

  async function handleManualSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!manualBrandName.trim()) {
      showNotification(false, 'Brand Name is required.');
      return;
    }
    if (!manualUnitPrice || Number(manualUnitPrice) <= 0) {
      showNotification(false, 'Please enter a valid retailer unit price.');
      return;
    }
    if (!manualQuantity || Number(manualQuantity) <= 0) {
      showNotification(false, 'Please enter a valid quantity.');
      return;
    }

    try {
      const generics = manualGenericName
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      const newItem: InventoryItem = {
        brand_name: manualBrandName.trim(),
        generic_names: generics.length > 0 ? generics : ['Custom Generic'],
        power: manualPower.trim() || 'N/A',
        dosage_form: manualDosageForm.trim() || 'Tablet',
        manufacturer: manualManufacturer.trim() || 'Custom Manufacturer',
        wholesale_price: manualWholesalePrice ? Number(manualWholesalePrice) : Number(manualUnitPrice),
        unit_price: Number(manualUnitPrice),
        stock_quantity: Number(manualQuantity),
        expiry_month: manualExpiryMonth || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        added_at: new Date().toISOString(),
        source: 'manual',
      };

      const cleanItem = JSON.parse(JSON.stringify(newItem));
      await db.inventory.add(cleanItem);

      window.dispatchEvent(new CustomEvent('pharmacy-db-updated'));

      showNotification(true, `Successfully added "${newItem.brand_name}" to inventory manually!`);

      manualBrandName = '';
      manualGenericName = '';
      manualPower = '';
      manualDosageForm = 'Tablet';
      manualManufacturer = '';
      manualWholesalePrice = '';
      manualUnitPrice = '';
      manualQuantity = '';
      manualExpiryMonth = '';
    } catch (err: any) {
      showNotification(false, 'Error adding medicine: ' + err.message);
    }
  }
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 space-y-6">
  <!-- Page Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Add Medicine</h2>
      <p class="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">Add new stock entries using MedEx catalogue or manual input.</p>
    </div>

    <!-- Toggle Mode Switch -->
    <div class="flex bg-slate-200 dark:bg-neutral-900 p-1 rounded-xl">
      <button
        type="button"
        onclick={() => (mode = 'auto')}
        class={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
          mode === 'auto'
            ? 'bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900'
        }`}
      >
        <Sparkles class="h-4 w-4" />
        <span>Auto Mode (MedEx)</span>
      </button>

      <button
        type="button"
        onclick={() => (mode = 'manual')}
        class={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
          mode === 'manual'
            ? 'bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900'
        }`}
      >
        <Edit3 class="h-4 w-4" />
        <span>Manual Mode</span>
      </button>
    </div>
  </div>

  <!-- Notification Banner -->
  {#if successMsg}
    <div class="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 dark:bg-teal-950/80 dark:border-teal-800 dark:text-teal-200 flex items-center gap-3">
      <CheckCircle2 class="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" />
      <span class="text-sm font-semibold">{successMsg}</span>
    </div>
  {/if}

  {#if errorMsg}
    <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-200 flex items-center gap-3">
      <AlertCircle class="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
      <span class="text-sm font-semibold">{errorMsg}</span>
    </div>
  {/if}

  <!-- Auto Mode View -->
  {#if mode === 'auto'}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Search & Select from MedEx Catalogue (7 Cols) -->
      <div class="lg:col-span-7">
        <Card title="Search MedEx Catalogue" description="Select existing Bangladeshi medicine to auto-fill details">
          <div class="space-y-4">
            <div class="relative">
              <Search class="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search catalog by Brand or Generic name..."
                bind:value={catalogSearchQuery}
                class="pl-10 h-11"
              />
            </div>

            <!-- Search Results List -->
            <div class="max-h-96 overflow-y-auto space-y-2 pr-1">
              {#if catalogSearchQuery && catalogResults.length === 0}
                <div class="p-6 text-center text-slate-400 text-xs">
                  No matching items found in MedEx database.
                </div>
              {:else if catalogResults.length > 0}
                {#each catalogResults as item}
                  <button
                    type="button"
                    onclick={() => selectCatalogMedicine(item)}
                    class={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                      selectedCatalogItem?.id === item.id
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 bg-white dark:bg-black'
                    }`}
                  >
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-sm text-slate-900 dark:text-slate-100">{item.brand_name}</span>
                        <span class="text-[11px] text-slate-500 font-medium">({item.power})</span>
                      </div>
                      <div class="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {Array.isArray(item.generic_names) ? item.generic_names.join(', ') : item.generic_names}
                      </div>
                      <div class="text-[10px] text-slate-400 mt-0.5">{item.manufacturer} &bull; {item.dosage_form}</div>
                    </div>

                    <Badge variant={selectedCatalogItem?.id === item.id ? 'default' : 'outline'} class="text-[10px]">
                      {selectedCatalogItem?.id === item.id ? 'Selected' : 'Select'}
                    </Badge>
                  </button>
                {/each}
              {:else}
                <div class="p-8 text-center text-slate-400 text-xs space-y-1">
                  <Pill class="h-8 w-8 mx-auto mb-1 text-slate-300 dark:text-neutral-700 stroke-1" />
                  <p>Type medicine name above to search MedEx database.</p>
                </div>
              {/if}
            </div>
          </div>
        </Card>
      </div>

      <!-- Right Column: Auto Details Input Form (5 Cols) -->
      <div class="lg:col-span-5">
        <Card title="Stock Details" description="Provide wholesale & retailer pricing, strength, expiry and stock quantity">
          {#if !selectedCatalogItem}
            <div class="py-16 text-center text-slate-400 space-y-2">
              <Sparkles class="h-10 w-10 mx-auto text-emerald-500 stroke-1" />
              <p class="font-medium text-sm text-slate-600 dark:text-slate-400">Select a medicine on the left</p>
              <p class="text-xs">Medicine properties will be populated automatically.</p>
            </div>
          {:else}
            <form onsubmit={handleAutoSubmit} class="space-y-4">
              <!-- Selected Summary Card -->
              <div class="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span class="text-[10px] uppercase tracking-wider font-bold text-emerald-800 dark:text-emerald-400">Selected Medicine</span>
                <h4 class="font-bold text-base text-slate-900 dark:text-white">{selectedCatalogItem.brand_name}</h4>
                <p class="text-xs text-slate-600 dark:text-slate-300">{Array.isArray(selectedCatalogItem.generic_names) ? selectedCatalogItem.generic_names.join(', ') : selectedCatalogItem.generic_names}</p>
                <p class="text-[11px] text-slate-500">{selectedCatalogItem.manufacturer} &bull; {selectedCatalogItem.dosage_form}</p>
              </div>

              <div>
                <label for="auto-power-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Strength / Power</label>
                <Input id="auto-power-input" placeholder="e.g. 500mg" bind:value={autoPower} />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="auto-wholesale-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Wholesale Price (৳)</label>
                  <Input id="auto-wholesale-input" type="number" step="0.01" min="0" placeholder="Cost price" bind:value={autoWholesalePrice} />
                </div>

                <div>
                  <label for="auto-price-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Retailer Price (৳) *</label>
                  <Input id="auto-price-input" type="number" step="0.01" min="0" placeholder="Selling price" bind:value={autoUnitPrice} required />
                </div>
              </div>

              <div>
                <label for="auto-qty-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Quantity / Stock *</label>
                <Input id="auto-qty-input" type="number" min="1" placeholder="e.g. 100" bind:value={autoQuantity} required />
              </div>

              <div>
                <label for="auto-expiry-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Expiry Month</label>
                <Input id="auto-expiry-input" type="month" bind:value={autoExpiryMonth} />
              </div>

              <Button type="submit" variant="default" size="lg" class="w-full font-bold flex items-center justify-center gap-2 mt-2 cursor-pointer">
                <Plus class="h-5 w-5" />
                <span>Save to Inventory</span>
              </Button>
            </form>
          {/if}
        </Card>
      </div>
    </div>
  {:else}
    <!-- Manual Mode View -->
    <Card title="Manual Medicine Registration" description="Enter medicine details manually with Wholesale & Retailer prices" class="max-w-3xl mx-auto">
      <form onsubmit={handleManualSubmit} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="manual-brand-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Brand Name *</label>
            <Input id="manual-brand-input" placeholder="e.g. Napa Extra" bind:value={manualBrandName} required />
          </div>

          <div>
            <label for="manual-generic-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Generic Name / Combination</label>
            <Input id="manual-generic-input" placeholder="e.g. Paracetamol + Caffeine" bind:value={manualGenericName} />
          </div>

          <div>
            <label for="manual-power-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Strength / Power</label>
            <Input id="manual-power-input" placeholder="e.g. 500 mg + 65 mg" bind:value={manualPower} />
          </div>

          <div>
            <label for="manual-dosage-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Dosage Form</label>
            <Input id="manual-dosage-input" placeholder="e.g. Tablet, Syrup, Injection" bind:value={manualDosageForm} />
          </div>

          <div>
            <label for="manual-manufacturer-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Manufacturer / Brand</label>
            <Input id="manual-manufacturer-input" placeholder="e.g. Beximco Pharmaceuticals Ltd." bind:value={manualManufacturer} />
          </div>

          <div>
            <label for="manual-expiry-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Expiry Month</label>
            <Input id="manual-expiry-input" type="month" bind:value={manualExpiryMonth} />
          </div>

          <div>
            <label for="manual-wholesale-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Wholesale Price (৳)</label>
            <Input id="manual-wholesale-input" type="number" step="0.01" min="0" placeholder="e.g. 10.00" bind:value={manualWholesalePrice} />
          </div>

          <div>
            <label for="manual-price-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Retailer Price (৳) *</label>
            <Input id="manual-price-input" type="number" step="0.01" min="0" placeholder="e.g. 12.50" bind:value={manualUnitPrice} required />
          </div>

          <div>
            <label for="manual-qty-input" class="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Initial Quantity *</label>
            <Input id="manual-qty-input" type="number" min="1" placeholder="e.g. 50" bind:value={manualQuantity} required />
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 dark:border-neutral-800 flex justify-end">
          <Button type="submit" variant="default" size="lg" class="px-8 font-bold flex items-center gap-2 cursor-pointer">
            <Plus class="h-5 w-5" />
            <span>Add Medicine to Inventory</span>
          </Button>
        </div>
      </form>
    </Card>
  {/if}
</div>
