<script lang="ts">
  import { onMount } from 'svelte';
  import { db, seedInitialData, type Client, type FabricType, type Dia } from '../db';
  import { UserPlus, Layers, Ruler, Trash2, Pencil, Plus, Users, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-svelte';
  import Dialog from './ui/Dialog.svelte';

  // Reactive state
  let clients = $state<Client[]>([]);
  let fabricTypes = $state<FabricType[]>([]);
  let dias = $state<Dia[]>([]);

  // Edit states
  let editingClient = $state<{ open: boolean; client: Client | null; name: string; address: string }>({
    open: false,
    client: null,
    name: '',
    address: ''
  });

  let editingFabric = $state<{ open: boolean; fabric: FabricType | null; name: string }>({
    open: false,
    fabric: null,
    name: ''
  });

  let editingDia = $state<{ open: boolean; dia: Dia | null; value: string }>({
    open: false,
    dia: null,
    value: ''
  });

  // Form states
  let clientName = $state('');
  let clientAddress = $state('');
  let clientError = $state('');
  let clientSuccess = $state('');

  let fabricTypeName = $state('');
  let fabricError = $state('');
  let fabricSuccess = $state('');

  let diaValue = $state('');
  let diaError = $state('');
  let diaSuccess = $state('');

  let activeTab = $state<'clients' | 'fabrics' | 'dias'>('clients');

  // Custom confirmation modal state
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

  function openConfirmModal(title: string, message: string, onConfirm: () => void) {
    confirmModal = {
      open: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        confirmModal.open = false;
      }
    };
  }

  onMount(async () => {
    await seedInitialData();
    await loadAllData();
  });

  async function loadAllData() {
    clients = await db.clients.orderBy('name').toArray();
    fabricTypes = await db.fabricTypes.orderBy('name').toArray();
    dias = await db.dias.toArray();
  }

  async function handleAddClient(e: SubmitEvent) {
    e.preventDefault();
    clientError = '';
    clientSuccess = '';
    if (!clientName.trim()) {
      clientError = 'Client name is required.';
      return;
    }

    try {
      // Check duplicate client name (case insensitive)
      const existing = clients.find(
        (c) => c.name.toLowerCase() === clientName.trim().toLowerCase()
      );
      if (existing) {
        clientError = 'A client with this name already exists.';
        return;
      }

      await db.clients.add({
        name: clientName.trim(),
        address: clientAddress.trim() || undefined,
        created_at: new Date().toISOString()
      });
      clientName = '';
      clientAddress = '';
      clientSuccess = 'Client added successfully!';
      await loadAllData();
      window.dispatchEvent(new CustomEvent('db-updated'));
      setTimeout(() => (clientSuccess = ''), 3000);
    } catch (err: any) {
      clientError = err?.message || 'Failed to add client.';
    }
  }

  async function handleDeleteClient(id?: number) {
    if (!id) return;
    openConfirmModal('Delete Client', 'Are you sure you want to delete this client?', async () => {
      await db.clients.delete(id);
      await loadAllData();
      window.dispatchEvent(new CustomEvent('db-updated'));
    });
  }

  function openEditClientModal(client: Client) {
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

    if (!newName) return;

    // Duplicate check
    const existing = clients.find(
      (c) => c.id !== editingClient.client!.id && c.name.toLowerCase() === newName.toLowerCase()
    );
    if (existing) {
      alert('A client with this name already exists.');
      return;
    }

    const updatedClient = {
      ...editingClient.client,
      name: newName,
      address: newAddress
    };

    await db.clients.put(JSON.parse(JSON.stringify(updatedClient)));

    // Cascade update to records if name changed
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
    await loadAllData();
    window.dispatchEvent(new CustomEvent('db-updated'));
  }

  function openEditFabricModal(fabric: FabricType) {
    editingFabric = {
      open: true,
      fabric,
      name: fabric.name
    };
  }

  async function handleSaveEditFabric() {
    if (!editingFabric.fabric || !editingFabric.fabric.id) return;
    const oldName = editingFabric.fabric.name;
    const newName = editingFabric.name.trim();

    if (!newName) return;

    await db.fabricTypes.put(JSON.parse(JSON.stringify({ ...editingFabric.fabric, name: newName })));

    // Cascade update in received and delivered records
    if (oldName !== newName) {
      const allRx = await db.receivedRecords.toArray();
      for (const rec of allRx) {
        let changed = false;
        if (rec.yarn_count === oldName) {
          rec.yarn_count = newName;
          changed = true;
        }
        if (rec.items && rec.items.length > 0) {
          rec.items.forEach((item) => {
            if (item.yarn_count === oldName) {
              item.yarn_count = newName;
              changed = true;
            }
          });
        }
        if (changed) {
          await db.receivedRecords.put(JSON.parse(JSON.stringify(rec)));
        }
      }

      const allDx = await db.deliveredRecords.toArray();
      for (const rec of allDx) {
        let changed = false;
        if (rec.yarn_count === oldName) {
          rec.yarn_count = newName;
          changed = true;
        }
        if (rec.items && rec.items.length > 0) {
          rec.items.forEach((item) => {
            if (item.yarn_count === oldName) {
              item.yarn_count = newName;
              changed = true;
            }
          });
        }
        if (changed) {
          await db.deliveredRecords.put(JSON.parse(JSON.stringify(rec)));
        }
      }
    }

    editingFabric.open = false;
    await loadAllData();
    window.dispatchEvent(new CustomEvent('db-updated'));
  }

  function openEditDiaModal(dia: Dia) {
    editingDia = {
      open: true,
      dia,
      value: dia.value
    };
  }

  async function handleSaveEditDia() {
    if (!editingDia.dia || !editingDia.dia.id) return;
    const oldValue = editingDia.dia.value;
    const newValue = editingDia.value.trim();

    if (!newValue) return;

    await db.dias.put(JSON.parse(JSON.stringify({ ...editingDia.dia, value: newValue })));

    // Cascade update in delivered records
    if (oldValue !== newValue) {
      const allDx = await db.deliveredRecords.toArray();
      for (const rec of allDx) {
        let changed = false;
        if (rec.dia === oldValue) {
          rec.dia = newValue;
          changed = true;
        }
        if (rec.items && rec.items.length > 0) {
          rec.items.forEach((item) => {
            if (item.dia === oldValue) {
              item.dia = newValue;
              changed = true;
            }
          });
        }
        if (changed) {
          await db.deliveredRecords.put(JSON.parse(JSON.stringify(rec)));
        }
      }
    }

    editingDia.open = false;
    await loadAllData();
    window.dispatchEvent(new CustomEvent('db-updated'));
  }

  async function handleAddFabricType(e: SubmitEvent) {
    e.preventDefault();
    fabricError = '';
    fabricSuccess = '';
    if (!fabricTypeName.trim()) {
      fabricError = 'Yarn type name is required.';
      return;
    }

    try {
      await db.fabricTypes.add({
        name: fabricTypeName.trim()
      });
      fabricTypeName = '';
      fabricSuccess = 'Yarn type added!';
      await loadAllData();
      window.dispatchEvent(new CustomEvent('db-updated'));
      setTimeout(() => (fabricSuccess = ''), 3000);
    } catch (err: any) {
      fabricError = 'Yarn type already exists or invalid.';
    }
  }

  async function handleDeleteFabricType(id?: number) {
    if (!id) return;
    openConfirmModal('Delete Yarn Type', 'Are you sure you want to delete this yarn type?', async () => {
      await db.fabricTypes.delete(id);
      await loadAllData();
      window.dispatchEvent(new CustomEvent('db-updated'));
    });
  }

  async function handleAddDia(e: SubmitEvent) {
    e.preventDefault();
    diaError = '';
    diaSuccess = '';
    if (!diaValue.trim()) {
      diaError = 'Dia value is required.';
      return;
    }

    try {
      await db.dias.add({
        value: diaValue.trim()
      });
      diaValue = '';
      diaSuccess = 'Dia added!';
      await loadAllData();
      window.dispatchEvent(new CustomEvent('db-updated'));
      setTimeout(() => (diaSuccess = ''), 3000);
    } catch (err: any) {
      diaError = 'Dia already exists or invalid.';
    }
  }

  async function handleDeleteDia(id?: number) {
    if (!id) return;
    openConfirmModal('Delete Dia', 'Are you sure you want to delete this Dia value?', async () => {
      await db.dias.delete(id);
      await loadAllData();
      window.dispatchEvent(new CustomEvent('db-updated'));
    });
  }
</script>

<div class="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
  <!-- Page Header -->
  <div class="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-4">
    <div>
      <h1 class="text-2xl font-normal text-slate-900 dark:text-white">
        Data Management
      </h1>
      <p class="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">
        Add and manage Clients, Yarn Types, and Dias for your knitting factory.
      </p>
    </div>

    <!-- Sub-tab Selector -->
    <div class="flex bg-slate-200 dark:bg-neutral-900 p-1 rounded-xl">
      <button
        type="button"
        onclick={() => (activeTab = 'clients')}
        class={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          activeTab === 'clients'
            ? 'bg-emerald-600 text-white'
            : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Users class="w-4 h-4" />
        Clients ({clients.length})
      </button>
      <button
        type="button"
        onclick={() => (activeTab = 'fabrics')}
        class={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          activeTab === 'fabrics'
            ? 'bg-emerald-600 text-white'
            : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Layers class="w-4 h-4" />
        Yarn Types ({fabricTypes.length})
      </button>
      <button
        type="button"
        onclick={() => (activeTab = 'dias')}
        class={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          activeTab === 'dias'
            ? 'bg-emerald-600 text-white'
            : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Ruler class="w-4 h-4" />
        Dias ({dias.length})
      </button>
    </div>
  </div>

  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
    {#if activeTab === 'clients'}
      <!-- Add Client Form (Left Column 5 cols) -->
      <div class="lg:col-span-5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-neutral-800">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <UserPlus class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Add New Client</h2>
              <p class="text-xs text-slate-500 dark:text-neutral-400">Client will appear in Home screen autocomplete</p>
            </div>
          </div>

          {#if clientError}
            <div class="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>{clientError}</span>
            </div>
          {/if}

          {#if clientSuccess}
            <div class="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
              <CheckCircle2 class="w-4 h-4 shrink-0" />
              <span>{clientSuccess}</span>
            </div>
          {/if}

          <form id="add-client-form" onsubmit={handleAddClient} class="space-y-4">
            <div>
              <label for="client-name-input" class="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mb-1.5">
                Client / Company Name *
              </label>
              <input
                id="client-name-input"
                type="text"
                bind:value={clientName}
                placeholder="e.g. Apex Textiles Ltd."
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                required
              />
            </div>

            <div>
              <label for="client-address-input" class="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mb-1.5">
                Address / Location (Optional)
              </label>
              <textarea
                id="client-address-input"
                bind:value={clientAddress}
                placeholder="e.g. Gazipur, Dhaka"
                rows="3"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
              ></textarea>
            </div>
          </form>
        </div>

        <div class="pt-4 mt-6 border-t border-slate-100 dark:border-neutral-800">
          <button
            type="submit"
            form="add-client-form"
            class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <Plus class="w-4 h-4" /> Save Client
          </button>
        </div>
      </div>

      <!-- Clients List Table (Right Column 7 cols) -->
      <div class="lg:col-span-7 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
          <span>Registered Clients</span>
          <span class="text-xs bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 px-2.5 py-1 rounded-full">
            Total: {clients.length}
          </span>
        </h2>

        {#if clients.length === 0}
          <div class="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-neutral-500">
            <Users class="w-12 h-12 mb-3 stroke-1" />
            <p class="font-medium text-slate-600 dark:text-neutral-300">No clients registered yet</p>
            <p class="text-xs mt-1">Add your first knitting client on the left form.</p>
          </div>
        {:else}
          <div class="overflow-x-auto flex-1">
            <table class="w-full text-left text-sm">
              <thead class="text-xs bg-slate-50 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border-b border-slate-200 dark:border-neutral-700">
                <tr>
                  <th class="px-4 py-3 rounded-tl-xl">Client Name</th>
                  <th class="px-4 py-3">Address</th>
                  <th class="px-4 py-3 text-right rounded-tr-xl">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-neutral-800">
                {#each clients as client}
                  <tr class="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {client.name}
                    </td>
                    <td class="px-4 py-3 text-slate-500 dark:text-neutral-400 text-xs">
                      {client.address || '-'}
                    </td>
                    <td class="px-4 py-3 text-right flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onclick={() => openEditClientModal(client)}
                        class="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Edit Client"
                      >
                        <Pencil class="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onclick={() => handleDeleteClient(client.id)}
                        class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete Client"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'fabrics'}
      <!-- Add Fabric Form -->
      <div class="lg:col-span-5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-neutral-800">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Layers class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Add Yarn Type</h2>
              <p class="text-xs text-slate-500 dark:text-neutral-400">e.g., 30s Cotton, 28s Polyester, Melange</p>
            </div>
          </div>

          {#if fabricError}
            <div class="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>{fabricError}</span>
            </div>
          {/if}

          {#if fabricSuccess}
            <div class="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
              <CheckCircle2 class="w-4 h-4 shrink-0" />
              <span>{fabricSuccess}</span>
            </div>
          {/if}

          <form id="add-fabric-form" onsubmit={handleAddFabricType} class="space-y-4">
            <div>
              <label for="fabric-name-input" class="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mb-1.5">
                Yarn Type Name *
              </label>
              <input
                id="fabric-name-input"
                type="text"
                bind:value={fabricTypeName}
                placeholder="e.g. 30s Cotton"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                required
              />
            </div>
          </form>
        </div>

        <div class="pt-4 mt-6 border-t border-slate-100 dark:border-neutral-800">
          <button
            type="submit"
            form="add-fabric-form"
            class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <Plus class="w-4 h-4" /> Save Yarn Type
          </button>
        </div>
      </div>

      <!-- Fabrics List -->
      <div class="lg:col-span-7 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
          <span>Active Yarn Types</span>
          <span class="text-xs bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 px-2.5 py-1 rounded-full">
            Total: {fabricTypes.length}
          </span>
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto max-h-[500px] pr-1">
          {#each fabricTypes as fabric}
            <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
              <span class="font-medium text-slate-900 dark:text-white text-sm">{fabric.name}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  onclick={() => openEditFabricModal(fabric)}
                  class="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Edit Yarn Type"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={() => handleDeleteFabricType(fabric.id)}
                  class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Delete Fabric Type"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>

    {:else if activeTab === 'dias'}
      <!-- Add Dia Form -->
      <div class="lg:col-span-5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-neutral-800">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Ruler class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Add Dia</h2>
              <p class="text-xs text-slate-500 dark:text-neutral-400">e.g., 20", 24", 30", 32"</p>
            </div>
          </div>

          {#if diaError}
            <div class="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>{diaError}</span>
            </div>
          {/if}

          {#if diaSuccess}
            <div class="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
              <CheckCircle2 class="w-4 h-4 shrink-0" />
              <span>{diaSuccess}</span>
            </div>
          {/if}

          <form id="add-dia-form" onsubmit={handleAddDia} class="space-y-4">
            <div>
              <label for="dia-value-input" class="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mb-1.5">
                Dia Value *
              </label>
              <input
                id="dia-value-input"
                type="text"
                bind:value={diaValue}
                placeholder='e.g. 30"'
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                required
              />
            </div>
          </form>
        </div>

        <div class="pt-4 mt-6 border-t border-slate-100 dark:border-neutral-800">
          <button
            type="submit"
            form="add-dia-form"
            class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <Plus class="w-4 h-4" /> Save Dia
          </button>
        </div>
      </div>

      <!-- Dias List -->
      <div class="lg:col-span-7 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
          <span>Active Dias</span>
          <span class="text-xs bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 px-2.5 py-1 rounded-full">
            Total: {dias.length}
          </span>
        </h2>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto max-h-[500px] pr-1">
          {#each dias as dia}
            <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
              <span class="font-bold text-slate-900 dark:text-white text-base">{dia.value}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  onclick={() => openEditDiaModal(dia)}
                  class="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Edit Dia"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={() => handleDeleteDia(dia.id)}
                  class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Delete Dia"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Custom Confirm Modal -->
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
        class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-semibold text-slate-700 dark:text-neutral-300 cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={confirmModal.onConfirm}
        class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
      >
        Delete Item
      </button>
    </div>
  </div>
</Dialog>

<!-- Edit Client Modal -->
<Dialog open={editingClient.open} onclose={() => (editingClient.open = false)} title="Edit Client Details" maxWidth="max-w-md">
  <div class="space-y-4 text-xs">
    <div>
      <label for="edit-client-name" class="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mb-1">
        Client / Company Name *
      </label>
      <input
        id="edit-client-name"
        type="text"
        bind:value={editingClient.name}
        class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white text-xs"
        required
      />
    </div>

    <div>
      <label for="edit-client-address" class="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mb-1">
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
        class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-semibold cursor-pointer"
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

<!-- Edit Yarn Type Modal -->
<Dialog open={editingFabric.open} onclose={() => (editingFabric.open = false)} title="Edit Yarn Type" maxWidth="max-w-md">
  <div class="space-y-4 text-xs">
    <div>
      <label for="edit-fabric-name" class="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mb-1">
        Yarn Type Name *
      </label>
      <input
        id="edit-fabric-name"
        type="text"
        bind:value={editingFabric.name}
        class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white text-xs"
        required
      />
    </div>

    <div class="pt-3 border-t border-slate-100 dark:border-neutral-800 flex justify-end gap-2">
      <button
        type="button"
        onclick={() => (editingFabric.open = false)}
        class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-semibold cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleSaveEditFabric}
        class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
      >
        Save Changes
      </button>
    </div>
  </div>
</Dialog>

<!-- Edit Dia Modal -->
<Dialog open={editingDia.open} onclose={() => (editingDia.open = false)} title="Edit Dia Value" maxWidth="max-w-md">
  <div class="space-y-4 text-xs">
    <div>
      <label for="edit-dia-value" class="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mb-1">
        Dia Value *
      </label>
      <input
        id="edit-dia-value"
        type="text"
        bind:value={editingDia.value}
        class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-white text-xs"
        required
      />
    </div>

    <div class="pt-3 border-t border-slate-100 dark:border-neutral-800 flex justify-end gap-2">
      <button
        type="button"
        onclick={() => (editingDia.open = false)}
        class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-semibold cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleSaveEditDia}
        class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
      >
        Save Changes
      </button>
    </div>
  </div>
</Dialog>
