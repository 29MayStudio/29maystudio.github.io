<script lang="ts">
  import Layout from './lib/components/Layout.svelte';
  import SalePage from './lib/components/SalePage.svelte';
  import DashboardPage from './lib/components/DashboardPage.svelte';
  import AddMedicinePage from './lib/components/AddMedicinePage.svelte';
  import RecordsPage from './lib/components/RecordsPage.svelte';
  import SettingsPage from './lib/components/SettingsPage.svelte';

  let activeTab = $state('sale');
</script>

<Layout bind:activeTab>
  {#if activeTab === 'sale'}
    <SalePage />
  {:else if activeTab === 'dashboard'}
    <DashboardPage />
  {:else if activeTab === 'add-medicine'}
    <AddMedicinePage />
  {:else if activeTab === 'records'}
    <RecordsPage />
  {:else if activeTab === 'settings'}
    <SettingsPage />
  {/if}
</Layout>
