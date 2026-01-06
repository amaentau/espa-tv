<script>
  import { onMount } from 'svelte';
  import Header from './Header.svelte';
  import DeviceSelector from './DeviceSelector.svelte';
  import EntryForm from './EntryForm.svelte';
  import IotControls from './IotControls.svelte';
  import History from './History.svelte';
  import AdminModal from './modals/AdminModal.svelte';

  let { authState, onLogout } = $props();
  
  let devices = $state([]);
  let selectedDeviceId = $state('');
  let targetDeviceIds = $state([]);
  let metadata = $state({ gameGroups: [], eventTypes: [] });
  let showAdminModal = $state(false);
  let historyRefreshTrigger = $state(0);

  async function loadMetadata() {
    try {
      const res = await fetch('/config/metadata');
      metadata = await res.json();
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  }

  async function loadDevices() {
    try {
      const res = await fetch('/devices', {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });
      if (res.status === 401 || res.status === 403) { onLogout(); return; }
      devices = await res.json();
      if (devices.length > 0 && !selectedDeviceId) {
        selectedDeviceId = devices[0].id;
        targetDeviceIds = [selectedDeviceId];
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  }

  onMount(() => {
    loadMetadata();
    loadDevices();
  });

  $effect(() => {
    if (selectedDeviceId) {
      // Logic when selected device changes
    }
  });

  const refreshHistory = () => historyRefreshTrigger++;
</script>

<div class="container fade-in">
  <Header email={authState.userEmail} {onLogout} />

  {#if authState.isAdmin}
    <div style="text-align:center; margin-bottom:16px;">
      <button onclick={() => showAdminModal = true} style="width:auto; padding:8px 16px; font-size:14px; background-color:#605e5c;">
        🔧 Järjestelmän asetukset
      </button>
    </div>
  {/if}

  <div class="card">
    <DeviceSelector 
      {devices} 
      bind:selectedDeviceId 
      bind:targetDeviceIds 
      token={authState.token}
      onDevicesChanged={loadDevices}
    />

    <EntryForm 
      {metadata} 
      {targetDeviceIds} 
      token={authState.token} 
      onEntryAdded={refreshHistory}
    />
  </div>

  <IotControls 
    deviceId={selectedDeviceId} 
    token={authState.token} 
  />

  <History 
    deviceId={selectedDeviceId} 
    token={authState.token} 
    isAdmin={authState.isAdmin}
    userGroup={authState.userGroup}
    refreshTrigger={historyRefreshTrigger}
  />
</div>

{#if showAdminModal}
  <AdminModal 
    token={authState.token} 
    userEmail={authState.userEmail}
    onClose={() => showAdminModal = false} 
    onMetadataChanged={loadMetadata}
  />
{/if}

