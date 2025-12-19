'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const baseUrl = (window.APP_CONFIG && window.APP_CONFIG.baseUrl) || '';

  const els = {
    deviceId: $('deviceId'),
    videoUrl: $('videoUrl'),
    videoTitle: $('videoTitle'),
    sendBtn: $('sendBtn'),
    statusMsg: $('statusMsg'),
    historyList: $('historyList'),
    loader: $('loader'),
    refreshBtn: $('refreshBtn'),
    emptyState: $('emptyState')
  };

  // Helper to format date
  function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Juuri nyt';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m sitten`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}t sitten`;
    return date.toLocaleDateString('fi-FI');
  }

  // Load history for the current device ID
  async function loadHistory() {
    const deviceId = els.deviceId.value.trim();
    if (!deviceId) return;

    els.loader.style.display = 'block';
    els.historyList.innerHTML = '';
    els.emptyState.style.display = 'none';

    try {
      const resp = await fetch(`${baseUrl}/entries/${encodeURIComponent(deviceId)}`);
      if (!resp.ok) throw new Error('Historiaa ei voitu hakea');
      
      const data = await resp.json();
      renderHistory(data);
    } catch (err) {
      console.error(err);
      // Silent fail or minimal indication for history load
    } finally {
      els.loader.style.display = 'none';
    }
  }

  function renderHistory(items) {
    els.historyList.innerHTML = '';
    
    if (!items || items.length === 0) {
      els.emptyState.style.display = 'block';
      return;
    }

    items.forEach(item => {
      // Mapping: value1 = URL, value2 = Title
      const url = item.value1;
      const title = item.value2 || url; // Fallback to URL if no title
      const timestamp = item.timestamp;

      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div class="item-header">
          <span class="item-title">${escapeHtml(title)}</span>
          <span class="item-time">${timeAgo(timestamp)}</span>
        </div>
        <a href="${escapeHtml(url)}" target="_blank" class="item-url">${escapeHtml(url)}</a>
      `;
      els.historyList.appendChild(li);
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStatus(msg, type) {
    els.statusMsg.textContent = msg;
    els.statusMsg.className = `status-msg ${type}`;
    // Clear success message after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (els.statusMsg.className.includes('success')) {
          els.statusMsg.textContent = '';
        }
      }, 3000);
    }
  }

  // Event Listeners
  els.sendBtn.addEventListener('click', async () => {
    const deviceId = els.deviceId.value.trim();
    const videoUrl = els.videoUrl.value.trim();
    const videoTitle = els.videoTitle.value.trim();

    if (!deviceId) {
      setStatus('Syötä Veo-tunnus', 'error');
      return;
    }
    if (!videoUrl) {
      setStatus('Syötä videon osoite', 'error');
      return;
    }

    els.sendBtn.disabled = true;
    setStatus('Lähetetään...', '');

    try {
      const resp = await fetch(`${baseUrl}/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: deviceId,
          value1: videoUrl,
          value2: videoTitle
        })
      });

      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error || 'Palvelinvirhe');
      }

      setStatus('Lisätty onnistuneesti!', 'success');
      els.videoUrl.value = ''; // Clear URL but keep Device ID
      els.videoTitle.value = ''; // Clear Title
      
      // Refresh history immediately
      await loadHistory();

    } catch (err) {
      setStatus(`Virhe: ${err.message}`, 'error');
    } finally {
      els.sendBtn.disabled = false;
    }
  });

  els.refreshBtn.addEventListener('click', loadHistory);

  // Auto-load history when Device ID loses focus if it has value
  els.deviceId.addEventListener('blur', () => {
    if (els.deviceId.value.trim()) {
      loadHistory();
    }
  });

  // Initial load if default value exists
  if (els.deviceId.value.trim()) {
    loadHistory();
  }

})();
