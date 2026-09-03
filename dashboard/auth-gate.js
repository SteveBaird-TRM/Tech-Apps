// Shared login gate for all claude-projects apps. Identical copy lives in
// every project directory (comparison, dashboard, implementation-forum, intake,
// roadmap-db, schedule-a-db-v2) since these are plain static sites with no
// shared build step.
//
// Each page sets window.AUTH_REQUIREMENTS before this script runs, e.g.:
//   window.AUTH_REQUIREMENTS = [{ project: 'roadmap-db', role: 'viewer' }];
// A page may require access to more than one project (comparison needs
// both roadmap-db and schedule-a-db-v2).
//
// Provides:
//   window.sbClient        - the one Supabase client the whole page should use
//   window.currentAccess   - { [project_key]: 'viewer' | 'editor' } for the signed-in user
//   window.onAuthReady(cb) - cb runs once, the first time the signed-in user
//                            satisfies AUTH_REQUIREMENTS. App scripts should
//                            call this instead of initializing on their own.
(() => {
  const SUPABASE_URL = 'https://aczahhxneshsrnqsezzg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_96Tlee7wEiFYANeoIcD69Q_RT1EOma2';

  // Force re-login this many days after the user's last password sign-in
  // (Supabase's own session/inactivity timeout setting isn't available on our plan).
  const MAX_SESSION_AGE_DAYS = 14;
  const MAX_SESSION_AGE_MS = MAX_SESSION_AGE_DAYS * 24 * 60 * 60 * 1000;

  const requirements = window.AUTH_REQUIREMENTS || [];
  const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.sbClient = sbClient;
  window.currentAccess = {};

  let readyCallback = null;
  let readyFired = false;
  window.onAuthReady = function (cb) {
    readyCallback = cb;
    if (readyFired) cb();
  };

  const style = document.createElement('style');
  style.textContent = `
    #auth-gate-overlay { position: fixed; inset: 0; z-index: 999999; display: flex;
      align-items: center; justify-content: center; background: #12131a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #auth-gate-card { background: #1c1e27; color: #e6e8ec; border-radius: 12px;
      padding: 32px 28px; width: 320px; max-width: calc(100vw - 40px);
      box-shadow: 0 10px 40px rgba(0,0,0,.4); }
    #auth-gate-card h1 { font-family: Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif; font-size: 18px; margin: 0 0 4px; font-weight: 400; letter-spacing: 0.2px; }
    #auth-gate-card p.sub { font-size: 12px; color: #9aa0ab; margin: 0 0 14px; }
    #auth-gate-card label { display: block; font-size: 12px; color: #9aa0ab; margin: 12px 0 4px; }
    #auth-gate-card input { width: 100%; box-sizing: border-box; padding: 9px 10px;
      border-radius: 7px; border: 1px solid #33364a; background: #12131a; color: #e6e8ec; font-size: 14px; }
    #auth-gate-card input:focus { outline: none; border-color: #5b8cff; }
    #auth-gate-card button { margin-top: 18px; width: 100%; padding: 10px; border: none;
      border-radius: 7px; background: #5b8cff; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
    #auth-gate-card button:disabled { opacity: .6; cursor: default; }
    #auth-gate-error { color: #ff6b6b; font-size: 13px; margin-top: 12px; min-height: 16px; }
    #auth-gate-bar { position: fixed; top: 0; right: 0; z-index: 999998; display: flex;
      align-items: center; gap: 10px; padding: 7px 14px; font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #6b7280; background: rgba(255,255,255,.85); backdrop-filter: blur(4px); border-bottom-left-radius: 8px; }
    #auth-gate-bar button { border: 1px solid #d0d3d9; background: #fff; border-radius: 6px;
      padding: 3px 9px; font-size: 11px; cursor: pointer; color: #333; }
  `;
  document.head.appendChild(style);

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'auth-gate-overlay';
    overlay.innerHTML = `
      <div id="auth-gate-card">
        <h1>Sign in</h1>
        <p class="sub"></p>
        <form id="auth-gate-form">
          <label>Email</label>
          <input type="email" id="auth-gate-email" autocomplete="username" required />
          <label>Password</label>
          <input type="password" id="auth-gate-password" autocomplete="current-password" required />
          <button type="submit" id="auth-gate-submit">Sign in</button>
          <div id="auth-gate-error"></div>
        </form>
      </div>`;
    return overlay;
  }

  function showOverlay(message) {
    let overlay = document.getElementById('auth-gate-overlay');
    if (!overlay) {
      overlay = buildOverlay();
      document.body.appendChild(overlay);
      overlay.querySelector('#auth-gate-form').addEventListener('submit', onSubmit);
    }
    overlay.querySelector('#auth-gate-error').textContent = message || '';
  }

  function hideOverlay() {
    const overlay = document.getElementById('auth-gate-overlay');
    if (overlay) overlay.remove();
  }

  function showBar(email) {
    if (document.getElementById('auth-gate-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'auth-gate-bar';
    bar.innerHTML = `<span>${email}</span><button id="auth-gate-signout">Sign out</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#auth-gate-signout').addEventListener('click', () => sbClient.auth.signOut());
  }

  function hideBar() {
    const bar = document.getElementById('auth-gate-bar');
    if (bar) bar.remove();
  }

  function onSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-gate-email').value.trim();
    const password = document.getElementById('auth-gate-password').value;
    const btn = document.getElementById('auth-gate-submit');
    showOverlay('');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    sbClient.auth.signInWithPassword({ email, password }).then(({ error }) => {
      btn.disabled = false;
      btn.textContent = 'Sign in';
      if (error) showOverlay(error.message);
    });
  }

  async function checkAccess() {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) {
      hideBar();
      window.currentAccess = {};
      showOverlay();
      return;
    }

    const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
    if (Date.now() - lastSignInAt > MAX_SESSION_AGE_MS) {
      await sbClient.auth.signOut();
      hideBar();
      window.currentAccess = {};
      showOverlay('Your session has expired. Please sign in again.');
      return;
    }

    const { data, error } = await sbClient
      .from('project_access')
      .select('project_key, role')
      .eq('user_id', user.id);

    if (error) {
      showOverlay('Could not verify access: ' + error.message);
      return;
    }

    const access = {};
    (data || []).forEach((row) => { access[row.project_key] = row.role; });
    window.currentAccess = access;

    const missing = requirements.some(({ project, role }) => {
      const have = access[project];
      if (!have) return true;
      if (role === 'editor' && have !== 'editor') return true;
      return false;
    });

    if (missing) {
      showBar(user.email);
      showOverlay(`Signed in as ${user.email}, but you don't have access to this page. Contact an admin to be granted access.`);
      return;
    }

    hideOverlay();
    showBar(user.email);
    if (!readyFired) {
      readyFired = true;
      if (readyCallback) readyCallback();
    }
  }

  sbClient.auth.onAuthStateChange(() => { checkAccess(); });
  checkAccess();
})();
