import { preCacheMedia } from './cacheUtils.js';

// Shared state for devices and playback using Svelte 5 runes
export const deviceState = $state({
  devices: [],
  activeDeviceId: localStorage.getItem('espa_active_device_id') || '',
  token: localStorage.getItem('espa_token'),
  
  // Playback state
  currentMedia: null, // { title, url, type, rowKey, metadata }
  playbackTarget: localStorage.getItem('espa_playback_target') || 'browser', // 'browser' or deviceId
  
  // NEW: Navigation state
  activeView: 'tv',

  // UI & Sync state
  isPaused: true,
  currentTime: 0,
  duration: 0,
  isAnchored: false, // true = top of Highlights, false = docked in bottom bar
  isFullscreen: false,

  // Derived state
  get activeDevice() {
    // If playbackTarget is a device ID, that's our active device
    if (this.playbackTarget !== 'browser') {
      return this.devices.find(d => d.id === this.playbackTarget);
    }
    // Fallback to last active if target is browser but we want to know "selected" device
    return this.devices.find(d => d.id === this.activeDeviceId);
  },
  
  get onlineDevices() {
    return this.devices.filter(d => d.iotStatus === 'Connected');
  },

  get isPiActive() {
    const dev = this.activeDevice;
    return dev && dev.iotStatus === 'Connected';
  }
});

export async function refreshDevices() {
  if (!deviceState.token) return;
  try {
    const res = await fetch('/devices', {
      headers: { 'Authorization': `Bearer ${deviceState.token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    
    // For each device, fetch its IoT status
    const devicesWithStatus = await Promise.all(data.map(async (dev) => {
      try {
        const sRes = await fetch(`/devices/${encodeURIComponent(dev.id)}/iot-status`, {
          headers: { 'Authorization': `Bearer ${deviceState.token}` }
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          return { ...dev, iotStatus: sData.connectionState };
        }
      } catch (e) {}
      return { ...dev, iotStatus: 'Offline' };
    }));

    deviceState.devices = devicesWithStatus;

    // Validate playbackTarget
    if (deviceState.playbackTarget !== 'browser' && !devicesWithStatus.find(d => d.id === deviceState.playbackTarget)) {
      setPlaybackTarget('browser');
    }
  } catch (err) {
    console.error('Failed to refresh devices:', err);
  }
}

export function setPlaybackTarget(target) {
  deviceState.playbackTarget = target;
  localStorage.setItem('espa_playback_target', target);
  if (target !== 'browser') {
    deviceState.activeDeviceId = target;
    localStorage.setItem('espa_active_device_id', target);
  }
}

export function setActiveDevice(id) {
  deviceState.activeDeviceId = id;
  localStorage.setItem('espa_active_device_id', id);
}

export async function sendCommand(command, payload = {}) {
  const targetId = deviceState.playbackTarget === 'browser' ? deviceState.activeDeviceId : deviceState.playbackTarget;
  if (!targetId) return;
  try {
    const res = await fetch(`/devices/${encodeURIComponent(targetId)}/commands/${command}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deviceState.token}`
      },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error(`Command ${command} failed:`, err);
    throw err;
  }
}

export async function playMedia(media) {
  deviceState.currentMedia = media;
  
  // Start transparent caching in the background if it's a song or video
  if (media.type === 'SONG' || media.type === 'VIDEO' || media.type === 'VEO') {
    preCacheMedia(media.url).catch(err => console.error('Background caching failed:', err));
  }
  
  if (deviceState.playbackTarget === 'browser') {
    deviceState.playbackLocation = 'local';
    // If it's a VEO stream or something that should open in a new tab, we do it here
    if (media.type === 'VEO' || media.type === 'URL') {
      window.open(media.url, '_blank');
      deviceState.currentMedia = null; // Don't show in control bar if opened in new tab
    }
    return;
  }

  // Remote playback
  deviceState.playbackLocation = 'remote';
  const targetId = deviceState.playbackTarget;
  const targetDevice = deviceState.devices.find(d => d.id === targetId);

  if (targetDevice?.iotStatus === 'Connected') {
    // Immediate playback via IoT direct method
    await sendCommand('load_url', { url: media.url });
  } else {
    // Fallback: Send to BBS for auto-play on boot
    await fetch('/entry', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deviceState.token}`
      },
      body: JSON.stringify({ 
        key: targetId, 
        value1: media.url, 
        value2: media.title,
        eventType: media.type || 'MEDIA'
      })
    });
  }
}

