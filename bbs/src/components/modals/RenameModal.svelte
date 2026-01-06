<script>
  let { token, device, onClose, onSuccess } = $props();

  let friendlyName = $state(device.friendlyName || '');
  let status = $state({ msg: '', type: '' });
  let loading = $state(false);

  async function handleRename() {
    if (!friendlyName) return;
    loading = true;
    status = { msg: 'Tallennetaan...', type: 'info' };

    try {
      const res = await fetch(`/devices/${encodeURIComponent(device.id)}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ friendlyName })
      });
      
      if (!res.ok) throw new Error();

      status = { msg: 'Nimi päivitetty!', type: 'success' };
      onSuccess();
      setTimeout(onClose, 1000);
    } catch (err) {
      status = { msg: 'Virhe tallennuksessa', type: 'error' };
    } finally {
      loading = false;
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose}>
  <div class="card" onclick={(e) => e.stopPropagation()} style="width:90%; max-width:400px;">
    <h2 style="margin-top:0; color:var(--primary-color);">Nimeä laite</h2>
    <p style="font-size:13px; color:var(--text-sub);">Anna laitteelle tunnistettava nimi.</p>
    
    <div class="form-group">
      <label for="renameFriendlyName">Laitteen nimi</label>
      <input id="renameFriendlyName" type="text" bind:value={friendlyName} placeholder="esim. Makuuhuone">
    </div>

    {#if status.msg}
      <div class="status-msg {status.type}">{status.msg}</div>
    {/if}
    
    <div style="display:flex; gap:12px; margin-top:20px;">
      <button onclick={onClose} style="background-color:var(--text-sub);">Peruuta</button>
      <button onclick={handleRename} disabled={loading}>Tallenna</button>
    </div>
  </div>
</div>

