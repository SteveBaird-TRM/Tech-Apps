// Top-left tab strip linking the four key apps (Intake, Roadmap, Schedule A,
// Comparison). Single shared file served from the site root; each page adds
//   <script src="/app-tabs.js"></script>
// after auth-gate.js. The strip sits in the same 34px band as auth-gate's
// email/Sign out bar (which stays on the right).
//
// Pages that don't already reserve 34px at the top (admin, schedule-a) add
// the data-push attribute so the page content is moved down to make room:
//   <script src="/app-tabs.js" data-push></script>
(() => {
  // Don't show inside iframes (embedded views).
  if (window.top !== window) return;

  const push = document.currentScript && document.currentScript.hasAttribute('data-push');

  const TABS = [
    { label: 'Intake',     href: '/intake/index.html',     match: '/intake/' },
    { label: 'Roadmap',    href: '/roadmap/index.html',    match: '/roadmap/' },
    { label: 'Schedule A', href: '/schedule-a/index.html', match: '/schedule-a/' },
    { label: 'Comparison', href: '/comparison/index.html', match: '/comparison/' },
  ];

  const style = document.createElement('style');
  style.textContent = `
    :root { --app-tabs-bg: #EAEDF1; --app-tabs-line: #9aa0ab; --app-tabs-text: #4a4f5a;
      --app-tabs-idle: rgba(255,255,255,.55); --app-tabs-active: #fff; }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) { --app-tabs-bg: #14171C; --app-tabs-line: #3a4050; --app-tabs-text: #b8bec9;
        --app-tabs-idle: rgba(255,255,255,.05); --app-tabs-active: #1C2027; }
    }
    :root[data-theme="dark"] { --app-tabs-bg: #14171C; --app-tabs-line: #3a4050; --app-tabs-text: #b8bec9;
      --app-tabs-idle: rgba(255,255,255,.05); --app-tabs-active: #1C2027; }
    #app-tabs { position: fixed; top: 0; left: 0; right: 0; height: 34px; z-index: 999997;
      display: flex; align-items: flex-end; gap: 0; padding: 0 0 0 12px; box-sizing: border-box;
      background: var(--app-tabs-bg);
      font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #app-tabs a { display: block; box-sizing: border-box; height: 30px; line-height: 29px; padding: 0 18px;
      min-width: 90px; text-align: center; text-decoration: none; color: var(--app-tabs-text);
      background: var(--app-tabs-idle); border: 1px solid var(--app-tabs-line); border-bottom: none;
      border-radius: 9px 9px 0 0; margin-right: -1px; white-space: nowrap; }
    #app-tabs a:hover { background: var(--app-tabs-active); }
    #app-tabs a.active { background: var(--app-tabs-active);
      position: relative; z-index: 1; }
    /* Let the auth bar (email / Sign out) sit on the strip instead of on its own white box. */
    #auth-gate-bar { background: transparent !important; backdrop-filter: none !important; }
    html.embed-mode #app-tabs { display: none; }
    @media print { #app-tabs { display: none; } }
    @media (max-width: 640px) { #app-tabs a { min-width: 0; padding: 0 10px; font-size: 13px; } }
  `;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.id = 'app-tabs';
  nav.setAttribute('aria-label', 'Apps');
  const path = location.pathname;
  TABS.forEach(({ label, href, match }) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (path.indexOf(match) === 0) { a.className = 'active'; a.setAttribute('aria-current', 'page'); }
    nav.appendChild(a);
  });
  document.body.appendChild(nav);

  if (push) {
    const pt = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    document.body.style.paddingTop = (pt + 34) + 'px';
  }
})();
