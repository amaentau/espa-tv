<script>
  import { deviceState, refreshDevices } from '../lib/deviceState.svelte.js';
  import ClaimModal from './modals/ClaimModal.svelte';
  import ShareModal from './modals/ShareModal.svelte';
  import RenameModal from './modals/RenameModal.svelte';

  let { authState, onOpenAdmin } = $props();

  let showClaim = $state(false);
  let showShare = $state(false);
  let showRename = $state(false);
  let selectedDeviceForAction = $state(null);

  const hasDevices = $derived(deviceState.devices.length > 0);

  function openRename(dev) {
    selectedDeviceForAction = dev;
    showRename = true;
  }

  function openShare(dev) {
    selectedDeviceForAction = dev;
    showShare = true;
  }

  async function removeAccess(dev) {
    const isMaster = dev.role === 'master';
    const msg = isMaster 
      ? `Haluatko varmasti poistaa laitteen "${dev.friendlyName}"? Tämä poistaa pääsyn kaikilta käyttäjiltä.`
      : `Haluatko varmasti poistaa pääsysi laitteeseen "${dev.friendlyName}"?`;
    
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/devices/${encodeURIComponent(dev.id)}${!isMaster ? `/share/${encodeURIComponent(authState.userEmail)}` : ''}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });
      if (!res.ok) throw new Error();
      refreshDevices();
    } catch (err) {
      alert('Poisto epäonnistui');
    }
  }
</script>

<div class="settings-view fade-in">
  <div class="card profile-card">
    <div class="avatar-circle">
      {authState.userEmail.charAt(0).toUpperCase()}
    </div>
    <div class="user-details">
      <h3>{authState.userEmail}</h3>
      <span class="role-badge">{authState.isAdmin ? 'Super Admin' : (authState.userGroup || 'Käyttäjä')}</span>
    </div>
  </div>

  <div class="settings-list">
    {#if hasDevices}
      <div class="card">
        <h4 style="margin-top: 0;">Laitteiden hallinta</h4>
        <div class="device-manage-list">
          {#each deviceState.devices as dev}
            <div class="device-manage-item">
              <div class="device-info">
                <strong>{dev.friendlyName || dev.id}</strong>
                <span class="device-role">{dev.role === 'master' ? 'Omistaja' : 'Käyttäjä'}</span>
              </div>
              <div class="device-actions">
                {#if dev.role === 'master'}
                  <button class="icon-btn" onclick={() => openRename(dev)} title="Nimeä uudelleen">✏️</button>
                  <button class="icon-btn" onclick={() => openShare(dev)} title="Jaa käyttöoikeus">👥</button>
                {/if}
                <button class="icon-btn danger" onclick={() => removeAccess(dev)} title={dev.role === 'master' ? 'Poista laite' : 'Poista pääsy'}>✕</button>
              </div>
            </div>
          {/each}
        </div>
        <button class="add-device-btn" onclick={() => showClaim = true}>
          ➕ Lisää uusi laite
        </button>
      </div>
    {:else}
       <div class="card">
         <h4 style="margin-top: 0;">Laitteet</h4>
         <p style="font-size: 14px; color: var(--text-sub);">Sinulla ei ole vielä yhdistettyjä laitteita.</p>
         <button class="add-device-btn" onclick={() => showClaim = true}>
           ➕ Lisää ensimmäinen laite
         </button>
       </div>
    {/if}

    <div class="card">
      <h4 style="margin-top: 0;">Sovelluksen asetukset</h4>
      <div class="setting-item">
        <span>Kieli</span>
        <strong>Suomi</strong>
      </div>
      <div class="setting-item">
        <span>Teema</span>
        <strong>Vaalea</strong>
      </div>
    </div>

    {#if authState.isAdmin}
      <div class="card admin-section">
        <h4 style="margin-top: 0; color: #d13438;">Ylläpito</h4>
        <button class="admin-btn" onclick={onOpenAdmin}>
          🔧 Avaa Järjestelmän Hallinta
        </button>
      </div>
    {/if}
  </div>
</div>

{#if showClaim}
  <ClaimModal token={authState.token} onClose={() => showClaim = false} onSuccess={refreshDevices} />
{/if}
{#if showRename && selectedDeviceForAction}
  <RenameModal token={authState.token} device={selectedDeviceForAction} onClose={() => showRename = false} onSuccess={refreshDevices} />
{/if}
{#if showShare && selectedDeviceForAction}
  <ShareModal token={authState.token} device={selectedDeviceForAction} onClose={() => showShare = false} onSuccess={refreshDevices} />
{/if}

<style>
  .settings-view {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    padding-bottom: 40px;
  }

  .profile-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 30px 24px;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
    color: white;
  }

  .avatar-circle {
    width: 60px;
    height: 60px;
    background: white;
    color: var(--primary-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 800;
  }

  .user-details {
    min-width: 0;
    flex: 1;
  }

  .user-details h3 {
    margin: 0;
    font-size: 18px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-badge {
    font-size: 12px;
    background: rgba(255,255,255,0.2);
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .device-manage-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .device-manage-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }

  .device-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .device-info strong {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-role {
    font-size: 11px;
    color: var(--text-sub);
  }

  .device-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    background: white;
    border: 1px solid var(--border-color);
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    font-size: 16px;
    margin-top: 0;
    color: var(--text-main);
    box-shadow: none;
  }

  .icon-btn:hover {
    background: #f0f0f0;
    transform: none;
    box-shadow: none;
  }

  .icon-btn.danger:hover {
    background: #fff5f5;
    color: #d13438;
    border-color: #fad7d7;
  }

  .add-device-btn {
    background: white;
    color: var(--primary-color);
    border: 1.5px dashed var(--primary-color);
    box-shadow: none;
    font-size: 14px;
    padding: 12px;
  }

  .add-device-btn:hover {
    background: rgba(21, 112, 57, 0.05);
    transform: none;
    box-shadow: none;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color);
    font-size: 14px;
  }

  .setting-item:last-child {
    border-bottom: none;
  }

  .admin-btn {
    width: 100%;
    background: #fdf2f2;
    color: #d13438;
    border: 1px solid #fad7d7;
    padding: 12px;
    font-weight: 600;
    margin-top: 8px;
    box-shadow: none;
  }
  
  .admin-btn:hover {
    background: #fbeaea;
    transform: none;
  }
</style>

