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
</script>

<div class="modal-backdrop" onclick={onClose}>
  <div class="card" onclick={(e) => e.stopPropagation()} style="width:95%; max-width:600px; max-height:90vh; overflow-y:auto;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h2 style="margin:0; color:var(--primary-color);">Järjestelmän hallinta</h2>
      <button onclick={onClose} style="width:auto; margin:0; padding:4px 12px; background-color:var(--text-sub);">X</button>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
      <button class="tab-btn {activeTab === 'coords' ? 'active' : ''}" onclick={() => activeTab = 'coords'}>Koordinaatit</button>
      <button class="tab-btn {activeTab === 'metadata' ? 'active' : ''}" onclick={() => activeTab = 'metadata'}>Metadata</button>
      <button class="tab-btn {activeTab === 'users' ? 'active' : ''}" onclick={() => activeTab = 'users'}>Käyttäjät</button>
    </div>
    
    {#if activeTab === 'coords'}
      <div>
        <p style="font-size:13px; color:var(--text-sub);">Muokkaa Veo-soittimen klikkauskohtia eri resoluutioille.</p>
        <div>
          {#each Object.entries(coordsConfig) as [res, coords]}
            <div style="border-bottom:1px solid #eee; padding-bottom:12px; margin-bottom:12px;">
              <h3 style="margin-bottom:8px;">{res}p</h3>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
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
        <h3 style="font-size:16px; margin-bottom:10px;">Peliryhmät ja Tapahtumatyypit</h3>
        <div style="margin-bottom:20px;">
          <label>Peliryhmät (pilkulla erotettuna)</label>
          <textarea bind:value={adminGameGroups} style="width:100%; height:60px; padding:8px; border-radius:4px; border:1px solid var(--border-color);"></textarea>
        </div>
        <div style="margin-bottom:20px;">
          <label>Tapahtumatyypit (pilkulla erotettuna)</label>
          <textarea bind:value={adminEventTypes} style="width:100%; height:60px; padding:8px; border-radius:4px; border:1px solid var(--border-color);"></textarea>
        </div>
        <button onclick={saveMetadata}>Tallenna metadata</button>
      </div>
    {:else if activeTab === 'users'}
      <div>
        <h3 style="font-size:16px; margin-bottom:10px;">Käyttäjähallinta</h3>
        <div style="max-height:300px; overflow-y:auto; border:1px solid var(--border-color); border-radius:4px;">
          {#each usersList as u}
            <div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:13px;">
                <strong>{u.email}</strong><br>
                <span style="font-size:11px; color:#666;">{u.isAdmin ? 'Super Admin' : (u.userGroup || 'Ei ryhmää')}</span>
              </div>
              <div style="display:flex; gap:5px;">
                <select 
                  onchange={(e) => updateUserRole(u, e.target.value)}
                  style="font-size:12px; padding:2px;" 
                  disabled={u.email === userEmail}
                >
                  <option value="" selected={!u.userGroup && !u.isAdmin}>Ei ryhmää</option>
                  <option value="Veo Ylläpitäjä" selected={u.userGroup === 'Veo Ylläpitäjä'}>Veo Ylläpitäjä</option>
                  <option value="ADMIN" selected={u.isAdmin}>Super Admin</option>
                </select>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if status.msg}
      <div class="status-msg {status.type}">{status.msg}</div>
    {/if}
  </div>
</div>

