<script>
  import { onMount } from 'svelte';
  import Auth from './components/Auth.svelte';
  import MainApp from './components/MainApp.svelte';

  let authState = $state({
    token: localStorage.getItem('espa_token'),
    userEmail: localStorage.getItem('espa_email'),
    isAdmin: localStorage.getItem('espa_is_admin') === 'true',
    userGroup: localStorage.getItem('espa_user_group'),
    metadata: { gameGroups: [], eventTypes: [] }
  });

  const handleLoginSuccess = (data) => {
    authState.token = data.token;
    authState.userEmail = data.email;
    authState.isAdmin = data.isAdmin;
    authState.userGroup = data.userGroup;
    
    localStorage.setItem('espa_token', data.token);
    localStorage.setItem('espa_email', data.email);
    localStorage.setItem('espa_is_admin', data.isAdmin);
    if (data.userGroup) localStorage.setItem('espa_user_group', data.userGroup);
    else localStorage.removeItem('espa_user_group');
  };

  const logout = () => {
    authState.token = null;
    authState.userEmail = null;
    authState.isAdmin = false;
    authState.userGroup = null;
    localStorage.removeItem('espa_token');
    localStorage.removeItem('espa_email');
    localStorage.removeItem('espa_is_admin');
    localStorage.removeItem('espa_user_group');
  };
</script>

<main>
  {#if !authState.token}
    <Auth onLoginSuccess={handleLoginSuccess} />
  {:else}
    <MainApp {authState} onLogout={logout} />
  {/if}
</main>

<style>
  main {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100%;
  }
</style>

