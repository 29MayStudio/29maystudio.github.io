<script lang="ts">
  import Layout from './lib/components/Layout.svelte';
  import HomePage from './lib/components/HomePage.svelte';
  import AddPage from './lib/components/AddPage.svelte';
  import RecordsPage from './lib/components/RecordsPage.svelte';

  let activeTab = $state('home');

  function navigateToAdd() {
    activeTab = 'add';
  }
</script>

<Layout bind:activeTab>
  <div class={activeTab === 'home' ? 'h-full flex flex-col' : 'hidden'}>
    <HomePage onNavigateToAdd={navigateToAdd} />
  </div>
  <div class={activeTab === 'add' ? 'h-full flex flex-col' : 'hidden'}>
    <AddPage />
  </div>
  <div class={activeTab === 'records' ? 'h-full flex flex-col' : 'hidden'}>
    <RecordsPage />
  </div>
</Layout>
