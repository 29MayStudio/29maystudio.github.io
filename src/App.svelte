<script lang="ts">
  import Layout from './lib/components/Layout.svelte';
  import HomePage from './lib/components/HomePage.svelte';
  import RecordsPage from './lib/components/RecordsPage.svelte';

  let activeTab = $state('home');
  let homePageRef = $state<{ clearSelectedClient: () => void } | null>(null);

  function handleHomeClick() {
    if (homePageRef) {
      homePageRef.clearSelectedClient();
    }
  }

  function navigateToRecords() {
    activeTab = 'records';
  }
</script>

<Layout bind:activeTab onHomeClick={handleHomeClick}>
  <div class={activeTab === 'home' ? 'h-full flex flex-col' : 'hidden'}>
    <HomePage bind:this={homePageRef} onNavigateToRecords={navigateToRecords} />
  </div>
  <div class={activeTab === 'records' ? 'h-full flex flex-col' : 'hidden'}>
    <RecordsPage />
  </div>
</Layout>
