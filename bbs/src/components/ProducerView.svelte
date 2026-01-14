<script>
  import { deviceState } from '../lib/deviceState.svelte.js';
  import EntryForm from './EntryForm.svelte';
  import History from './History.svelte';

  let { authState, metadata, historyRefreshTrigger, refreshHistory } = $props();

  let selectedContentType = $state('veo');
</script>

<div class="producer-view fade-in">
  <div class="card">
    <EntryForm 
      {metadata} 
      token={authState.token} 
      {authState}
      onEntryAdded={refreshHistory}
      bind:contentType={selectedContentType}
    />
  </div>

  <History 
    deviceId={deviceState.activeDeviceId} 
    token={authState.token} 
    isAdmin={authState.isAdmin}
    userGroup={authState.userGroup}
    username={authState.username}
    refreshTrigger={historyRefreshTrigger}
    filterType={selectedContentType}
  />
</div>

<style>
  .producer-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
  }
</style>

