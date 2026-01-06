<script>
  let { email, onLogout } = $props();
</script>

<header class="app-header">
  <img src="/logo.png" alt="EsPa Logo" class="logo" style="height:60px;">
  <h1 style="font-size:24px;">ESPA TV</h1>
</header>

<div class="user-info">
  Kirjautuneena: <span>{email}</span>
  <span class="logout-btn" onclick={onLogout}>Kirjaudu ulos</span>
</div>

