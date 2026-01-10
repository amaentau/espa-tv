<script>
  import { deviceState, sendCommand, refreshDevices } from '../lib/deviceState.svelte.js';
  let { token } = $props();

  let statusMsg = $state({ msg: '', type: '' });
  let commandLoading = $state(false);

  async function handleCommand(command, payload = {}) {
    commandLoading = true;
    statusMsg = { msg: 'Suoritetaan laitteella...', type: 'info' };

    try {
      const data = await sendCommand(command, payload);
      
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
    if (!deviceState.activeDeviceId) return;
    statusMsg = { msg: 'Rekisteröidään laitetta IoT Hubiin...', type: 'info' };
    try {
      const res = await fetch(`/devices/${encodeURIComponent(deviceState.activeDeviceId)}/register-iot`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Virhe');
      statusMsg = { msg: 'Laite rekisteröity onnistuneesti!', type: 'success' };
      refreshDevices();
    } catch (err) {
      statusMsg = { msg: err.message, type: 'error' };
    }
  }
</script>

<div class="card">
  <h3 style="margin-top:0; color:var(--primary-color); display:flex; justify-content:space-between; align-items:center;">
    IoT Ohjaimet
    {#if deviceState.activeDevice}
      <span style="font-size:12px; padding:2px 8px; border-radius:10px; background:{deviceState.activeDevice.iotStatus === 'Connected' ? '#d4edda' : '#f8d7da'}; color:{deviceState.activeDevice.iotStatus === 'Connected' ? '#155724' : '#721c24'}; font-weight:normal;">
        {deviceState.activeDevice.iotStatus}
      </span>
    {/if}
  </h3>

  {#if !deviceState.activeDeviceId}
    <p style="text-align:center; font-size:14px; color:var(--text-sub);">Valitse laite yläpuolelta tai Hallinta-sivulta.</p>
  {:else if deviceState.activeDevice?.iotStatus === 'NotRegistered'}
    <div style="text-align:center; padding:10px 0;">
      <p style="font-size:14px; color:var(--text-sub); margin-bottom:12px;">Laitetta ei ole rekisteröity IoT Hubiin.</p>
      <button onclick={registerIot} style="width:auto; padding:8px 16px;">Aktivoi IoT-ohjaus</button>
    </div>
  {:else}
    <div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
        <button onclick={() => handleCommand('play')} disabled={commandLoading} style="background-color:var(--primary-color); padding: 10px 5px;">▶️ Toista</button>
        <button onclick={() => handleCommand('pause')} disabled={commandLoading} style="background-color:var(--text-sub); padding: 10px 5px;">⏸️ Tauko</button>
        <button onclick={() => handleCommand('fullscreen')} disabled={commandLoading} style="background-color:var(--text-sub); padding: 10px 5px;">📺 Koko näyttö</button>
        <button onclick={() => { if(confirm('Haluatko varmasti käynnistää laitteen uudelleen?')) handleCommand('restart'); }} disabled={commandLoading} style="background-color:#d13438; padding: 10px 5px;">🔄 Restart Pi</button>
      </div>
      <button class="link-btn" onclick={refreshDevices} style="text-align:left; padding:4px 0; margin:0;">Päivitä laitteiden tila</button>
    </div>
  {/if}

  {#if statusMsg.msg}
    <div class="status-msg {statusMsg.type}" style="font-size:12px; margin-top:8px;">{statusMsg.msg}</div>
  {/if}
</div>

