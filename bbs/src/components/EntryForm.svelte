<script>
  import { deviceState } from '../lib/deviceState.svelte.js';
  let { metadata, token, authState, onEntryAdded, contentType = $bindable() } = $props();

  let videoUrl = $state('');
  let videoTitle = $state('');
  let gameGroup = $state('');
  let eventType = $state('');
  let opponent = $state('');
  let scoreHome = $state('');
  let scoreAway = $state('');
  let isHome = $state(true);
  
  let status = $state({ msg: '', type: '' });
  let loading = $state(false);
  let isDragging = $state(false);
  let fileInput = $state(null);
  let selectedFile = $state(null);

  const allContentTypes = [
    { id: 'veo', label: 'Veo Linkki', icon: '⚽', roles: ['ADMIN', 'Veo Ylläpitäjä'] },
    { id: 'song', label: 'Kappale', icon: '🎵', roles: ['ADMIN'] },
    { id: 'video', label: 'Video', icon: '🎬', roles: ['ADMIN'] },
    { id: 'image', label: 'Kuva', icon: '🖼️', roles: ['ADMIN'] }
  ];

  // Filter content types based on user role
  const contentTypes = $derived(allContentTypes.filter(t => {
    if (authState.isAdmin) return true;
    return t.roles.includes(authState.userGroup);
  }));

  // Ensure selected contentType is valid for user
  $effect(() => {
    if (contentTypes.length > 0 && !contentTypes.find(t => t.id === contentType)) {
      contentType = contentTypes[0].id;
    }
  });

  // Set defaults from metadata or localStorage
  $effect(() => {
    if (metadata.gameGroups.length > 0 && !gameGroup) {
      const lastGroup = localStorage.getItem('espa_last_group');
      gameGroup = (lastGroup && metadata.gameGroups.includes(lastGroup)) ? lastGroup : metadata.gameGroups[0];
    }
    if (metadata.eventTypes.length > 0 && !eventType) {
      eventType = metadata.eventTypes[0];
    }
  });

  const setStatus = (msg, type = 'error') => {
    status = { msg, type };
    if (type === 'success') {
      setTimeout(() => { if (status.msg === msg) status.msg = ''; }, 3000);
    }
  };

  async function handleSend() {
    const targetDeviceId = deviceState.activeDeviceId;
    if (!targetDeviceId) return setStatus('Valitse aktiivinen laite alavalikosta');
    if (!videoUrl && !selectedFile) return setStatus('Syötä osoite tai valitse tiedosto');

    loading = true;
    setStatus('Käsitellään...', 'info');

    let finalUrl = videoUrl;
    let finalTitle = videoTitle.trim();

    try {
      // 1. If we have a file, upload it now
      if (selectedFile) {
        setStatus(`Ladataan tiedostoa: ${selectedFile.name}...`, 'info');
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await fetch(`/library/blob/upload/${contentType}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (!uploadRes.ok) throw new Error('Tiedoston lataus epäonnistui');
        const uploadData = await uploadRes.json();
        
        // Construct the blob URL (backend should return full path ideally, but we know our pattern)
        finalUrl = `https://${window.location.hostname}/blobs/${contentType}/${uploadData.filename}`;
        if (!finalTitle) finalTitle = selectedFile.name;
      }

      // 2. Add to Global Library
      const typeLabel = allContentTypes.find(t => t.id === contentType).label;
      if (contentType === 'veo') {
        finalTitle = finalTitle || `${gameGroup} vs ${opponent || '???'}`;
      } else {
        finalTitle = finalTitle || `${typeLabel}: ${finalUrl.split('/').pop()}`;
      }

      const libPayload = {
        type: contentType === 'veo' ? 'VEO' : contentType.toUpperCase(),
        url: finalUrl,
        title: finalTitle,
        metadata: contentType === 'veo' ? {
          gameGroup, opponent, isHome, scoreHome, scoreAway, eventType
        } : {}
      };

      await fetch('/library', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(libPayload)
      });

      // 3. Play on Device
      const payload = { 
        key: targetDeviceId, 
        value1: finalUrl, 
        value2: finalTitle,
        eventType: contentType === 'veo' ? eventType : contentType.toUpperCase()
      };

      if (contentType === 'veo') {
        Object.assign(payload, { gameGroup, opponent, isHome, scoreHome, scoreAway });
      }

      const res = await fetch('/entry', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Virhe');

      setStatus(`Lisätty onnistuneesti!`, 'success');
      videoUrl = '';
      videoTitle = '';
      opponent = '';
      scoreHome = '';
      scoreAway = '';
      selectedFile = null;
      if (fileInput) fileInput.value = '';
      onEntryAdded();

    } catch (err) {
      setStatus(`Virhe: ${err.message}`, 'error');
    } finally {
      loading = false;
    }
  }

  function handleFileSelect(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    if (contentType === 'song') {
      const allowed = ['audio/', 'video/webm', '.webm', '.m4a', '.mp3', '.opus', '.mpeg'];
      const isAllowed = allowed.some(ext => file.type.startsWith(ext) || file.name.toLowerCase().endsWith(ext.replace('.', '')));
      if (!isAllowed) return setStatus('Vain äänitiedostot ovat sallittuja.', 'error');
    }
    
    selectedFile = file;
    setStatus(`Tiedosto "${file.name}" valittu. Paina Lisää tallentaaksesi.`, 'info');
  }

  function handleDrop(e) {
    e.preventDefault();
    isDragging = false;
    if (['song', 'image', 'video'].includes(contentType)) {
      handleFileSelect(e.dataTransfer.files);
    }
  }

  const teamLeft = $derived(isHome ? gameGroup : (opponent || 'Vastustaja'));
  const teamRight = $derived(isHome ? (opponent || 'Vastustaja') : gameGroup);

  $effect(() => {
    if (gameGroup) localStorage.setItem('espa_last_group', gameGroup);
  });
</script>

<div>
  <!-- Content Type Selector -->
  <div class="type-selector">
    {#each contentTypes as type}
      <button 
        class="type-btn {contentType === type.id ? 'active' : ''}" 
        onclick={() => contentType = type.id}
      >
        <span class="type-icon">{type.icon}</span>
        <span class="type-label">{type.label}</span>
      </button>
    {/each}
  </div>

  <div class="form-group">
    <label for="videoUrl">
      {#if contentType === 'veo'}Videon osoite (URL){:else if contentType === 'song'}Kappaleen osoite (URL) tai lataa tiedosto{:else if contentType === 'image'}Kuvan osoite (URL){:else}Videon osoite (URL){/if}
    </label>
    
    {#if contentType === 'song' || contentType === 'image' || contentType === 'video'}
      <div 
        class="upload-zone {isDragging ? 'dragging' : ''} {selectedFile ? 'has-file' : ''}"
        onragover={(e) => { e.preventDefault(); isDragging = true; }}
        onragleave={() => isDragging = false}
        ondrop={handleDrop}
        role="button"
        tabindex="0"
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); }}
      >
        <input 
          id="videoUrl" 
          type="url" 
          bind:value={videoUrl} 
          placeholder="https://..."
          style="border:none; background:transparent; margin-bottom:0;"
          disabled={!!selectedFile}
        >
        <div class="upload-divider">tai</div>
        <button 
          type="button" 
          class="upload-btn"
          onclick={() => fileInput.click()}
          disabled={loading}
        >
          {selectedFile ? '🔄 Vaihda tiedosto' : '📁 Valitse tiedosto'}
        </button>
        <input 
          type="file" 
          bind:this={fileInput} 
          onchange={(e) => handleFileSelect(e.target.files)} 
          style="display:none;"
          accept={contentType === 'song' ? 'audio/*,video/webm,.webm,.m4a,.mp3,.opus' : contentType === 'image' ? 'image/*' : 'video/*'}
        >
        {#if selectedFile}
          <p class="file-name">Valittu: {selectedFile.name}</p>
        {:else}
          <p class="upload-hint">Voit myös raahata tiedoston tähän</p>
        {/if}
      </div>
    {:else}
      <input id="videoUrl" type="url" bind:value={videoUrl} placeholder="https://...">
    {/if}
  </div>

  {#if contentType !== 'veo'}
    <div class="form-group">
      <label for="videoTitle">Otsikko (valinnainen)</label>
      <input id="videoTitle" type="text" bind:value={videoTitle} placeholder="esim. Taukomusiikki">
    </div>
  {/if}

  {#if contentType === 'veo'}
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="form-group">
        <label for="gameGroup">Peliryhmä</label>
        <select id="gameGroup" bind:value={gameGroup}>
          {#each metadata.gameGroups as g}
            <option value={g}>{g}</option>
          {/each}
        </select>
      </div>
      <div class="form-group">
        <label for="eventType">Tapahtuma</label>
        <select id="eventType" bind:value={eventType}>
          {#each metadata.eventTypes as e}
            <option value={e}>{e}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label for="opponent">Vastustaja</label>
      <input id="opponent" type="text" bind:value={opponent} placeholder="esim. Kirkkonummi">
    </div>

    <div class="form-group">
      <span class="label-text">Tulos & Paikka</span>
      <div style="display:flex; flex-direction:column; gap:12px; padding:12px; background:#f5f5f5; border-radius:8px; border:1px solid var(--border-color);">
        <div style="display:flex; justify-content:center; gap:8px;">
          <button 
            class="toggle-btn {isHome ? 'active' : ''}" 
            style="width:auto; padding:6px 16px; margin:0; font-size:14px; background-color: {isHome ? '' : 'var(--text-sub)'}"
            onclick={() => isHome = true}
          >Koti</button>
          <button 
            class="toggle-btn {!isHome ? 'active' : ''}" 
            style="width:auto; padding:6px 16px; margin:0; font-size:14px; background-color: {!isHome ? '' : 'var(--text-sub)'}"
            onclick={() => isHome = false}
          >Vieras</button>
        </div>
        
        <div style="display:flex; align-items:center; justify-content:center; gap:12px; font-weight:bold;">
          <div style="flex:1; text-align:right; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{teamLeft}</div>
          <input type="number" bind:value={scoreHome} placeholder="-" style="width:50px; text-align:center; padding:8px;">
          <span>—</span>
          <input type="number" bind:value={scoreAway} placeholder="-" style="width:50px; text-align:center; padding:8px;">
          <div style="flex:1; text-align:left; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{teamRight}</div>
        </div>
      </div>
    </div>
  {/if}

  <button onclick={handleSend} disabled={loading}>Lisää</button>
  {#if status.msg}
    <div class="status-msg {status.type}">{status.msg}</div>
  {/if}
</div>

<style>
  label, .label-text {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 13px;
    color: var(--text-sub);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .upload-zone {
    border: 2px dashed var(--border-color);
    border-radius: var(--radius);
    padding: 16px;
    background: #fcfcfc;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .upload-zone.dragging {
    border-color: var(--primary-color);
    background: rgba(21, 112, 57, 0.05);
  }

  .upload-zone.has-file {
    border-color: var(--primary-color);
    background: #f0f7f2;
  }

  .file-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--primary-color);
    margin: 0;
  }

  .type-selector {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 20px;
  }

  @media (max-width: 400px) {
    .type-selector {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .type-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    background: #f8f9fa;
    border: 1px solid var(--border-color);
    color: var(--text-sub);
    font-size: 10px;
    font-weight: 600;
    transition: all 0.2s ease;
    margin-top: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .type-btn.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
    box-shadow: 0 4px 8px rgba(21, 112, 57, 0.2);
  }

  .type-icon {
    font-size: 18px;
  }

  .type-label {
    text-align: center;
  }

  .upload-divider {
    font-size: 11px;
    color: var(--text-sub);
    text-transform: uppercase;
    font-weight: 700;
  }

  .upload-btn {
    margin-top: 0;
    padding: 8px 16px;
    font-size: 13px;
    background-color: white;
    color: var(--text-main);
    border: 1px solid var(--border-color);
    width: auto;
  }

  .upload-btn:hover {
    background-color: #f0f0f0;
    border-color: var(--primary-color);
  }

  .upload-hint {
    font-size: 11px;
    color: var(--text-sub);
    margin: 0;
  }
</style>
