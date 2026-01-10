<script>
  import { onMount } from 'svelte';
  import { deviceState, playMedia } from '../lib/deviceState.svelte.js';

  let { authState, token } = $props();

  let streams = $state([]);
  let loading = $state(false);
  let error = $state('');
  let selectedStream = $state(null);

  async function loadLibrary() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/library/VEO', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Striimejä ei voitu hakea');
      
      const data = await res.json();
      streams = data.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  onMount(loadLibrary);

  function handlePlayRemote(stream) {
    playMedia({
      title: stream.title,
      url: stream.url,
      type: 'VEO',
      metadata: stream.metadata
    });
  }

  function handlePlayLocal(stream) {
    window.open(stream.url, '_blank');
  }
</script>

<div class="espatv-view fade-in">
  <div class="streams-container">
    <h3 style="margin-bottom: 16px; color: var(--primary-color);">Espa TV</h3>
    
    {#if loading}
      <div class="loader"></div>
    {:else if error}
      <div class="status-msg error">{error}</div>
    {:else}
      <div class="stream-list">
        {#each streams as stream}
          <div class="stream-item {selectedStream?.rowKey === stream.rowKey ? 'active' : ''}">
            <div class="stream-info" onclick={() => selectedStream = stream} onkeydown={(e) => e.key === 'Enter' && (selectedStream = stream)} role="button" tabindex="0">
              <div class="stream-main-info">
                <span class="title">{stream.title}</span>
                <span class="date">{new Date(stream.timestamp).toLocaleDateString('fi-FI')}</span>
              </div>
              <div class="stream-sub-info">
                <span class="badge badge-{stream.metadata?.eventType?.toLowerCase().replace(/\s+/g, '') || 'default'}">{stream.metadata?.eventType || 'VEO'}</span>
                <span class="creator">Lähde: {stream.creatorEmail}</span>
              </div>
            </div>
            
            <div class="stream-actions">
              <button 
                class="icon-btn local" 
                onclick={() => handlePlayLocal(stream)} 
                title="Avaa tässä"
              >
                📱
              </button>
              
              {#if deviceState.devices.length > 0}
                <button 
                  class="icon-btn {deviceState.isPiActive ? 'remote' : 'offline'}" 
                  onclick={() => handlePlayRemote(stream)} 
                  disabled={!deviceState.isPiActive}
                  title={deviceState.isPiActive ? 'Toista soittimelle' : 'Soitin ei ole linjoilla'}
                >
                  ▶️
                </button>
              {/if}
            </div>
          </div>
        {:else}
          <div class="empty-state">Ei suoria lähetyksiä tai tallenteita.</div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .espatv-view {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    padding-bottom: 80px;
  }

  .stream-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stream-item {
    background: white;
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 12px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s ease;
    width: 100%;
    min-width: 0;
  }

  .stream-item:hover { border-color: var(--primary-color); }
  .stream-item.active {
    border-color: var(--primary-color);
    background: rgba(21, 112, 57, 0.05);
  }

  .stream-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    overflow: hidden;
  }

  .stream-main-info {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    margin-bottom: 2px;
  }

  .title {
    font-weight: 700;
    font-size: 14px;
    flex: 1;
    min-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .date {
    font-size: 11px;
    color: var(--text-sub);
    white-space: nowrap;
  }

  .stream-sub-info {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }

  .creator {
    font-size: 11px;
    color: var(--text-sub);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  @media (max-width: 400px) {
    .stream-item {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
    
    .stream-actions {
      justify-content: flex-end;
      margin-left: 0;
    }
  }

  .stream-actions {
    display: flex;
    gap: 8px;
    margin-left: 12px;
  }

  .icon-btn {
    background: none;
    border: 1px solid var(--border-color);
    padding: 8px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    transition: all 0.2s ease;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    background: #f0f0f0;
    transform: scale(1.1);
  }

  .icon-btn.local { background-color: #f0f0f0; font-size: 16px; }
  .icon-btn.remote {
    background-color: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }
  .icon-btn.offline {
    background-color: #eee;
    color: #ccc;
    cursor: not-allowed;
    border-color: #eee;
  }

  .badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: bold;
    color: white;
    text-transform: uppercase;
  }

  .badge-default { background: #888; }
  .badge-highlights { background: #f39c12; }
  .badge-peli { background: #3498db; }
  .badge-haastattelu { background: #9b59b6; }
</style>
