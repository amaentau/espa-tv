<script>
  import { deviceState, sendCommand, setActiveDevice } from '../lib/deviceState.svelte.js';

  let commandLoading = $state(false);
  let statusMsg = $state('');

  async function handleCommand(cmd) {
    commandLoading = true;
    try {
      const res = await sendCommand(cmd);
      if (res.mode === 'direct') {
        statusMsg = '✅ Suoritettu';
      } else {
        statusMsg = '📨 Jonossa';
      }
      setTimeout(() => statusMsg = '', 3000);
    } catch (e) {
      statusMsg = '❌ Virhe';
    } finally {
      commandLoading = false;
    }
  }

  function closeLocalPlayer() {
    deviceState.currentMedia = null;
  }
</script>

<div class="global-control-bar {deviceState.currentMedia ? 'active' : ''} {deviceState.isPiActive ? 'pi-online' : ''}">
  <div class="bar-content">
    {#if deviceState.currentMedia}
      <div class="media-info">
        <div class="title-row">
          <span class="now-playing-label">Nyt {deviceState.playbackLocation === 'remote' ? 'toistetaan soittimella' : 'soi'}:</span>
          <span class="media-title">{deviceState.currentMedia.title}</span>
        </div>
        
        <div class="player-wrapper">
          {#if deviceState.playbackLocation === 'local'}
            {#if deviceState.currentMedia.url.toLowerCase().endsWith('.webm')}
              <video 
                src={deviceState.currentMedia.url} 
                controls 
                autoplay
                crossorigin="anonymous"
                class="local-audio"
                onplay={() => console.log('Playback started')}
                onerror={(e) => console.error('Playback error:', e)}
              >
                <track kind="captions" />
              </video>
            {:else if deviceState.currentMedia.type === 'SONG'}
              <audio 
                src={deviceState.currentMedia.url} 
                controls 
                autoplay
                crossorigin="anonymous"
                class="local-audio"
                onplay={() => console.log('Playback started')}
                onerror={(e) => console.error('Playback error:', e)}
              ></audio>
            {/if}
          {/if}
        </div>
      </div>
    {/if}

    <div class="device-status-section">
      {#if deviceState.devices.length > 0}
        <div class="device-selector-wrapper">
          <span class="status-dot {deviceState.activeDevice?.iotStatus === 'Connected' ? 'online' : 'offline'}"></span>
          <select 
            value={deviceState.activeDeviceId} 
            onchange={(e) => setActiveDevice(e.target.value)}
            class="device-select"
          >
            {#each deviceState.devices as dev}
              <option value={dev.id}>
                {dev.friendlyName || dev.id} ({dev.iotStatus === 'Connected' ? 'Linjoilla' : 'Offline'})
              </option>
            {/each}
          </select>
        </div>
      {/if}

      {#if deviceState.isPiActive && deviceState.currentMedia}
        <div class="remote-controls">
          <button onclick={() => handleCommand('play')} disabled={commandLoading} title="Toista">▶️</button>
          <button onclick={() => handleCommand('pause')} disabled={commandLoading} title="Tauko">⏸️</button>
          <button onclick={() => handleCommand('fullscreen')} disabled={commandLoading} title="Koko näyttö">📺</button>
        </div>
      {/if}

      {#if deviceState.currentMedia}
        <button class="close-bar" onclick={closeLocalPlayer} title="Sulje soitin">✕</button>
      {/if}
    </div>
  </div>
  
  {#if statusMsg}
    <div class="mini-status">{statusMsg}</div>
  {/if}
</div>

<style>
  .global-control-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid var(--border-color);
    box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
    z-index: 1000;
    padding: 8px 16px;
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }

  .global-control-bar.active, .global-control-bar:has(.device-select) {
    transform: translateY(0);
  }

  .bar-content {
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  @media (max-width: 440px) {
    .bar-content {
      gap: 6px;
    }
    
    .device-select {
      max-width: 70px;
    }

    .now-playing-label {
      display: none;
    }

    .media-title {
      font-size: 11px;
    }

    .device-selector-wrapper {
      padding: 4px 6px;
    }
  }

  @media (max-width: 360px) {
    .device-status-section {
      gap: 4px;
    }
    
    .remote-controls button {
      padding: 4px 5px;
      font-size: 11px;
    }

    .bar-content {
      gap: 4px;
    }
  }

  .media-info {
    flex: 1;
    min-width: 0;
  }

  .title-row {
    display: flex;
    flex-direction: column;
    margin-bottom: 4px;
  }

  .now-playing-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-sub);
    font-weight: bold;
  }

  .media-title {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .local-audio {
    height: 30px;
    width: 100%;
  }

  .device-status-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .device-selector-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f5f5f5;
    padding: 4px 8px;
    border-radius: 20px;
    border: 1px solid var(--border-color);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.online { background-color: #28a745; box-shadow: 0 0 4px #28a745; }
  .status-dot.offline { background-color: #dc3545; }

  .device-select {
    border: none;
    background: transparent;
    font-size: 11px;
    font-weight: 600;
    outline: none;
    padding-right: 4px;
    max-width: 100px;
  }

  .remote-controls {
    display: flex;
    gap: 4px;
  }

  .remote-controls button {
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 14px;
  }

  .remote-controls button:hover {
    background: #eee;
  }

  .close-bar {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    color: var(--text-sub);
  }

  .mini-status {
    position: absolute;
    top: -24px;
    right: 16px;
    background: var(--primary-color);
    color: white;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
  }
</style>

