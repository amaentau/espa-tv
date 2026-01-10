import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

// Register Service Worker for media caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.error('SW registration failed', err));
  });
}

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;

