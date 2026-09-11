/* shared-layout.js — injects sidebar + header into every page */

const SIDEBAR_HTML = `
<aside class="sidebar">
  <div class="sidebar-logo">
    <div class="logo-icon">🛡️</div>
    <div class="logo-text">Women Safety<br>Analytics</div>
  </div>

  <nav class="sidebar-nav">
    <div class="nav-section-label">Main</div>
    <a class="nav-item" data-page="dashboard.html" href="dashboard.html">
      <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      Dashboard
    </a>
    <a class="nav-item" data-page="live-monitoring.html" href="live-monitoring.html">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
      Live Monitoring
    </a>
    <a class="nav-item" data-page="alerts.html" href="alerts.html">
      <svg viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      Alerts
      <span class="nav-badge">12</span>
    </a>

    <div class="nav-section-label" style="margin-top:8px;">Investigation</div>
    <a class="nav-item" data-page="incidents.html" href="incidents.html">
      <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      Incidents
    </a>
    <a class="nav-item" data-page="hotspots.html" href="hotspots.html">
      <svg viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Hotspots
    </a>

    <div class="nav-section-label" style="margin-top:8px;">System</div>
    <a class="nav-item" data-page="analytics.html" href="analytics.html">
      <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      Analytics &amp; Reports
    </a>
    <a class="nav-item" data-page="cameras.html" href="cameras.html">
      <svg viewBox="0 0 24 24" fill="none"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
      CCTV Cameras
    </a>
    <a class="nav-item" data-page="users.html" href="users.html">
      <svg viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Users
    </a>
    <a class="nav-item" data-page="settings.html" href="settings.html">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Settings
    </a>
  </nav>

  <div class="sidebar-footer">
    <a class="sidebar-profile" href="settings.html">
      <div class="avatar">AP</div>
      <div class="profile-info">
        <div class="profile-name">Admin Priya</div>
        <div class="profile-role">Super Admin</div>
      </div>
    </a>
    <a class="nav-item" href="index.html" style="margin-top:4px;color:#EF4444;">
      <svg viewBox="0 0 24 24" fill="none" style="stroke:#EF4444;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Logout
    </a>
  </div>
</aside>
`;

const HEADER_HTML = (title, sub) => `
<header class="top-header">
  <div class="flex-center gap-12">
    <button class="icon-btn mobile-menu-btn" id="mobile-menu-btn" title="Menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div class="header-left">
      <h1>${title}</h1>
      <p>${sub}</p>
    </div>
  </div>
  <div class="header-right">
    <div class="header-datetime" id="live-clock"></div>
    <button class="icon-btn" title="Notifications" onclick="location.href='alerts.html'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span class="dot"></span>
    </button>
    <a class="sidebar-profile" href="settings.html" style="padding:6px 8px;border-radius:8px;border:1px solid #E5E7EB;display:flex;align-items:center;gap:8px;">
      <div class="avatar" style="width:30px;height:30px;font-size:11px;">AP</div>
      <div class="profile-info" style="display:none;"></div>
    </a>
  </div>
</header>
`;

// Inject sidebar into document
document.addEventListener('DOMContentLoaded', () => {
  // Insert sidebar before .main-area
  const shell = document.querySelector('.app-shell');
  if (shell) {
    shell.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);
    const mainArea = shell.querySelector('.main-area');
    if (mainArea) {
      const page = document.body.dataset.page || '';
      const sub  = document.body.dataset.sub  || '';
      mainArea.insertAdjacentHTML('afterbegin', HEADER_HTML(page, sub));
    }
  }

  // Set active nav
  const cur = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    if (el.dataset.page === cur) el.classList.add('active');
  });

  // Mobile menu
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar  = document.querySelector('.sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) sidebar.classList.remove('open');
    });
  }

  // Clock
  function tick() {
    const el = document.getElementById('live-clock');
    if (!el) return;
    const now  = new Date();
    const date = now.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
    const time = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    el.innerHTML = `<strong>${time}</strong>${date}`;
  }
  setInterval(tick, 1000); tick();
});
