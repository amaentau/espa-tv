import { preCacheMedia } from './cacheUtils.js';

// Shared state for devices and playback using Svelte 5 runes
export const deviceState = $state({
  devices: [],
  activeDeviceId: localStorage.getItem('espa_active_device_id') || '',
  token: localStorage.getItem('espa_token'),
  
  // Playback state
  currentMedia: null, // { title, url, type, rowKey, metadata }
  playbackLocation: 'local', // 'local' or 'remote'
  
  // Derived state
  get activeDevice() {
    return this.devices.find(d => d.id === this.activeDeviceId);
  },
  
  get onlineDevices() {
    return this.devices.filter(d => d.iotStatus === 'Connected');
  },

  get isPiActive() {
    return this.activeDevice && this.activeDevice.iotStatus === 'Connected';
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

    // Set default active device if none selected
    const online = devicesWithStatus.filter(d => d.iotStatus === 'Connected');
    if (!deviceState.activeDeviceId && online.length > 0) {
      setActiveDevice(online[0].id);
    } else if (!deviceState.activeDeviceId && devicesWithStatus.length > 0) {
      setActiveDevice(devicesWithStatus[0].id);
    }
  } catch (err) {
    console.error('Failed to refresh devices:', err);
  }
}

export function setActiveDevice(id) {
  deviceState.activeDeviceId = id;
  localStorage.setItem('espa_active_device_id', id);
}

export async function sendCommand(command, payload = {}) {
  if (!deviceState.activeDeviceId) return;
  try {
    const res = await fetch(`/devices/${encodeURIComponent(deviceState.activeDeviceId)}/commands/${command}`, {
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

export async function playMedia(media, forceLocal = false) {
  deviceState.currentMedia = media;
  
  // Start transparent caching in the background if it's a song or video
  if (media.type === 'SONG' || media.type === 'VIDEO' || media.type === 'VEO') {
    preCacheMedia(media.url).catch(err => console.error('Background caching failed:', err));
  }
  
  if (forceLocal) {
    deviceState.playbackLocation = 'local';
    return;
  }

  if (deviceState.isPiActive) {
    deviceState.playbackLocation = 'remote';
    // Immediate playback via IoT direct method
    await sendCommand('load_url', { url: media.url });
  } else if (deviceState.activeDeviceId) {
    deviceState.playbackLocation = 'remote';
    // Fallback: Send to BBS for auto-play on boot
    await fetch('/entry', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deviceState.token}`
      },
      body: JSON.stringify({ 
        key: deviceState.activeDeviceId, 
        value1: media.url, 
        value2: media.title,
        eventType: media.type || 'MEDIA'
      })
    });
  } else {
    deviceState.playbackLocation = 'local';
  }
}

