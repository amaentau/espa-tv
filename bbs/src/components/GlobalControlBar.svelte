<script>
  import { onMount } from 'svelte';
  import { deviceState, sendCommand, setPlaybackTarget } from '../lib/deviceState.svelte.js';

  let commandLoading = $state(false);
  let statusMsg = $state('');
  let videoElement = $state(null);

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

  async function handleOrientationChange() {
    if (!videoElement || deviceState.currentMedia?.type !== 'VIDEO') return;
    
    const isLandscape = window.innerWidth > window.innerHeight;
    
    try {
      if (isLandscape) {
        if (!document.fullscreenElement) {
          if (videoElement.requestFullscreen) {
            await videoElement.requestFullscreen();
          } else if (videoElement.webkitRequestFullscreen) {
            await videoElement.webkitRequestFullscreen();
          }
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      // Fullscreen might be blocked by browser if not triggered by user interaction
      // but orientation change sometimes allows it on mobile
      console.warn('Fullscreen transition failed:', err);
    }
  }

  onMount(() => {
    window.addEventListener('resize', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
    };
  });
</script>

<div class="global-control-bar {deviceState.currentMedia ? 'active' : ''} {deviceState.isPiActive ? 'pi-online' : ''} {deviceState.devices.length > 0 ? 'has-devices' : ''}">
  <div class="bar-content">
    {#if deviceState.currentMedia}
      <div class="media-info">
        <div class="title-row">
          <span class="now-playing-label">Nyt {deviceState.playbackTarget !== 'browser' ? 'toistetaan soittimella' : 'toistetaan tässä'}:</span>
          <span class="media-title">{deviceState.currentMedia.title}</span>
        </div>
        
        <div class="player-wrapper">
          {#if deviceState.playbackTarget === 'browser'}
            {#if deviceState.currentMedia.type === 'VIDEO'}
              <video 
                bind:this={videoElement}
                src={deviceState.currentMedia.url} 
                controls 
                autoplay
                crossorigin="anonymous"
                class="local-media"
              >
                <track kind="captions" />
              </video>
            {:else if deviceState.currentMedia.type === 'SONG'}
              <audio 
                src={deviceState.currentMedia.url} 
                controls 
                autoplay
                crossorigin="anonymous"
                class="local-media"
              ></audio>
            {/if}
          {/if}
        </div>
      </div>
    {/if}

    <div class="device-status-section">
      {#if deviceState.devices.length > 0}
        <div class="target-selector">
          <span class="target-label">Toista laitteella:</span>
          <div class="selector-container">
            <span class="status-dot {deviceState.playbackTarget === 'browser' ? 'browser' : (deviceState.activeDevice?.iotStatus === 'Connected' ? 'online' : 'offline')}"></span>
            <select 
              value={deviceState.playbackTarget} 
              onchange={(e) => setPlaybackTarget(e.target.value)}
              class="device-select"
            >
              <option value="browser">Tämä selain (📱/💻)</option>
              <hr />
              {#each deviceState.devices as dev}
                <option value={dev.id}>
                  {dev.friendlyName || dev.id} {dev.iotStatus === 'Connected' ? '(Linjoilla)' : '(Offline)'}
                </option>
              {/each}
            </select>
          </div>
        </div>
      {/if}

      {#if deviceState.playbackTarget !== 'browser' && deviceState.isPiActive && deviceState.currentMedia}
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
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid var(--border-color);
    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
    z-index: 1000;
    padding: 10px 16px;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .global-control-bar.active, .global-control-bar.has-devices {
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
    font-size: 9px;
    text-transform: uppercase;
    color: var(--text-sub);
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .media-title {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--primary-color);
  }

  .local-media {
    height: 32px;
    width: 100%;
    border-radius: 8px;
  }

  .device-status-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .target-selector {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .target-label {
    font-size: 9px;
    text-transform: uppercase;
    color: var(--text-sub);
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .selector-container {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f8f9f7;
    padding: 6px 10px;
    border-radius: 12px;
    border: 1.5px solid var(--border-color);
    transition: all 0.2s ease;
  }

  .selector-container:hover {
    border-color: var(--primary-color);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.online { background-color: #28a745; box-shadow: 0 0 8px rgba(40, 167, 69, 0.4); }
  .status-dot.offline { background-color: #dc3545; }
  .status-dot.browser { background-color: var(--primary-color); }

  .device-select {
    border: none;
    background: transparent;
    font-size: 12px;
    font-weight: 700;
    outline: none;
    padding-right: 4px;
    color: var(--text-main);
    cursor: pointer;
  }

  .remote-controls {
    display: flex;
    gap: 6px;
  }

  .remote-controls button {
    background: white;
    border: 1.5px solid var(--border-color);
    border-radius: 8px;
    padding: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
  }

  .remote-controls button:hover {
    border-color: var(--primary-color);
    background: #f0f7f2;
    transform: translateY(-2px);
  }

  .close-bar {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 18px;
    padding: 4px;
    color: var(--text-sub);
    transition: color 0.2s ease;
  }

  .close-bar:hover {
    color: #d13438;
  }

  .mini-status {
    position: absolute;
    top: -28px;
    right: 16px;
    background: var(--primary-color);
    color: white;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 20px;
    box-shadow: 0 4px 10px rgba(21, 112, 57, 0.2);
    animation: flyUp 0.3s ease-out;
  }

  @keyframes flyUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 440px) {
    .now-playing-label, .target-label {
      font-size: 8px;
    }
    
    .device-select {
      max-width: 90px;
    }
  }
</style>

