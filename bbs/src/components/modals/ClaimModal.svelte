<script>
  let { token, onClose, onSuccess } = $props();

  let deviceId = $state('');
  let friendlyName = $state('');
  let status = $state({ msg: '', type: '' });
  let loading = $state(false);

  async function handleClaim() {
    if (!deviceId) return status = { msg: 'Syötä laitteen ID', type: 'error' };
    loading = true;
    status = { msg: 'Tallennetaan...', type: 'info' };

    try {
      const res = await fetch('/devices/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ deviceId, friendlyName })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Virhe tallennuksessa');

      status = { msg: 'Laite lisätty!', type: 'success' };
      onSuccess();
      setTimeout(onClose, 1000);
    } catch (err) {
      status = { msg: err.message, type: 'error' };
    } finally {
      loading = false;
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose}>
  <div class="card" onclick={(e) => e.stopPropagation()} style="width:90%; max-width:400px;">
    <h2 style="margin-top:0; color:var(--primary-color);">Lisää laite</h2>
    <p style="font-size:13px; color:var(--text-sub);">Yhdistä uusi ESPA TV -soitin tiliisi.</p>
    
    <div class="form-group">
      <label for="claimDeviceId">Laitteen tunnus</label>
      <input id="claimDeviceId" type="text" bind:value={deviceId} placeholder="esim. rpi-1234">
    </div>
    <div class="form-group">
      <label for="claimFriendlyName">Laitteen nimi</label>
      <input id="claimFriendlyName" type="text" bind:value={friendlyName} placeholder="esim. Makuuhuone">
    </div>

    {#if status.msg}
      <div class="status-msg {status.type}">{status.msg}</div>
    {/if}
    
    <div style="display:flex; gap:12px; margin-top:20px;">
      <button onclick={onClose} style="background-color:var(--text-sub);">Peruuta</button>
      <button onclick={handleClaim} disabled={loading}>Lisää</button>
    </div>
  </div>
</div>

