<script>
  import { onMount } from 'svelte';
  import { deviceState, refreshDevices } from '../lib/deviceState.svelte.js';
  import Header from './Header.svelte';
  import MenuSpinner from './MenuSpinner.svelte';
  import ProducerView from './ProducerView.svelte';
  import EspaTvView from './EspaTvView.svelte';
  import HighlightsView from './HighlightsView.svelte';
  import MusicView from './MusicView.svelte';
  import SettingsView from './SettingsView.svelte';
  import AdminModal from './modals/AdminModal.svelte';
  import GlobalControlBar from './GlobalControlBar.svelte';
  import MediaManager from './MediaManager.svelte';

  let { authState, onLogout } = $props();
  
  let targetDeviceIds = $state([]);
  let metadata = $state({ gameGroups: [], eventTypes: [] });
  let showAdminModal = $state(false);
  let historyRefreshTrigger = $state(0);

  // Helper to check if user has access to a specific view
  const canAccess = (view) => {
    if (view !== 'producer') return true;
    return authState.isAdmin || authState.userGroup === 'Veo Ylläpitäjä';
  };

  // If activeView is set to something user cannot access, fallback to 'tv'
  $effect(() => {
    if (!canAccess(deviceState.activeView)) {
      deviceState.activeView = 'tv';
    }
  });

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
  <Header 
    email={authState.userEmail} 
    username={authState.username}
    {onLogout} 
  />

  <MenuSpinner 
    isAdmin={authState.isAdmin} 
    userGroup={authState.userGroup} 
  />

  <div class="view-content">
    {#if deviceState.activeView === 'producer'}
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
    {:else if deviceState.activeView === 'settings'}
      <SettingsView 
        {authState} 
        onOpenAdmin={() => showAdminModal = true}
      />
    {:else if deviceState.activeView === 'tv'}
      <EspaTvView 
        {authState} 
        devices={deviceState.devices} 
        token={authState.token}
      />
    {:else if deviceState.activeView === 'videot'}
      <HighlightsView 
        {authState} 
        devices={deviceState.devices} 
        token={authState.token}
      />
    {:else if deviceState.activeView === 'music'}
      <MusicView 
        {authState}
        token={authState.token}
      />
    {/if}
  </div>

  <GlobalControlBar />
</div>

<MediaManager />

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
    margin-left: auto;
    margin-right: auto;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 10px 0 100px 0;
    position: relative;
    overflow-x: hidden;
  }

  .view-content {
    padding: 0 16px;
    flex: 1;
    width: 100%;
    min-width: 0; /* Prevent flex child from pushing width */
  }
</style>
