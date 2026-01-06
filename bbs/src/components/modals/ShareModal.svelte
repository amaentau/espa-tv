<script>
  import { onMount } from 'svelte';

  let { token, device, onClose, onSuccess } = $props();

  let shares = $state([]);
  let shareEmailInput = $state('');
  let status = $state({ msg: '', type: '' });
  let loading = $state(false);

  async function loadShares() {
    try {
      const res = await fetch(`/devices/${encodeURIComponent(device.id)}/shares`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      shares = await res.json();
    } catch (err) {
      console.error('Failed to load shares');
    }
  }

  onMount(loadShares);

  async function handleShare() {
    if (!shareEmailInput) return;
    loading = true;
    status = { msg: 'Lisätään...', type: 'info' };

    try {
      const res = await fetch(`/devices/${encodeURIComponent(device.id)}/share`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: shareEmailInput })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Virhe');

      status = { msg: 'Käyttäjä lisätty!', type: 'success' };
      shareEmailInput = '';
      loadShares();
    } catch (err) {
      status = { msg: err.message, type: 'error' };
    } finally {
      loading = false;
    }
  }

  async function removeShare(email) {
    if (!confirm(`Poistetaanko käyttäjän ${email} käyttöoikeus?`)) return;

    try {
      const res = await fetch(`/devices/${encodeURIComponent(device.id)}/share/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      loadShares();
    } catch (err) {
      alert('Poisto epäonnistui');
    }
  }

  async function releaseDevice() {
    if (!confirm(`HALUATKO VARMASTI VAPAUTTAA LAITTEEN?\n\nTämä poistaa laitteen "${device.friendlyName || device.id}" tililtäsi ja kaikilta muilta käyttäjiltä.`)) return;

    try {
      const res = await fetch(`/devices/${encodeURIComponent(device.id)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      onSuccess();
      onClose();
    } catch (err) {
      alert('Laitteen vapauttaminen epäonnistui');
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose}>
  <div class="card" onclick={(e) => e.stopPropagation()} style="width:90%; max-width:400px;">
    <h2 style="margin-top:0; color:var(--primary-color);">Jaa laite</h2>
    <p style="font-size:13px; color:var(--text-sub);">Anna muille käyttäjille oikeus lisätä videoita laitteelle <strong>{device.friendlyName || device.id}</strong>.</p>
    
    <div class="form-group" style="display:flex; gap:8px;">
      <input type="email" bind:value={shareEmailInput} placeholder="nimi@espa.fi" style="flex:1;">
      <button onclick={handleShare} disabled={loading} style="width:auto; margin-top:0; padding:8px 16px;">Lisää</button>
    </div>

    {#if status.msg}
      <div class="status-msg {status.type}">{status.msg}</div>
    {/if}

    <h3 style="font-size:14px; margin-bottom:8px; margin-top:16px;">Käyttöoikeudet:</h3>
    <ul style="list-style:none; padding:0; margin:0; max-height:200px; overflow-y:auto; border:1px solid var(--border-color); border-radius:4px;">
      {#each shares as share}
        <li style="padding:8px 12px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; font-size:14px;">
          <span>
            {share.email} 
            <small style="color:var(--text-sub); font-size:11px;">({share.role === 'master' ? 'Omistaja' : 'Käyttäjä'})</small>
          </span>
          {#if share.role !== 'master'}
            <button onclick={() => removeShare(share.email)} style="width:auto; margin:0; padding:4px 8px; background-color:#d13438; font-size:12px;">Poista</button>
          {/if}
        </li>
      {:else}
        <li style="padding:12px; font-size:13px; color:var(--text-sub);">Ei jaettuja käyttöoikeuksia.</li>
      {/each}
    </ul>
    
    <div style="margin-top:20px; display:flex; flex-direction:column; gap:8px;">
      <button onclick={onClose} style="background-color:var(--text-sub);">Sulje</button>
      <button onclick={releaseDevice} style="background-color:#d13438; font-size:13px; margin-top:12px;">⚠️ Vapauta laite (Poista kaikki oikeudet)</button>
    </div>
  </div>
</div>

