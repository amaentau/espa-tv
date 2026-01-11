<script>
  import { deviceState, sendCommand, setPlaybackTarget } from '../lib/deviceState.svelte.js';

  let commandLoading = $state(false);
  let statusMsg = $state('');

  async function handleCommand(cmd) {
    if (deviceState.playbackTarget === 'browser') {
      if (cmd === 'play') deviceState.isPaused = false;
      if (cmd === 'pause') deviceState.isPaused = true;
      if (cmd === 'fullscreen') {
        // Only available on desktop/tablet where auto-rotate isn't a thing
        const el = document.querySelector('.media-container video');
        if (el) {
          if (el.requestFullscreen) {
            el.requestFullscreen().catch(err => console.warn('FS failed:', err));
          } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
          }
        }
      }
      return;
    }

    commandLoading = true;
    try {
      const res = await sendCommand(cmd);
      statusMsg = res.mode === 'direct' ? '✅ Suoritettu' : '📨 Jonossa';
      setTimeout(() => statusMsg = '', 3000);
    } catch (e) {
      statusMsg = '❌ Virhe';
    } finally {
      commandLoading = false;
    }
  }

  function closeMedia() {
    deviceState.currentMedia = null;
    deviceState.isAnchored = false;
  }

  function toggleExpand() {
    if (deviceState.isAnchored) {
      deviceState.isAnchored = false;
    } else if (deviceState.currentMedia) {
      // Return to originating view
      if (deviceState.currentMedia.type === 'VIDEO') {
        deviceState.activeView = 'videot';
      } else if (deviceState.currentMedia.type === 'SONG') {
        deviceState.activeView = 'music';
      }
    }
  }

  function handleSeek(e) {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    
    if (deviceState.playbackTarget === 'browser') {
      const el = document.querySelector('.media-container video, .media-container audio');
      if (el) el.currentTime = el.duration * pct;
    } else {
      sendCommand('seek', { percentage: pct * 100 });
    }
  }

  const barHeightClass = $derived(() => {
    if (!deviceState.currentMedia) return 'h-utility';
    if (deviceState.isAnchored) return 'h-control';
    if (deviceState.currentMedia.type === 'VIDEO') return 'h-immersive';
    return 'h-performance';
  });
</script>

<div class="global-control-bar {barHeightClass()} {deviceState.currentMedia ? 'active' : ''} {deviceState.devices.length > 0 ? 'has-devices' : ''}">
  
  {#if deviceState.currentMedia}
    <!-- Glow Line Seeker -->
    <button class="glow-line-seeker" onclick={handleSeek} aria-label="Seeker">
      <div class="progress-fill" style="width: {(deviceState.currentTime / deviceState.duration) * 100}%"></div>
    </button>
  {/if}

  <div class="bar-content">
    <div class="left-section">
      {#if deviceState.currentMedia && !deviceState.isAnchored}
        <!-- The Dock Placeholder (MediaManager floats over this) -->
        <button class="media-dock-trigger" onclick={toggleExpand} aria-label="Expand media">
          <div class="dock-spacer"></div>
        </button>
      {/if}
      
      <div class="media-info">
        {#if deviceState.currentMedia}
          <span class="now-playing-label">
            {deviceState.playbackTarget !== 'browser' ? 'Toistetaan soittimella' : 'Toistetaan tässä'}
          </span>
          <span class="media-title">{deviceState.currentMedia.title}</span>
        {:else if deviceState.devices.length > 0}
          <span class="now-playing-label">Valitse soitin:</span>
          <div class="device-mini-selector">
            <span class="status-dot {deviceState.playbackTarget === 'browser' ? 'browser' : (deviceState.activeDevice?.iotStatus === 'Connected' ? 'online' : 'offline')}"></span>
            <select 
              value={deviceState.playbackTarget} 
              onchange={(e) => setPlaybackTarget(e.target.value)}
            >
              <option value="browser">Tämä laite</option>
              {#each deviceState.devices as dev}
                <option value={dev.id}>{dev.friendlyName || dev.id}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>
    </div>

    <div class="right-section">
      {#if deviceState.currentMedia}
        <div class="playback-controls">
          {#if deviceState.isPaused}
            <button class="play-btn" onclick={() => handleCommand('play')}>▶</button>
          {:else}
            <button class="play-btn pause" onclick={() => handleCommand('pause')}>II</button>
          {/if}
          
          {#if deviceState.currentMedia.type === 'VIDEO'}
            <button class="fs-btn" onclick={() => handleCommand('fullscreen')}>📺</button>
          {/if}
        </div>
        <button class="close-btn" onclick={closeMedia}>✕</button>
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
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(0,0,0,0.05);
    box-shadow: 0 -8px 32px rgba(0,0,0,0.1);
    z-index: 1500;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateY(100%);
  }

  .global-control-bar.active, .global-control-bar.has-devices {
    transform: translateY(0);
  }

  /* Height Tiers */
  .h-utility { height: 60px; }
  .h-control { height: 80px; }
  .h-performance { height: 90px; }
  .h-immersive { height: 110px; }

  .glow-line-seeker {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: rgba(0,0,0,0.05);
    border: none;
    padding: 0;
    cursor: pointer;
    overflow: visible;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary-color);
    box-shadow: 0 0 12px var(--primary-color);
    transition: width 0.2s linear;
    position: relative;
  }

  .bar-content {
    max-width: 480px;
    margin: 0 auto;
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
  }

  .left-section {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }

  .media-dock-trigger {
    width: 100px;
    height: 56px;
    flex-shrink: 0;
    background: rgba(0,0,0,0.05);
    border-radius: 8px;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .media-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .now-playing-label {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--text-sub);
    letter-spacing: 0.5px;
  }

  .media-title {
    font-size: 14px;
    font-weight: 800;
    color: var(--primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .right-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .playback-controls {
    display: flex;
    gap: 8px;
  }

  .play-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    border: none;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(21, 112, 57, 0.2);
  }

  .play-btn.pause { font-family: monospace; font-weight: bold; }

  .fs-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: var(--text-sub);
    padding: 8px;
    display: none; /* Hidden by default (mobile) */
  }

  @media (min-width: 768px) {
    .fs-btn {
      display: flex; /* Only show on desktop/tablet */
    }
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: var(--text-sub);
    padding: 8px;
  }

  .device-mini-selector {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .device-mini-selector select {
    border: none;
    background: none;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
    outline: none;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .status-dot.online { background: #28a745; }
  .status-dot.offline { background: #dc3545; }
  .status-dot.browser { background: var(--primary-color); }

  .mini-status {
    position: absolute;
    top: -40px;
    right: 20px;
    background: var(--primary-color);
    color: white;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
</style>
