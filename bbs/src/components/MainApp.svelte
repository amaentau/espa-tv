<script>
  import { onMount } from 'svelte';
  import { deviceState, refreshDevices } from '../lib/deviceState.svelte.js';
  import Header from './Header.svelte';
  import MenuSpinner from './MenuSpinner.svelte';
  import ProducerView from './ProducerView.svelte';
  import EspaTvView from './EspaTvView.svelte';
  import MusicView from './MusicView.svelte';
  import SettingsView from './SettingsView.svelte';
  import AdminModal from './modals/AdminModal.svelte';
  import GlobalControlBar from './GlobalControlBar.svelte';

  let { authState, onLogout } = $props();
  
  let targetDeviceIds = $state([]);
  let metadata = $state({ gameGroups: [], eventTypes: [] });
  let showAdminModal = $state(false);
  let historyRefreshTrigger = $state(0);
  let activeView = $state('producer'); // Default to producer view for now

  async function loadMetadata() {
    try {
      const res = await fetch('/config/metadata');
      metadata = await res.json();
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  }

  onMount(() => {
    deviceState.token = authState.token;
    loadMetadata();
    refreshDevices();
    
    // Periodically refresh device status
    const interval = setInterval(refreshDevices, 10000);
    return () => clearInterval(interval);
  });

  $effect(() => {
    if (deviceState.devices.length > 0 && targetDeviceIds.length === 0) {
      targetDeviceIds = [deviceState.devices[0].id];
    }
  });

  const refreshHistory = () => historyRefreshTrigger++;
  const onDevicesChanged = () => refreshDevices();
</script>

<div class="app-layout fade-in">
  <Header email={authState.userEmail} {onLogout} />

  {#if authState.isAdmin}
    <div style="text-align:center; margin-bottom:8px;">
      <button onclick={() => showAdminModal = true} class="admin-link-btn">
        🔧 Hallinta
      </button>
    </div>
  {/if}

  <MenuSpinner 
    bind:activeView 
    isAdmin={authState.isAdmin} 
    userGroup={authState.userGroup} 
  />

  <div class="view-content">
    {#if activeView === 'producer'}
      <ProducerView 
        {authState} 
        {onLogout} 
        devices={deviceState.devices} 
        bind:selectedDeviceId={deviceState.activeDeviceId}
        bind:targetDeviceIds={targetDeviceIds}
        {metadata}
        {onDevicesChanged}
        {historyRefreshTrigger}
        {refreshHistory}
      />
    {:else if activeView === 'settings'}
      <SettingsView 
        {authState} 
        onLogout={onLogout} 
        onOpenAdmin={() => showAdminModal = true}
      />
    {:else if activeView === 'tv'}
      <div class="empty-state">Espa TV Live -tulossa pian.</div>
    {:else if activeView === 'videot'}
      <EspaTvView 
        {authState} 
        devices={deviceState.devices} 
        token={authState.token}
      />
    {:else if activeView === 'music'}
      <MusicView 
        token={authState.token}
      />
    {/if}
  </div>

  <GlobalControlBar />
</div>

{#if showAdminModal}
  <AdminModal 
    token={authState.token} 
    userEmail={authState.userEmail}
    onClose={() => showAdminModal = false} 
    onMetadataChanged={loadMetadata}
  />
{/if}

<style>
  .app-layout {
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding-bottom: 40px;
  }

  .view-content {
    padding: 0 20px;
    flex: 1;
  }

  .admin-link-btn {
    width: auto; 
    padding: 4px 12px; 
    font-size: 12px; 
    background-color: transparent; 
    color: var(--text-sub);
    border: 1px solid var(--border-color);
    margin: 0;
  }
  .admin-link-btn:hover {
    background-color: #f0f0f0;
    color: var(--primary-color);
  }
</style>
