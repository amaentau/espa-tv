<script>
  let { deviceId, token } = $props();

  let iotStatus = $state({ connectionState: '', loading: true, error: false, notRegistered: false, mock: false });
  let statusMsg = $state({ msg: '', type: '' });
  let commandLoading = $state(false);

  async function loadIotStatus() {
    if (!deviceId) return;
    iotStatus.loading = true;
    iotStatus.error = false;
    iotStatus.notRegistered = false;

    try {
      const res = await fetch(`/devices/${encodeURIComponent(deviceId)}/iot-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 404) {
        iotStatus.notRegistered = true;
        return;
      }
      if (!res.ok) throw new Error();

      const data = await res.json();
      iotStatus.connectionState = data.connectionState;
      iotStatus.mock = data.mock;
    } catch (err) {
      iotStatus.error = true;
    } finally {
      iotStatus.loading = false;
    }
  }

  $effect(() => {
    if (deviceId) loadIotStatus();
  });

  async function sendCommand(command, payload = {}) {
    commandLoading = true;
    statusMsg = { msg: 'Suoritetaan laitteella...', type: 'info' };

    try {
      const res = await fetch(`/devices/${encodeURIComponent(deviceId)}/commands/${command}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Virhe');

      if (data.mode === 'direct') {
        statusMsg = { msg: `✅ Suoritettu välittömästi (Status: ${data.methodStatus})`, type: 'success' };
      } else {
        statusMsg = { msg: `📨 Komento jonossa (Laite offline tai hidas)`, type: 'info' };
      }
      setTimeout(() => { if (statusMsg.type === 'success') statusMsg.msg = ''; }, 4000);
    } catch (err) {
      statusMsg = { msg: `❌ Virhe: ${err.message}`, type: 'error' };
    } finally {
      commandLoading = false;
    }
  }

  async function registerIot() {
    statusMsg = { msg: 'Rekisteröidään laitetta IoT Hubiin...', type: 'info' };
    try {
      const res = await fetch(`/devices/${encodeURIComponent(deviceId)}/register-iot`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Virhe');
      statusMsg = { msg: 'Laite rekisteröity onnistuneesti!', type: 'success' };
      loadIotStatus();
    } catch (err) {
      statusMsg = { msg: err.message, type: 'error' };
    }
  }
</script>

<div class="card">
  <h3 style="margin-top:0; color:var(--primary-color); display:flex; justify-content:space-between; align-items:center;">
    IoT Ohjaimet
    <span style="font-size:12px; padding:2px 8px; border-radius:10px; background:{iotStatus.loading ? '#eee' : (iotStatus.connectionState === 'Connected' ? '#d4edda' : '#f8d7da')}; color:{iotStatus.loading ? '#666' : (iotStatus.connectionState === 'Connected' ? '#155724' : '#721c24')}; font-weight:normal;">
      {#if iotStatus.loading}Ladataan...{:else if iotStatus.notRegistered}Ei rekisteröity{:else}{iotStatus.connectionState}{iotStatus.mock ? ' (MOCK)' : ''}{/if}
    </span>
  </h3>

  {#if iotStatus.notRegistered}
    <div style="text-align:center; padding:10px 0;">
      <p style="font-size:14px; color:var(--text-sub); margin-bottom:12px;">Laitetta ei ole rekisteröity IoT Hubiin.</p>
      <button onclick={registerIot} style="width:auto; padding:8px 16px;">Aktivoi IoT-ohjaus</button>
    </div>
  {:else if !iotStatus.loading && !iotStatus.error}
    <div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
        <button onclick={() => sendCommand('play')} disabled={commandLoading} style="background-color:var(--primary-color); padding: 10px 5px;">▶️ Toista</button>
        <button onclick={() => sendCommand('pause')} disabled={commandLoading} style="background-color:var(--text-sub); padding: 10px 5px;">⏸️ Tauko</button>
        <button onclick={() => sendCommand('fullscreen')} disabled={commandLoading} style="background-color:var(--text-sub); padding: 10px 5px;">📺 Koko näyttö</button>
        <button onclick={() => { if(confirm('Haluatko varmasti käynnistää laitteen uudelleen?')) sendCommand('restart'); }} disabled={commandLoading} style="background-color:#d13438; padding: 10px 5px;">🔄 Restart Pi</button>
      </div>
      <button class="link-btn" onclick={loadIotStatus} style="text-align:left; padding:4px 0; margin:0;">Päivitä laitteen tila</button>
    </div>
  {/if}

  {#if statusMsg.msg}
    <div class="status-msg {statusMsg.type}" style="font-size:12px; margin-top:8px;">{statusMsg.msg}</div>
  {/if}
</div>

