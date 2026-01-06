<script>
  let { metadata, targetDeviceIds, token, onEntryAdded } = $props();

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
    if (targetDeviceIds.length === 0) return setStatus('Valitse vähintään yksi laite');
    if (!videoUrl) return setStatus('Syötä videon osoite');

    loading = true;
    setStatus('Lähetetään...', 'info');

    let successCount = 0;
    let errors = [];

    const finalTitle = videoTitle.trim() || `${gameGroup} vs ${opponent || '???'}`;

    for (const deviceId of targetDeviceIds) {
      try {
        const res = await fetch('/entry', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            key: deviceId, 
            value1: videoUrl, 
            value2: finalTitle,
            gameGroup,
            eventType,
            opponent,
            isHome,
            scoreHome,
            scoreAway
          })
        });

        if (!res.ok) throw new Error((await res.json()).error || 'Virhe');
        successCount++;
      } catch (err) {
        errors.push(`${deviceId}: ${err.message}`);
      }
    }

    if (successCount > 0) {
      setStatus(`Lisätty onnistuneesti ${successCount} laitteelle!`, 'success');
      videoUrl = '';
      opponent = '';
      scoreHome = '';
      scoreAway = '';
      onEntryAdded();
    }

    if (errors.length > 0) {
      alert("Joitakin virheitä tapahtui:\n" + errors.join("\n"));
    }
    loading = false;
  }

  const teamLeft = $derived(isHome ? gameGroup : (opponent || 'Vastustaja'));
  const teamRight = $derived(isHome ? (opponent || 'Vastustaja') : gameGroup);

  $effect(() => {
    if (gameGroup) localStorage.setItem('espa_last_group', gameGroup);
  });
</script>

<div>
  <div class="form-group">
    <label for="videoUrl">Videon osoite (URL)</label>
    <input id="videoUrl" type="url" bind:value={videoUrl} placeholder="https://youtube.com/...">
  </div>

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
    <label>Tulos & Paikka</label>
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

  <button onclick={handleSend} disabled={loading}>Lisää soittolistalle</button>
  {#if status.msg}
    <div class="status-msg {status.type}">{status.msg}</div>
  {/if}
</div>

