<script lang="ts">
  import Layout from './lib/components/Layout.svelte';
  import HomePage from './lib/components/HomePage.svelte';
  import RecordsPage from './lib/components/RecordsPage.svelte';
  import type { Client } from './lib/db';

  let activeTab = $state('home');
  let selectedClient = $state<Client | null>(null);
  let homePageRef = $state<{
    clearSelectedClient: () => void;
    openHomeSearch: () => void;
    openActiveSession: () => void;
  } | null>(null);

  function handleHomeClick() {
    if (homePageRef) {
      homePageRef.openHomeSearch();
    }
    activeTab = 'home';
  }

  function handleClientSessionClick() {
    if (homePageRef) {
      homePageRef.openActiveSession();
    }
    activeTab = 'home';
  }

  function navigateToRecords() {
    activeTab = 'records';
  }
</script>

<Layout
  bind:activeTab
  {selectedClient}
  onHomeClick={handleHomeClick}
  onClientSessionClick={handleClientSessionClick}
>
  <div class={activeTab === 'home' ? 'h-full flex flex-col' : 'hidden'}>
    <HomePage
      bind:this={homePageRef}
      bind:selectedClient
      onNavigateToRecords={navigateToRecords}
    />
  </div>
  <div class={activeTab === 'records' ? 'h-full flex flex-col' : 'hidden'}>
    <RecordsPage />
  </div>
</Layout>
