<script>
  import { onMount } from 'svelte';
  import { deviceState, playMedia } from '../lib/deviceState.svelte.js';
  import SocialSection from './SocialSection.svelte';
  import { socialState } from '../lib/socialState.svelte.js';
  
  let { token, authState } = $props();

  let tracks = $state([]);
  let loading = $state(false);
  let showSocial = $state(false);
  let socialTargetId = $state(null);

  async function loadLibrary() {
    loading = true;
    try {
      // Fetch ONLY Blob Storage files
      const res = await fetch('/library/blob/song', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const blobTracks = await res.json();

      // Combine and sort by timestamp (newest first)
      tracks = blobTracks.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      // Fetch social stats for each track
      tracks.forEach(track => {
        socialState.fetchStats(track.rowKey, token);
      });
    } catch (err) {
      console.error('Failed to load music library:', err);
    } finally {
      loading = false;
    }
  }

  onMount(loadLibrary);

  function handlePlay(track) {
    playMedia({
      title: track.title,
      url: track.url,
      type: 'SONG',
      rowKey: track.rowKey
    });
  }

  function openSocial(track) {
    socialTargetId = track.rowKey;
    showSocial = true;
  }
</script>

<div class="music-view">
  <div class="view-header">
    <h3 class="view-title">Musiikki</h3>
    <p class="view-subtitle">Kirjaston kappaleet</p>
  </div>
  
  {#if loading}
    <div class="loading-state">
      <div class="loader"></div>
      <p>Ladataan musiikkia...</p>
    </div>
  {:else}
    <div class="track-list">
      {#each tracks as track}
        <div class="track-item-wrapper">
          <button 
            class="track-item {deviceState.currentMedia?.rowKey === track.rowKey ? 'active' : ''}" 
            onclick={() => handlePlay(track)}
          >
            <div class="track-content">
              <div class="track-info">
                <span class="track-title">{track.title}</span>
                <div class="track-meta">
                  <span class="track-artist">Lähde: {track.creatorEmail.split('@')[0]}</span>
                  
                  {#if socialState.stats[track.rowKey]}
                    <div class="social-summary">
                      {#if socialState.stats[track.rowKey].commentCount > 0}
                        <span class="stat-item">💬 {socialState.stats[track.rowKey].commentCount}</span>
                      {/if}
                      {#each Object.entries(socialState.stats[track.rowKey].reactions) as [emoji, count]}
                        {#if count > 0}
                          <span class="stat-item">{emoji} {count}</span>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
              <div class="play-indicator">
                <span class="play-icon">▶</span>
              </div>
            </div>
            
            {#if deviceState.currentMedia?.rowKey === track.rowKey}
              <div class="active-ripple"></div>
            {/if}
          </button>
          
          <div class="track-actions">
            <button 
              class="action-icon-btn social" 
              onclick={() => openSocial(track)}
              title="Kommentit"
            >
              💬
            </button>
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">🎵</div>
          <p>Kirjastossa ei ole vielä musiikkia.</p>
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
  .music-view {
    padding-bottom: 40px;
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

  .track-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .track-item-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .track-item {
    background: white;
    border: 1.5px solid var(--border-color);
    border-radius: 16px;
    padding: 0;
    text-align: left;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    flex: 1;
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  }

  .track-item:hover {
    transform: translateX(4px);
    border-color: var(--primary-color);
    box-shadow: 0 8px 16px rgba(21, 112, 57, 0.1);
  }

  .track-item.active {
    border-color: var(--primary-color);
    background: #f0f7f2;
    box-shadow: 0 4px 12px rgba(21, 112, 57, 0.15);
  }

  .track-content {
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .track-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 4px;
  }

  .track-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .social-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .stat-item {
    font-size: 11px;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.05);
    padding: 1px 6px;
    border-radius: 10px;
    color: var(--text-main);
    white-space: nowrap;
  }

  .track-title {
    font-weight: 800;
    font-size: 15px;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    font-size: 12px;
    color: var(--text-sub);
    opacity: 0.8;
  }

  .play-icon {
    width: 32px;
    height: 32px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    padding-left: 2px;
    box-shadow: 0 4px 8px rgba(21, 112, 57, 0.2);
  }

  .track-actions {
    display: flex;
    gap: 8px;
  }

  .action-icon-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: white;
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-icon-btn:hover {
    transform: scale(1.1);
    border-color: var(--primary-color);
  }

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
