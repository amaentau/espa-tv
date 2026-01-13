<script>
  import { onMount } from 'svelte';

  let { token, userEmail, onClose, onMetadataChanged } = $props();

  let activeTab = $state('coords'); // coords, metadata, users
  let status = $state({ msg: '', type: '' });
  let loading = $state(false);

  // Coords Tab State
  let coordsConfig = $state({});
  
  // Metadata Tab State
  let adminGameGroups = $state('');
  let adminEventTypes = $state('');

  // Users Tab State
  let usersList = $state([]);

  async function loadCoords() {
    try {
      const res = await fetch('/config/coordinates');
      coordsConfig = await res.json();
    } catch (err) {
      status = { msg: 'Virhe asetusten latauksessa', type: 'error' };
    }
  }

  async function loadMetadata() {
    try {
      const res = await fetch('/config/metadata');
      const data = await res.json();
      adminGameGroups = data.gameGroups.join(', ');
      adminEventTypes = data.eventTypes.join(', ');
    } catch (err) {
      console.error(err);
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch('/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      usersList = await res.json();
    } catch (err) {
      console.error(err);
    }
  }

  onMount(() => {
    loadCoords();
  });

  $effect(() => {
    if (activeTab === 'metadata') loadMetadata();
    if (activeTab === 'users') loadUsers();
  });

  async function saveCoords() {
    loading = true;
    status = { msg: 'Tallennetaan...', type: 'info' };
    try {
      const res = await fetch('/config/coordinates', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(coordsConfig)
      });
      if (!res.ok) throw new Error();
      status = { msg: 'Tallennettu onnistuneesti!', type: 'success' };
      setTimeout(onClose, 1000);
    } catch (err) {
      status = { msg: 'Virhe tallennuksessa', type: 'error' };
    } finally {
      loading = false;
    }
  }

  async function saveMetadata() {
    const gameGroups = adminGameGroups.split(',').map(s => s.trim()).filter(Boolean);
    const eventTypes = adminEventTypes.split(',').map(s => s.trim()).filter(Boolean);

    status = { msg: 'Tallennetaan...', type: 'info' };
    try {
      const res = await fetch('/config/metadata', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ gameGroups, eventTypes })
      });
      if (!res.ok) throw new Error();
      status = { msg: 'Metadata tallennettu!', type: 'success' };
      onMetadataChanged();
    } catch (err) {
      status = { msg: 'Virhe tallennuksessa', type: 'error' };
    }
  }

  async function updateUserRole(user, val) {
    const isAdmin = val === 'ADMIN';
    const userGroup = isAdmin ? 'Ylläpitäjä' : (val || null);
    
    try {
      const res = await fetch(`/auth/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userGroup, isAdmin })
      });
      if (!res.ok) throw new Error();
      loadUsers();
    } catch (err) {
      alert('Päivitys epäonnistui');
    }
  }

  async function toggleApproval(user) {
    try {
      const res = await fetch(`/auth/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isApproved: !user.isApproved })
      });
      if (!res.ok) throw new Error();
      loadUsers();
    } catch (err) {
      alert('Tilan päivitys epäonnistui');
    }
  }

  async function resetDevices(user) {
    if (!confirm(`Haluatko varmasti nollata käyttäjän ${user.email} laitelistauksen?`)) return;
    try {
      const res = await fetch(`/auth/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resetDevices: true })
      });
      if (!res.ok) throw new Error();
      alert('Laitteet nollattu');
      loadUsers();
    } catch (err) {
      alert('Nollaus epäonnistui');
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose}>
  <div class="card modal-content" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2 style="margin:0; color:var(--primary-color);">Hallinta</h2>
      <button onclick={onClose} class="close-btn">X</button>
    </div>

    <div class="tabs-container">
      <button class="tab-btn {activeTab === 'coords' ? 'active' : ''}" onclick={() => activeTab = 'coords'}>Koordinaatit</button>
      <button class="tab-btn {activeTab === 'metadata' ? 'active' : ''}" onclick={() => activeTab = 'metadata'}>Metadata</button>
      <button class="tab-btn {activeTab === 'users' ? 'active' : ''}" onclick={() => activeTab = 'users'}>Käyttäjät</button>
    </div>
    
    <div class="modal-body">
      {#if activeTab === 'coords'}
        <div>
          <p class="tab-desc">Veo-soittimen klikkauskohdat.</p>
          <div class="coords-list">
            {#each Object.entries(coordsConfig) as [res, coords]}
              <div class="coords-item">
                <h3 class="res-title">{res}p</h3>
                <div class="coords-grid">
                  <label>Play X <input type="number" bind:value={coords.play.x}></label>
                  <label>Play Y <input type="number" bind:value={coords.play.y}></label>
                  <label>Full X <input type="number" bind:value={coords.fullscreen.x}></label>
                  <label>Full Y <input type="number" bind:value={coords.fullscreen.y}></label>
                </div>
              </div>
            {/each}
          </div>
          <button onclick={saveCoords} disabled={loading} style="margin-top:10px;">Tallenna koordinaatit</button>
        </div>
      {:else if activeTab === 'metadata'}
        <div>
          <h3 class="section-title">Peliryhmät ja Tapahtumatyypit</h3>
          <div class="form-group">
            <label>Peliryhmät (pilkulla erotettuna)</label>
            <textarea bind:value={adminGameGroups}></textarea>
          </div>
          <div class="form-group">
            <label>Tapahtumatyypit (pilkulla erotettuna)</label>
            <textarea bind:value={adminEventTypes}></textarea>
          </div>
          <button onclick={saveMetadata}>Tallenna metadata</button>
        </div>
      {:else if activeTab === 'users'}
        <div>
          <h3 class="section-title">Käyttäjähallinta</h3>
          <div class="users-list">
            {#each usersList as u}
              <div class="user-item" class:pending-approval={!u.isApproved}>
                <div class="user-info-text">
                  <strong>{u.username}</strong>
                  <span class="user-email">{u.email}</span>
                  <span class="user-role">
                    {u.isAdmin ? 'Super Admin' : (u.userGroup || 'Ei ryhmää')} 
                    | Laitteet: {u.deviceCount}/3
                  </span>
                </div>
                <div class="user-actions">
                  <div class="action-row">
                    <label class="approve-toggle">
                      <input type="checkbox" checked={u.isApproved} onchange={() => toggleApproval(u)} disabled={u.email === userEmail}>
                      <span>{u.isApproved ? 'Hyväksytty' : 'Odottaa'}</span>
                    </label>
                  </div>
                  <div class="action-row">
                    <select 
                      onchange={(e) => updateUserRole(u, e.target.value)}
                      disabled={u.email === userEmail}
                    >
                      <option value="" selected={!u.userGroup && !u.isAdmin}>Ei ryhmää</option>
                      <option value="Veo Ylläpitäjä" selected={u.userGroup === 'Veo Ylläpitäjä'}>Veo Ylläpitäjä</option>
                      <option value="ADMIN" selected={u.isAdmin}>Super Admin</option>
                    </select>
                    <button class="small-btn warn" onclick={() => resetDevices(u)} title="Nollaa laitteet">Reset</button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    {#if status.msg}
      <div class="status-msg {status.type}">{status.msg}</div>
    {/if}
  </div>
</div>

<style>
  .modal-content {
    width: 95%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-shrink: 0;
  }

  .close-btn {
    width: auto;
    margin: 0;
    padding: 6px 12px;
    background-color: var(--text-sub);
    font-size: 14px;
  }

  .tabs-container {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
    scrollbar-width: none;
    flex-shrink: 0;
  }
  .tabs-container::-webkit-scrollbar { display: none; }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }

  .tab-desc {
    font-size: 13px;
    color: var(--text-sub);
    margin-bottom: 16px;
  }

  .coords-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  @media (max-width: 400px) {
    .coords-grid {
      grid-template-columns: 1fr;
    }
    
    .modal-content {
      padding: 15px;
    }
  }

  .coords-item {
    border-bottom: 1px solid #eee;
    padding-bottom: 12px;
    margin-bottom: 12px;
  }

  .res-title {
    margin-bottom: 8px;
    font-size: 16px;
  }

  .section-title {
    font-size: 16px;
    margin-bottom: 10px;
  }

  .users-list {
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  .user-item {
    padding: 12px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .user-item.pending-approval {
    background-color: #fff9e6;
  }

  .user-info-text {
    font-size: 13px;
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  
  .user-info-text strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
  }

  .user-email {
    color: var(--text-sub);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-role {
    font-size: 11px;
    color: #666;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    flex-shrink: 0;
  }

  @media (max-width: 480px) {
    .user-item {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
    
    .user-actions {
      align-items: stretch;
    }

    .action-row {
      justify-content: space-between;
    }

    .user-actions select {
      flex: 1;
      min-width: 0;
    }
  }

  .action-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .approve-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    cursor: pointer;
  }

  .user-actions select {
    font-size: 12px;
    padding: 4px;
  }

  .small-btn {
    padding: 4px 8px;
    font-size: 10px;
    width: auto;
    margin: 0;
  }

  .small-btn.warn {
    background-color: #f44336;
    color: white;
  }

  textarea {
    width: 100%;
    height: 80px;
  }
</style>

