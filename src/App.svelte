<script lang="ts">
  import { onMount } from 'svelte';
  import Layout from './lib/components/Layout.svelte';
  import SalePage from './lib/components/SalePage.svelte';
  import DashboardPage from './lib/components/DashboardPage.svelte';
  import AddMedicinePage from './lib/components/AddMedicinePage.svelte';
  import RecordsPage from './lib/components/RecordsPage.svelte';
  import SettingsPage from './lib/components/SettingsPage.svelte';

  let activeTab = $state('sale');

  onMount(() => {
    const fontMap: Record<string, string> = {
      'Inter': "'Inter', sans-serif",
      'Plus Jakarta Sans': "'Plus Jakarta Sans', sans-serif",
      'Poppins': "'Poppins', sans-serif",
      'Geist': "'Geist', sans-serif",
      'Outfit': "'Outfit', sans-serif",
      'Roboto': "'Roboto', sans-serif",
      'Fira Code': "'Fira Code', monospace",
    };
    const savedFont = localStorage.getItem('appFont');
    if (savedFont && fontMap[savedFont]) {
      document.body.style.fontFamily = fontMap[savedFont];
    }
  });
</script>

<Layout bind:activeTab>
  <div class={activeTab === 'sale' ? 'h-full flex flex-col' : 'hidden'}>
    <SalePage />
  </div>
  <div class={activeTab === 'dashboard' ? 'h-full flex flex-col' : 'hidden'}>
    <DashboardPage />
  </div>
  <div class={activeTab === 'add-medicine' ? 'h-full flex flex-col' : 'hidden'}>
    <AddMedicinePage />
  </div>
  <div class={activeTab === 'records' ? 'h-full flex flex-col' : 'hidden'}>
    <RecordsPage />
  </div>
  <div class={activeTab === 'settings' ? 'h-full flex flex-col' : 'hidden'}>
    <SettingsPage />
  </div>
</Layout>
