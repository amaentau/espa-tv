<script>
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let { onLoginSuccess } = $props();

  let email = $state('');
  let otp = $state('');
  let pin = $state('');
  let username = $state('');
  let setupToken = $state(null);
  let currentStep = $state('lookup'); // lookup, otp, setPin, login
  let status = $state({ msg: '', type: '' });
  let loading = $state(false);
  let shaking = $state(false);

  // Auto-focus logic
  $effect(() => {
    if (currentStep) {
      setTimeout(() => {
        const firstInput = document.querySelector('.card input:not([type="hidden"])');
        if (firstInput) firstInput.focus();
      }, 300); // Wait for transition
    }
  });

  const setStatus = (msg, type = 'error') => {
    status = { msg, type };
    if (type === 'error') {
      shaking = true;
      setTimeout(() => shaking = false, 500);
    }
  };

  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  async function handleLookup() {
    if (!validateEmail(email)) {
      return setStatus('Anna kelvollinen sähköpostiosoite');
    }
    loading = true;
    setStatus('Tarkistetaan...', 'info');
    try {
      const res = await fetch('/auth/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.exists) {
        currentStep = 'login';
        setStatus('');
      } else {
        await sendOtp();
      }
    } catch (err) {
      setStatus('Palvelimeen ei saada yhteyttä.');
    } finally {
      loading = false;
    }
  }

  async function sendOtp() {
    setStatus('Lähetetään koodia...', 'info');
    try {
      const res = await fetch('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error();
      currentStep = 'otp';
      setStatus('');
    } catch (err) {
      setStatus('Virhe koodin lähetyksessä.');
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) return setStatus('Koodin on oltava 6 numeroa');
    loading = true;
    try {
      const res = await fetch('/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setupToken = data.setupToken;
      currentStep = 'setPin';
      setStatus('');
    } catch (err) {
      setStatus(err.message || 'Väärä koodi');
    } finally {
      loading = false;
    }
  }

  async function handleSetPin() {
    if (username.length < 3) return setStatus('Käyttäjänimen on oltava vähintään 3 merkkiä');
    if (pin.length !== 4) return setStatus('PIN-koodin on oltava 4 numeroa');
    loading = true;

    // Get or generate device ID
    let deviceId = localStorage.getItem('espa_device_id');
    if (!deviceId) {
      deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('espa_device_id', deviceId);
    }

    try {
      const res = await fetch('/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, setupToken, username, deviceId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.isApproved === false) {
        setStatus('Tili luotu! Ylläpitäjän on vielä hyväksyttävä tilisi ennen käyttöä.', 'info');
        currentStep = 'lookup';
        email = '';
        pin = '';
        username = '';
      } else {
        onLoginSuccess(data);
      }
    } catch (err) {
      setStatus(err.message || 'Virhe tallennuksessa');
    } finally {
      loading = false;
    }
  }

  async function handleLogin() {
    if (pin.length !== 4) return setStatus('Syötä 4-numeroinen PIN');
    loading = true;

    // Get or generate device ID
    let deviceId = localStorage.getItem('espa_device_id');
    if (!deviceId) {
      deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('espa_device_id', deviceId);
    }

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin, deviceId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLoginSuccess(data);
    } catch (err) {
      setStatus(err.message || 'Kirjautuminen epäonnistui');
      pin = '';
    } finally {
      loading = false;
    }
  }
</script>

<div class="container" in:fade={{ duration: 800 }}>
  <header class="auth-header" in:fly={{ y: -20, duration: 1000, delay: 200, easing: cubicOut }}>
    <img src="/logo.png" alt="EsPa Logo" class="auth-logo">
  </header>

  <div class="card {shaking ? 'shake' : ''}" class:loading-overlay={loading}>
    {#if currentStep === 'lookup'}
      <div in:fly={{ x: 20, duration: 400, delay: 200 }} out:fly={{ x: -20, duration: 200 }}>
        <div class="form-group floating">
          <input id="authEmail" type="email" bind:value={email} placeholder=" " required>
          <label for="authEmail">Sähköposti</label>
          <p class="help-text">Aloita käyttö tai kirjaudu sähköpostiosoitteella</p>
        </div>
        <button onclick={handleLookup} disabled={loading} class="primary-btn">
          {#if loading}
            <span class="spinner"></span>
          {:else}
            Jatka
          {/if}
        </button>
      </div>

    {:else if currentStep === 'otp'}
      <div in:fly={{ x: 20, duration: 400, delay: 200 }} out:fly={{ x: -20, duration: 200 }}>
        <p class="step-info">
          Lähetimme vahvistuskoodin osoitteeseen <strong>{email}</strong>
        </p>
        <div class="form-group floating">
          <input id="authOtp" type="text" class="pin-input" bind:value={otp} placeholder=" " maxlength="6" required>
          <label for="authOtp">Vahvistuskoodi (6 numeroa)</label>
        </div>
        <button onclick={handleVerifyOtp} disabled={loading} class="primary-btn">
          {#if loading}
            <span class="spinner"></span>
          {:else}
            Vahvista
          {/if}
        </button>
        <button class="link-btn" onclick={() => { currentStep = 'lookup'; setStatus(''); }}>Vaihda sähköposti</button>
      </div>

    {:else if currentStep === 'setPin'}
      <div in:fly={{ x: 20, duration: 400, delay: 200 }} out:fly={{ x: -20, duration: 200 }}>
        <p class="step-info">Luo uusi 4-numeroinen PIN-koodi.</p>
        <div class="form-group floating">
          <input id="authUsername" type="text" bind:value={username} placeholder=" " minlength="3" required>
          <label for="authUsername">Käyttäjänimi</label>
        </div>
        <div class="form-group floating">
          <input id="authSetPin" type="password" class="pin-input" bind:value={pin} placeholder=" " maxlength="4" required>
          <label for="authSetPin">Uusi PIN</label>
        </div>
        <button onclick={handleSetPin} disabled={loading} class="primary-btn">
          {#if loading}
            <span class="spinner"></span>
          {:else}
            Tallenna ja kirjaudu
          {/if}
        </button>
      </div>

    {:else if currentStep === 'login'}
      <div in:fly={{ x: 20, duration: 400, delay: 200 }} out:fly={{ x: -20, duration: 200 }}>
        <p class="step-info">Tervetuloa takaisin, <strong>{email}</strong></p>
        <div class="form-group floating">
          <input id="authLoginPin" type="password" class="pin-input" bind:value={pin} placeholder=" " maxlength="4" required>
          <label for="authLoginPin">Syötä PIN-koodi</label>
        </div>
        <button onclick={handleLogin} disabled={loading} class="primary-btn">
          {#if loading}
            <span class="spinner"></span>
          {:else}
            Kirjaudu
          {/if}
        </button>
        <div class="btn-group">
          <button class="link-btn" onclick={sendOtp}>Unohdin PIN-koodin</button>
          <button class="link-btn" onclick={() => { currentStep = 'lookup'; setStatus(''); }}>Vaihda käyttäjää</button>
        </div>
      </div>
    {/if}

    {#if status.msg}
      <div class="status-msg {status.type}" aria-live="polite">
        {status.msg}
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    position: relative;
    z-index: 1;
  }

  /* Glassmorphism Card */
  .card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .card.loading-overlay::after {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255, 255, 255, 0.3);
    pointer-events: none;
    z-index: 10;
  }

  .auth-header {
    text-align: center;
    margin-bottom: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .auth-logo {
    height: 180px;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
  }

  .step-info {
    text-align: center;
    margin-bottom: 24px;
    color: var(--text-main);
    font-size: 15px;
    line-height: 1.5;
  }

  /* Floating Labels */
  .form-group.floating {
    position: relative;
    margin-bottom: 24px;
  }

  .form-group.floating input {
    height: 56px;
    padding: 20px 16px 6px;
    background: rgba(255, 255, 255, 0.5);
    border: 1.5px solid rgba(0, 0, 0, 0.08);
    font-size: 16px;
  }

  .form-group.floating label {
    position: absolute;
    top: 18px;
    left: 16px;
    font-size: 16px;
    color: var(--text-sub);
    pointer-events: none;
    transition: all 0.2s ease;
    text-transform: none;
    letter-spacing: normal;
    font-weight: 400;
  }

  .form-group.floating input:focus ~ label,
  .form-group.floating input:not(:placeholder-shown) ~ label {
    top: 8px;
    left: 16px;
    font-size: 12px;
    font-weight: 700;
    color: var(--primary-color);
  }

  .form-group.floating input:focus {
    background: #fff;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 4px rgba(21, 112, 57, 0.1);
  }

  .help-text {
    font-size: 12px;
    color: var(--text-sub);
    margin-top: 6px;
    margin-left: 4px;
    opacity: 0.8;
  }

  /* Primary Button Enhancements */
  .primary-btn {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }

  .primary-btn:active {
    transform: scale(0.98);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Shake Animation */
  .shake {
    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
  }

  @keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
  }

  .btn-group {
    display: flex;
    flex-direction: column;
    margin-top: 12px;
  }

  .status-msg {
    margin-top: 16px;
    padding: 10px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
  }

  .status-msg.error {
    background: rgba(209, 52, 56, 0.1);
    color: #d13438;
  }

  .status-msg.info {
    background: rgba(21, 112, 57, 0.1);
    color: var(--primary-color);
  }

  :global(body) {
    overflow: hidden;
  }

  .bg-animation {
    position: fixed;
    top: -50%;
    left: -50%;
    right: -50%;
    bottom: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at 50% 50%, rgba(21, 112, 57, 0.05), transparent 40%),
                radial-gradient(circle at 20% 80%, rgba(252, 227, 84, 0.05), transparent 40%);
    animation: aurora 20s linear infinite;
    z-index: 0;
    pointer-events: none;
  }

  @keyframes aurora {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>

<div class="bg-animation"></div>

