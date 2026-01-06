<script>
  import ClaimModal from './modals/ClaimModal.svelte';
  import ShareModal from './modals/ShareModal.svelte';
  import RenameModal from './modals/RenameModal.svelte';

  let { devices, selectedDeviceId = $bindable(), targetDeviceIds = $bindable(), token, onDevicesChanged } = $props();

  let showClaim = $state(false);
  let showShare = $state(false);
  let showRename = $state(false);

  const currentDevice = $derived(devices.find(d => d.id === selectedDeviceId));
  const isMaster = $derived(currentDevice?.role === 'master');

  function toggleAll() {
    if (targetDeviceIds.length === devices.length) {
      targetDeviceIds = [];
    } else {
      targetDeviceIds = devices.map(d => d.id);
    }
  }

  // Ensure selectedDeviceId is always checked in targetDeviceIds
  $effect(() => {
    if (selectedDeviceId && !targetDeviceIds.includes(selectedDeviceId)) {
      targetDeviceIds = [...targetDeviceIds, selectedDeviceId];
    }
  });
</script>

<div class="form-group">
  <label for="deviceSelect">Valitse laite</label>
  <div style="display:flex; gap:8px;">
    <select id="deviceSelect" bind:value={selectedDeviceId}>
      {#if devices.length === 0}
        <option value="">Ladataan laitteita...</option>
      {:else}
        {#each devices as dev}
          <option value={dev.id}>{dev.friendlyName || dev.id}</option>
        {/each}
      {/if}
    </select>
    
    {#if isMaster}
      <button onclick={() => showRename = true} title="Nimeä uudelleen" style="width:48px; margin-top:0; padding:0; font-size:18px; display:flex; align-items:center; justify-content:center; background-color:var(--text-sub);">✏️</button>
      <button onclick={() => showShare = true} title="Jaa käyttöoikeus" style="width:48px; margin-top:0; padding:0; font-size:20px; display:flex; align-items:center; justify-content:center; background-color:var(--text-sub);">👥</button>
    {/if}
    <button onclick={() => showClaim = true} title="Lisää uusi laite" style="width:48px; margin-top:0; padding:0; font-size:24px; display:flex; align-items:center; justify-content:center;">+</button>
  </div>
</div>

<div class="form-group">
  <label>Lähetä laitteille:</label>
  <div style="max-height:150px; overflow-y:auto; border:1px solid var(--border-color); border-radius:4px; padding:8px; background-color:#fafafa; display:flex; flex-direction:column; gap:6px;">
    {#each devices as dev}
      <label style="display:flex; align-items:center; gap:8px; font-weight:normal; font-size:14px; cursor:pointer;">
        <input type="checkbox" bind:group={targetDeviceIds} value={dev.id}>
        <span>{dev.friendlyName || dev.id}</span>
      </label>
    {:else}
      <div style="font-size:12px; color:var(--text-sub);">Ei laitteita.</div>
    {/each}
  </div>
  <button class="link-btn" onclick={toggleAll} style="text-align:left; padding:4px 0; margin:0;">
    {targetDeviceIds.length === devices.length && devices.length > 0 ? 'Poista valinnat' : 'Valitse kaikki'}
  </button>
</div>

{#if showClaim}
  <ClaimModal {token} onClose={() => showClaim = false} onSuccess={onDevicesChanged} />
{/if}
{#if showShare && currentDevice}
  <ShareModal {token} device={currentDevice} onClose={() => showShare = false} onSuccess={onDevicesChanged} />
{/if}
{#if showRename && currentDevice}
  <RenameModal {token} device={currentDevice} onClose={() => showRename = false} onSuccess={onDevicesChanged} />
{/if}

