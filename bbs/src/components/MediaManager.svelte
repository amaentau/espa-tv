<script>
  import { deviceState } from '../lib/deviceState.svelte.js';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let videoElement = $state(null);
  let audioElement = $state(null);
  let showRotateHint = $state(false);
  let hideHintTimeout;
  let anchoredStyle = $state({});

  // Sync state from elements to deviceState
  function handleTimeUpdate(e) {
    deviceState.currentTime = e.target.currentTime;
    deviceState.duration = e.target.duration;
    
    // Show rotation hint once shortly after video starts on mobile
    const isMobileOrTouch = window.innerWidth < 600 || ('ontouchstart' in window);
    if (deviceState.isAnchored && 
        deviceState.currentMedia?.type === 'VIDEO' && 
        !deviceState.isFullscreen &&
        e.target.currentTime > 0.5 && 
        e.target.currentTime < 5 && // 4.5s window
        isMobileOrTouch) {
      triggerRotateHint();
    }
  }

  // Calculate anchored position based on placeholder
  $effect(() => {
    if (deviceState.isAnchored) {
      const updatePosition = () => {
        const placeholder = document.querySelector('.video-anchor-placeholder');
        if (placeholder) {
          const rect = placeholder.getBoundingClientRect();
          anchoredStyle = {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`
          };
        }
      };

      const placeholder = document.querySelector('.video-anchor-placeholder');
      let observer;
      if (placeholder) {
        observer = new ResizeObserver(updatePosition);
        observer.observe(placeholder);
      }

      updatePosition();
      window.addEventListener('scroll', updatePosition, { passive: true });
      window.addEventListener('resize', updatePosition);
      return () => {
        if (observer) observer.disconnect();
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
    }
  });

  function triggerRotateHint() {
    if (showRotateHint || deviceState.isFullscreen) return;
    showRotateHint = true;
    clearTimeout(hideHintTimeout);
    hideHintTimeout = setTimeout(() => {
      showRotateHint = false;
    }, 6000); // 6 seconds hint
  }

  function handleMediaClick() {
    // If we are docked, clicking the media should return us to the originating view
    if (!deviceState.isAnchored && !deviceState.isFullscreen && deviceState.currentMedia) {
      if (deviceState.currentMedia.type === 'VIDEO') {
        deviceState.activeView = 'videot';
      } else if (deviceState.currentMedia.type === 'SONG') {
        deviceState.activeView = 'music';
      }
    }
  }

  function handlePlayState(paused) {
    deviceState.isPaused = paused;
  }

  // Handle Fullscreen events
  function onFullscreenChange() {
    deviceState.isFullscreen = !!document.fullscreenElement;
  }

  onMount(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  });

  // External controls (from GlobalControlBar)
  $effect(() => {
    if (deviceState.currentMedia) {
      const el = deviceState.currentMedia.type === 'VIDEO' ? videoElement : audioElement;
      if (el) {
        if (deviceState.isPaused && !el.paused) el.pause();
        if (!deviceState.isPaused && el.paused) el.play();
      }
    }
  });

  // Watch for orientation change for auto-fullscreen (Mobile Only)
  $effect(() => {
    // Only auto-rotate on mobile/touch devices
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    if (!isMobile) return;

    const handleOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      
      // ONLY trigger FS if anchored in Highlights view
      if (deviceState.currentMedia?.type === 'VIDEO' && deviceState.isAnchored) {
        if (isLandscape && !document.fullscreenElement) {
          videoElement?.requestFullscreen().catch(() => {});
        } else if (!isLandscape && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    // Run once on state change (e.g. when becoming anchored)
    handleOrientation();

    window.addEventListener('resize', handleOrientation);
    return () => window.removeEventListener('resize', handleOrientation);
  });
</script>

<div class="media-manager-portal {deviceState.currentMedia ? 'active' : ''} {deviceState.isAnchored ? 'anchored' : 'docked'} {deviceState.isFullscreen ? 'is-fullscreen' : ''}"
     style="{deviceState.isAnchored ? `top: ${anchoredStyle.top}; left: ${anchoredStyle.left}; width: ${anchoredStyle.width}; height: ${anchoredStyle.height};` : ''}">
  
  {#if deviceState.currentMedia}
    <div class="media-container" onclick={handleMediaClick} role="presentation">
      {#if showRotateHint}
        <div class="rotate-hint" transition:fade>
          <div class="hint-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <path d="M12 18h.01" />
              <path class="arrow" d="M17 10l3-3-3-3" />
              <path class="curve" d="M10 2a8 8 0 0 1 10 8" />
            </svg>
          </div>
          <span>Käännä puhelin</span>
        </div>
      {/if}

      {#if deviceState.currentMedia.type === 'VIDEO'}
        <video 
          bind:this={videoElement}
          src={deviceState.currentMedia.url} 
          autoplay
          playsinline
          crossorigin="anonymous"
          ontimeupdate={handleTimeUpdate}
          onplay={() => handlePlayState(false)}
          onpause={() => handlePlayState(true)}
          onloadedmetadata={handleTimeUpdate}
        >
          <track kind="captions" />
        </video>
      {:else if deviceState.currentMedia.type === 'SONG'}
        <audio 
          bind:this={audioElement}
          src={deviceState.currentMedia.url} 
          autoplay
          crossorigin="anonymous"
          ontimeupdate={handleTimeUpdate}
          onplay={() => handlePlayState(false)}
          onpause={() => handlePlayState(true)}
          onloadedmetadata={handleTimeUpdate}
        ></audio>
        <div class="audio-visualizer">
          <div class="visualizer-bars">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .media-manager-portal {
    position: fixed;
    z-index: 2000;
    pointer-events: none;
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
  }

  .media-manager-portal.active {
    opacity: 1;
  }

  /* Anchored State: Fixed to the placeholder's viewport position */
  .media-manager-portal.anchored {
    position: fixed;
    z-index: 500;
    transform: none;
    pointer-events: auto;
  }

  /* Docked State: Bottom Bar */
  .media-manager-portal.docked {
    position: fixed;
    bottom: 27px;
    left: 20px; /* Default for mobile */
    width: 100px;
    height: 56px;
    transform: none;
    z-index: 2000;
  }

  @media (min-width: 480px) {
    .media-manager-portal.docked {
      left: calc(50% - 240px + 20px); /* Align with centered 480px layout */
    }
  }

  .media-manager-portal.is-fullscreen {
    position: fixed;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    transform: none !important;
    z-index: 3000;
  }

  .media-container {
    width: 100%;
    height: 100%;
    background: #000;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    pointer-events: auto;
    position: relative;
  }

  .is-fullscreen .media-container {
    border-radius: 0;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .rotate-hint {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 10;
    pointer-events: none;
    gap: 12px;
  }

  .hint-icon {
    width: 48px;
    height: 48px;
    animation: rotate-device 2s infinite ease-in-out;
  }

  @keyframes rotate-device {
    0% { transform: rotate(0deg); }
    30% { transform: rotate(90deg); }
    70% { transform: rotate(90deg); }
    100% { transform: rotate(0deg); }
  }

  .rotate-hint span {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }

  .audio-visualizer {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--primary-color), #1a1a1a);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .visualizer-bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 30px;
  }

  .visualizer-bars span {
    width: 4px;
    background: white;
    border-radius: 2px;
    animation: bounce 0.8s infinite ease-in-out;
  }

  .visualizer-bars span:nth-child(2) { animation-delay: 0.1s; }
  .visualizer-bars span:nth-child(3) { animation-delay: 0.2s; }
  .visualizer-bars span:nth-child(4) { animation-delay: 0.1s; }
  .visualizer-bars span:nth-child(5) { animation-delay: 0.3s; }

  @keyframes bounce {
    0%, 100% { height: 5px; }
    50% { height: 25px; }
  }
</style>
