const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Controls Chromium via Puppeteer for stream playback
 */
class PlayerController {
  constructor(config, deviceId, credentials) {
    this.config = config;
    this.deviceId = deviceId;
    this.credentials = credentials;
    this.browser = null;
    this.page = null;
    this.debug = process.env.DEBUG === 'true';
    this.enableClickOverlay = process.env.SHOW_CLICK_OVERLAY !== 'false';
    this.cloudCoordinates = null;
    this.runtimeEnvironment = process.env.RUNTIME_ENV || (this.detectWSL() ? 'wsl' : 'raspberry');
  }

  detectWSL() {
    try {
      if (fs.existsSync('/proc/version')) {
        return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
      }
    } catch (_) {}
    return false;
  }

  logDebug(...args) {
    if (this.debug) console.log(...args);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async launchBrowser() {
    this.logDebug('🚀 Launching Chromium...');
    const browserConfig = this.config.browser || {};
    const resolvedExecutable = this.locateChromiumExecutable(browserConfig.executablePath);
    
    if (!resolvedExecutable) {
      throw new Error('Chromium executable not found.');
    }

    const defaultArgs = [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--kiosk', '--start-fullscreen', '--hide-scrollbars', '--disable-infobars',
      '--disable-web-security', '--autoplay-policy=no-user-gesture-required',
      '--ignore-certificate-errors', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--enable-features=VaapiVideoDecoder', '--use-gl=egl', '--ignore-gpu-blocklist'
    ];

    if (this.runtimeEnvironment === 'wsl') {
      defaultArgs.push('--disable-features=VizDisplayCompositor', '--no-zygote');
    }

    this.browser = await puppeteer.launch({
      headless: browserConfig.headless ?? false,
      defaultViewport: null,
      executablePath: resolvedExecutable,
      args: defaultArgs,
      ignoreDefaultArgs: ['--enable-automation'],
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ':0'
      }
    });

    const pages = await this.browser.pages();
    this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
    await this.page.bringToFront();
    
    await this.setupAuthHandlers();
    await this.enableClickCoordinateLogger();
    console.log('✅ Browser launched');
  }

  locateChromiumExecutable(explicitPath) {
    const candidates = [process.env.CHROMIUM_PATH, explicitPath, '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome-stable'].filter(Boolean);
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  async setupAuthHandlers() {
    if (!this.page || !this.credentials) return;
    this.page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt' && this.credentials.password) {
        await dialog.accept(this.credentials.password);
        console.log('🔐 Password dialog accepted');
      } else {
        await dialog.dismiss();
      }
    });
  }

  async enableClickCoordinateLogger() {
    if (!this.page) return;
    try {
      await this.page.exposeFunction('__veoReportClick', (p) => {
        this.logDebug(`🖱️ Click @ (${p.x}, ${p.y}) on ${p.width}x${p.height}`);
      }).catch(() => {});

      const inject = async (frame) => {
        try {
          await frame.evaluate(() => {
            if (window.__veoClickLoggerInstalled) return;
            window.__veoClickLoggerInstalled = true;
            window.addEventListener('click', (e) => {
              const data = { x: Math.round(e.clientX), y: Math.round(e.clientY), width: window.innerWidth, height: window.innerHeight };
              window.__veoReportClick && window.__veoReportClick(data);
            }, true);
          });
        } catch (_) {}
      };

      await inject(this.page.mainFrame());
      this.page.on('frameattached', inject);
    } catch (_) {}
  }

  async goToStream(streamUrl) {
    console.log(`🎬 Going to stream: ${streamUrl}`);
    await this.page.goto(streamUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Retry login detection for 5 seconds as forms often load via JS
    let isLogin = false;
    for (let i = 0; i < 10; i++) {
      isLogin = await this.isLoginPage();
      if (isLogin) break;
      await this.sleep(500);
    }

    if (isLogin) {
      console.log('🔐 Detected login page, authenticating...');
      await this.loginToVeo();
      console.log(`🎬 Returning to stream: ${streamUrl}`);
      await this.page.goto(streamUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    }

    await this.playStream();
    await this.sleep(500);
    await this.enterFullscreen();
  }

  async isLoginPage() {
    try {
      return await this.page.evaluate(() => {
        const path = (window.location.pathname || '').toLowerCase();
        const url = (window.location.href || '').toLowerCase();
        const hasEmail = !!document.querySelector('input[type="email"], input[name*="email" i], #email, input[id*="username" i]');
        const hasPassword = !!document.querySelector('input[type="password"], input[name*="password" i], #password');
        const hasAuthForm = !!document.querySelector('form[action*="login" i], form[action*="signin" i]');
        const loginMarkers = /login|signin|sign-in|authenticate/.test(path) || /login|signin/.test(url);
        return (hasEmail && hasPassword) || hasAuthForm || loginMarkers;
      });
    } catch (_) {
      return false;
    }
  }

  async loginToVeo() {
    if (!this.credentials) {
      console.log('⚠️ No credentials found, skipping login');
      return;
    }

    console.log('🔐 Starting login process...');

    try {
      // If we're not already on a login page, go to configured login URL once
      const onLoginPage = await this.page.evaluate(() => {
        const hasEmail = !!document.querySelector('input[type="email"], input[name*="email" i], #email');
        const hasPassword = !!document.querySelector('input[type="password"], input[name*="password" i], #password');
        const currentPath = window.location.pathname.toLowerCase();
        return (hasEmail && hasPassword) || currentPath.includes('login') || currentPath.includes('signin');
      });

      if (!onLoginPage) {
        const loginUrl = this.config.login?.url || 'https://live.veo.co/login';
        console.log(`🌐 Navigating to login: ${loginUrl}`);
        await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      }

      // Wait for page to fully load
      await this.sleep(2000);

      // Try to auto-accept common cookie consent banners to unblock inputs
      try {
        const accepted = await this.page.evaluate(() => {
          const matches = ['accept', 'agree', 'consent', 'allow'];
          const candidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
          for (const el of candidates) {
            const text = (el.innerText || el.value || '').toLowerCase();
            if (matches.some(m => text.includes(m))) {
              el.click();
              return true;
            }
          }
          const knownSelectors = [
            '#onetrust-accept-btn-handler',
            '.onetrust-accept-btn-handler',
            '#consent-accept',
            '.cookie-accept',
          ];
          for (const sel of knownSelectors) {
            const el = document.querySelector(sel);
            if (el) { el.click(); return true; }
          }
          return false;
        });
        if (accepted) {
          await this.sleep(500);
        }
      } catch (_) {
        // Ignore consent errors
      }

      // Find and fill login form fields
      this.logDebug('🔐 Filling login form fields...');

      // Try email field with expanded selectors
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[name*="email" i]',
        '#email'
      ];

      let emailFound = false;
      for (const sel of emailSelectors) {
        try {
          const elements = await this.page.$$(sel);
          if (elements.length > 0) {
            await elements[0].type(this.credentials.email, { delay: 100 });
            emailFound = true;
            this.logDebug(`✅ Email field found and filled: ${sel}`);
            break;
          }
        } catch (_) {}
      }

      // Try password field with expanded selectors
      const pwdSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[name*="password" i]',
        '#password'
      ];

      let pwdFound = false;
      for (const sel of pwdSelectors) {
        try {
          const elements = await this.page.$$(sel);
          if (elements.length > 0) {
            await elements[0].type(this.credentials.password, { delay: 100 });
            pwdFound = true;
            this.logDebug(`✅ Password field found and filled: ${sel}`);
            break;
          }
        } catch (_) {}
      }

      if (!emailFound || !pwdFound) {
        this.logDebug('⚠️ Could not find both email and password fields');
        return;
      }

      // Wait a bit more for form to be fully interactive after filling fields
      await this.sleep(1000);

      // Click submit button with comprehensive search and retry logic
      this.logDebug('🔘 Looking for submit button...');

      let clicked = false;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries && !clicked; attempt++) {
        this.logDebug(`🔄 Submit button attempt ${attempt}/${maxRetries}`);

        // Try standard selectors first
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button[name="login"]',
          'button[name="signin"]',
          '[data-testid*="login" i]'
        ];

        for (const sel of submitSelectors) {
          try {
            // Wait for element to be visible and clickable (not disabled)
            await this.page.waitForFunction(
              (selector) => {
                const el = document.querySelector(selector);
                return el && el.offsetParent !== null && !el.disabled &&
                       (el.type !== 'submit' || !el.form || el.form.checkValidity() !== false);
              },
              { timeout: attempt === 1 ? 5000 : 2000 }, // Shorter timeout on retries
              sel
            );

            const elements = await this.page.$$(sel);
            if (elements.length > 0) {
              // Additional check: ensure element is actually clickable
              const isClickable = await elements[0].evaluate(el =>
                !el.disabled && el.offsetParent !== null &&
                window.getComputedStyle(el).visibility !== 'hidden'
              );

              if (isClickable) {
                await elements[0].click();
                clicked = true;
                this.logDebug(`✅ Clicked submit button: ${sel} (attempt ${attempt})`);
                break;
              } else {
                this.logDebug(`⚠️ Submit button found but not clickable: ${sel} (attempt ${attempt})`);
              }
            }
          } catch (e) {
            this.logDebug(`⚠️ Submit button selector failed: ${sel} (attempt ${attempt}) - ${e.message}`);
          }
        }

        // If not clicked and not the last attempt, wait before retry
        if (!clicked && attempt < maxRetries) {
          const retryDelay = attempt * 1000; // 1s, 2s, 3s delays
          this.logDebug(`⏳ Submit button not found/clickable, retrying in ${retryDelay}ms...`);
          await this.sleep(retryDelay);
        }
      }

      // No aggressive text-search clicking; fall back to pressing Enter

      if (!clicked) {
        // Last resort: try to find the form and submit it
        try {
          const formSubmitted = await this.page.evaluate(() => {
            const form = document.querySelector('form');
            if (form && form.checkValidity()) {
              form.submit();
              return true;
            }
            // Try to find submit button within form and click it
            const submitBtn = form?.querySelector('button[type="submit"], input[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
              submitBtn.click();
              return true;
            }
            return false;
          });
          if (formSubmitted) {
            this.logDebug('✅ Submitted form directly');
            clicked = true;
          }
        } catch (e) {
          this.logDebug(`⚠️ Form submission failed: ${e.message}`);
        }
      }

      if (!clicked) {
        this.logDebug('⚠️ No submit button found, pressing Enter...');
        await this.page.keyboard.press('Enter');
      }

      // Wait for navigation or form submission with extended timeout for slow networks
      const postSubmitWait = new Promise(resolve => setTimeout(resolve, 8000)); // Increased to 8 seconds
      const navigationPromise = this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 10000 // Increased to 10 seconds
      }).catch(() => {});

      await Promise.race([navigationPromise, postSubmitWait]);
      this.logDebug(`📍 After login attempt: ${this.page.url()}`);

      // Check if we're still on a login page or if login succeeded
      const stillOnLogin = await this.page.evaluate(() => {
        const currentPath = window.location.pathname.toLowerCase();
        const hasPasswordField = !!document.querySelector('input[type="password"]');
        return currentPath.includes('login') || currentPath.includes('signin') || hasPasswordField;
      });

      if (stillOnLogin) {
        this.logDebug('⚠️ Still on login page, login may have failed');
      } else {
        this.logDebug('✅ Login appears successful - redirected away from login page');
      }

    } catch (error) {
      console.error('❌ Login error:', error.message);
      // Don't throw - continue even if login fails
    }
  }

  async waitForPlayerSurface(maxWaitMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const found = await this.page.evaluate(() => {
          return !!(document.querySelector('.veo-player-container') || document.querySelector('veo-player') || document.querySelector('video'));
        });
        if (found) return true;
      } catch (_) {}
      await this.sleep(200);
    }
    return false;
  }

  async waitForPlayerReady(maxWaitMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const ready = await this.page.evaluate(() => {
          const video = document.querySelector('video');
          return !!(video && video.readyState >= 3 && video.duration > 0);
        });
        if (ready) return true;
      } catch (_) {}
      await this.sleep(500);
    }
    return false;
  }

  async playStream() {
    console.log('▶️ Attempting to start stream playback...');
    try {
      if (await this.isLoginPage()) return;

      await this.waitForPlayerSurface(5000);
      
      if (await this.isVideoPlaying()) {
        console.log('✅ Video already playing');
        return;
      }

      await this.waitForPlayerReady(8000);
      await this.sleep(1000); // Stabilization
      
      await this.clickControl('play', 'play');
      
      await this.sleep(2000);
      if (await this.isVideoPlaying()) {
        console.log('✅ Playback successfully started');
      } else {
        console.warn('⚠️ Play click completed but video may not be playing yet');
      }
    } catch (e) {
      console.error('❌ Error starting playback:', e.message);
    }
  }

  async pauseStream() {
    console.log('⏸️ Attempting to pause stream playback...');
    try {
      if (await this.isLoginPage()) return;
      if (!(await this.isVideoPlaying())) {
        console.log('ℹ️ Already paused');
        return;
      }
      await this.clickControl('play', 'play'); // Toggle
      await this.sleep(1000);
    } catch (e) {
      console.error('❌ Error pausing playback:', e.message);
    }
  }

  async enterFullscreen() {
    console.log('🖥️ Attempting to enter fullscreen mode...');
    try {
      if (await this.isLoginPage()) return;
      await this.waitForPlayerSurface(3000);
      await this.clickControl('fullscreen', 'fullscreen');
    } catch (e) {
      console.error('❌ Error entering fullscreen:', e.message);
    }
  }

  async isVideoPlaying() {
    try {
      return await this.page.evaluate(() => {
        const v = document.querySelector('video');
        return !!(v && v.currentTime > 0 && !v.paused && !v.ended && v.readyState >= 3);
      });
    } catch (_) { return false; }
  }

  async clickControl(action, label = '') {
    const coords = await this.resolveClickCoordinates(action);
    this.logDebug(`準備点击 '${action}' at (${coords.x}, ${coords.y})`);
    
    await this.page.mouse.move(coords.x, coords.y);
    await this.showClickOverlay(coords.x, coords.y, label || action);
    await this.sleep(250);
    await this.page.mouse.click(coords.x, coords.y);
    
    this.logDebug(`🖱️ Clicked ${action} at (${coords.x}, ${coords.y})`);
  }

  async showClickOverlay(x, y, label = '') {
    if (!this.enableClickOverlay || !this.page) return;
    try {
      await this.page.evaluate((x, y, label) => {
        const id = `__veo_click_overlay_${Date.now()}`;
        const el = document.createElement('div');
        el.id = id;
        el.style.cssText = `
          position: fixed; left: ${x-12}px; top: ${y-12}px;
          width: 24px; height: 24px; border: 3px solid rgba(255,0,0,0.9);
          border-radius: 50%; background: rgba(255,0,0,0.15);
          z-index: 2147483647; pointer-events: none;
          box-shadow: 0 0 8px rgba(255,0,0,0.6);
          transition: opacity 0.4s ease, transform 0.4s ease;
        `;
        if (label) {
          const tag = document.createElement('div');
          tag.textContent = label;
          tag.style.cssText = 'position: absolute; top: 26px; left: -6px; font: bold 10px sans-serif; color: red; background: rgba(255,255,255,0.6); padding: 1px 3px; border-radius: 3px;';
          el.appendChild(tag);
        }
        document.body.appendChild(el);
        requestAnimationFrame(() => {
          el.style.transform = 'scale(1.25)';
          setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'scale(1)';
            setTimeout(() => el.remove(), 450);
          }, 350);
        });
      }, x, y, label);
    } catch (_) {}
  }

  async resolveClickCoordinates(action) {
    const width = await this.page.evaluate(() => window.innerWidth) || 1920;
    const source = this.cloudCoordinates || this.config.coordinates || {
      1280: { play: { x: 63, y: 681 }, fullscreen: { x: 1136, y: 678 } },
      1920: { play: { x: 87, y: 1032 }, fullscreen: { x: 1771, y: 1032 } },
      3840: { play: { x: 114, y: 2124 }, fullscreen: { x: 3643, y: 2122 } }
    };
    
    const bases = Object.keys(source).map(Number).sort((a,b) => Math.abs(width-a) - Math.abs(width-b));
    const bestBase = bases[0] || 1920;
    const coords = source[bestBase][action];
    const scale = width / bestBase;
    
    return { x: Math.round(coords.x * scale), y: Math.round(coords.y * scale) };
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = PlayerController;
