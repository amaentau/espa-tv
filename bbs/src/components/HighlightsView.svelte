<script>
  import { onMount } from 'svelte';
  import { deviceState, playMedia } from '../lib/deviceState.svelte.js';
  import { isMediaCached, preCacheMedia, removeFromCache } from '../lib/cacheUtils.js';
  import SocialSection from './SocialSection.svelte';
  import { socialState } from '../lib/socialState.svelte.js';

  let { authState, token } = $props();

  let streams = $state([]);
  let loading = $state(false);
  let error = $state('');
  let selectedStream = $state(null);
  let showSocial = $state(false);
  let socialTargetId = $state(null);
  let cacheStatus = $state({}); // rowKey -> boolean

  async function checkCacheStatus() {
    const status = {};
    for (const stream of streams) {
      status[stream.rowKey] = await isMediaCached(stream.url);
    }
    cacheStatus = status;
  }

  async function toggleCache(stream) {
    if (cacheStatus[stream.rowKey]) {
      await removeFromCache(stream.url);
    } else {
      await preCacheMedia(stream.url);
    }
    setTimeout(checkCacheStatus, 500);
  }

  async function loadLibrary() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/library/blob/video', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Videoita ei voitu hakea');
      
      const data = await res.json();
      streams = data.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      await checkCacheStatus();

      // Fetch social stats for each stream
      streams.forEach(stream => {
        socialState.fetchStats(stream.rowKey, token);
      });
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadLibrary();
    // Re-anchor if video is already playing when we return to this view
    if (deviceState.currentMedia?.type === 'VIDEO') {
      deviceState.isAnchored = true;
    }
  });

  function handlePlay(stream) {
    selectedStream = stream;
    deviceState.isAnchored = true;
    playMedia({
      title: stream.title,
      url: stream.url,
      type: 'VIDEO',
      metadata: stream.metadata
    });
  }

  function openSocial(stream) {
    socialTargetId = stream.rowKey;
    showSocial = true;
  }

  import { onDestroy } from 'svelte';
  onDestroy(() => {
    // When leaving this view, dock the video to the bottom bar
    deviceState.isAnchored = false;
  });
</script>

<div class="highlights-view">
  <div class="view-header">
    <h3 class="view-title">Videot</h3>
    <p class="view-subtitle">Tallenteet ja huippuhetket</p>
  </div>
  
  {#if deviceState.currentMedia && deviceState.isAnchored}
    <div class="video-anchor-placeholder">
      <!-- MediaManager will float over this space -->
    </div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="loader"></div>
      <p>Haetaan videoita...</p>
    </div>
  {:else if error}
    <div class="status-msg error">{error}</div>
  {:else}
    <div class="stream-grid">
      {#each streams as stream}
        <div class="stream-item-wrapper">
          <button 
            class="stream-card {selectedStream?.rowKey === stream.rowKey ? 'active' : ''}" 
            onclick={() => handlePlay(stream)}
          >
            <div class="card-content">
              <div class="badge-row">
                <span class="badge badge-{stream.metadata?.eventType?.toLowerCase().replace(/\s+/g, '') || 'default'}">
                  {stream.metadata?.eventType || 'Video'}
                </span>
                <span class="date">{new Date(stream.timestamp).toLocaleDateString('fi-FI')}</span>
              </div>
              
              <h4 class="stream-title">{stream.title}</h4>
              
              <div class="stream-footer">
                <div class="footer-left">
                  <span class="creator">Lähde: {stream.creatorEmail.split('@')[0]}</span>
                  
                  {#if socialState.stats[stream.rowKey]}
                    <div class="social-summary">
                      {#if socialState.stats[stream.rowKey].commentCount > 0}
                        <span class="stat-item">💬 {socialState.stats[stream.rowKey].commentCount}</span>
                      {/if}
                      {#each Object.entries(socialState.stats[stream.rowKey].reactions) as [emoji, count]}
                        {#if count > 0}
                          <span class="stat-item">{emoji} {count}</span>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>

                <div class="play-indicator">
                  <span class="play-icon">▶</span>
                  <span class="play-text">Toista</span>
                </div>
              </div>
            </div>
            
            {#if selectedStream?.rowKey === stream.rowKey}
              <div class="active-ripple"></div>
            {/if}
          </button>
          
          <div class="track-actions">
            <button 
              class="action-icon-btn social" 
              onclick={() => openSocial(stream)}
              title="Kommentit"
            >
              💬
            </button>
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">🎬</div>
          <p>Kirjastossa ei ole vielä videoita.</p>
        </div>
      {/each}
    </div>
  {/if}

  {#if showSocial}
    <SocialSection 
      targetId={socialTargetId} 
      token={token} 
      username={authState.username} 
      userEmail={authState.userEmail}
      onClose={() => showSocial = false} 
    />
  {/if}
</div>

<style>
  .highlights-view {
    padding-bottom: 40px;
  }

  .video-anchor-placeholder {
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: 252px;
    background: rgba(0,0,0,0.03);
    border-radius: 12px;
    margin-bottom: 24px;
    transition: all 0.3s ease;
  }

  .view-header {
    margin-bottom: 24px;
    text-align: center;
  }

  .view-title {
    font-size: 28px;
    font-weight: 900;
    color: var(--primary-color);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: -0.5px;
  }

  .view-subtitle {
    font-size: 14px;
    color: var(--text-sub);
    margin: 4px 0 0 0;
  }

  .loading-state {
    text-align: center;
    padding: 40px;
    color: var(--text-sub);
  }

  .stream-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .stream-item-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .stream-card {
    background: white;
    border: 1.5px solid var(--border-color);
    border-radius: 20px;
    padding: 0;
    text-align: left;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    flex: 1;
    min-width: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  }

  .stream-card:hover {
    transform: translateY(-4px);
    border-color: var(--primary-color);
    box-shadow: 0 12px 24px rgba(21, 112, 57, 0.1);
  }

  .stream-card:active {
    transform: translateY(-2px);
  }

  .stream-card.active {
    border-color: var(--primary-color);
    background: #f0f7f2;
    box-shadow: 0 8px 20px rgba(21, 112, 57, 0.15);
  }

  .card-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .badge-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stream-title {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-main);
    margin: 0;
    line-height: 1.3;
  }

  .stream-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 4px;
  }

  .footer-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .social-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .stat-item {
    font-size: 12px;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.05);
    padding: 2px 8px;
    border-radius: 12px;
    color: var(--text-main);
    white-space: nowrap;
  }

  .date {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-sub);
  }

  .creator {
    font-size: 12px;
    color: var(--text-sub);
    opacity: 0.8;
  }

  .play-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--primary-color);
    font-weight: 800;
    font-size: 14px;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .play-icon {
    width: 24px;
    height: 24px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    padding-left: 2px;
  }

  .track-actions {
    display: flex;
    gap: 8px;
  }

  .action-icon-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: white;
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  .action-icon-btn:hover {
    transform: scale(1.1);
    border-color: var(--primary-color);
    background: #f0f7f2;
  }

  .badge {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 900;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-default { background: #8e8e93; }
  .badge-highlights { background: #ff9500; }
  .badge-peli { background: var(--primary-color); }
  .badge-haastattelu { background: #5856d6; }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: #f8f9f7;
    border-radius: 24px;
    border: 2px dashed var(--border-color);
    color: var(--text-sub);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .active-ripple {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(circle, var(--primary-color) 0%, transparent 70%);
    opacity: 0.05;
    pointer-events: none;
  }
</style>

