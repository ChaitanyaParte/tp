/* ============================================================
   WOMEN SAFETY ANALYTICS — SHARED JS
   ============================================================ */

/* ── Clock ── */
function updateClock() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  el.innerHTML = `<strong>${time}</strong>${date}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ── Active nav link ── */
(function() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    if (el.dataset.page === page) el.classList.add('active');
  });
})();

/* ── Mobile sidebar toggle ── */
const menuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
if (menuBtn && sidebar) {
  menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) sidebar.classList.remove('open');
  });
}

/* ── Detail panel ── */
function openPanel(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('show');
}
function closePanel(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('show');
}
// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('show'); });
});

/* ── Toast ── */
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.innerHTML = `<span>${msg}</span>`;
  Object.assign(t.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
    background: type === 'success' ? '#22C55E' : type === 'error' ? '#EF4444' : '#6C4CE8',
    color: '#fff', padding: '12px 20px', borderRadius: '8px',
    fontSize: '13.5px', fontWeight: '600', boxShadow: '0 4px 20px rgba(0,0,0,.15)',
    opacity: '0', transform: 'translateY(8px)', transition: 'all .2s ease', fontFamily: 'Inter, sans-serif'
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; }, 10);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, 2800);
}

/* ================================================================
   CANVAS CAMERA SIMULATOR
   Draws a believable CCTV-like feed with bounding boxes.
   ================================================================ */
const PEOPLE_DATA = [
  { label: 'Woman', x: .18, y: .25, w: .09, h: .48, color: '#6C4CE8', conf: 97 },
  { label: 'Man',   x: .36, y: .28, w: .08, h: .42, color: '#3B82F6', conf: 94 },
  { label: 'Man',   x: .52, y: .30, w: .08, h: .40, color: '#3B82F6', conf: 91 },
  { label: 'Woman', x: .70, y: .24, w: .09, h: .50, color: '#6C4CE8', conf: 89 },
];

function drawCameraFeed(canvas, options = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.offsetWidth  || 640;
  const H = canvas.height = canvas.offsetHeight || 360;

  function draw() {
    // Dark background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#10101A');
    bg.addColorStop(1, '#0A0A12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Ground plane
    ctx.fillStyle = 'rgba(255,255,255,.028)';
    ctx.beginPath();
    ctx.moveTo(0, H * .72);
    ctx.lineTo(W, H * .72);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Perspective lines
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W * i / 6, H * .72);
      ctx.lineTo(W / 2, H * .28 + Math.sin(Date.now() / 4000 + i) * 2);
      ctx.stroke();
    }

    // Draw people bounding boxes
    const people = options.people || PEOPLE_DATA;
    people.forEach(p => {
      const px = p.x * W, py = p.y * H, pw = p.w * W, ph = p.h * H;

      /* box */
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, pw, ph);

      /* corner ticks */
      const tick = 8;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      [[px, py], [px + pw, py], [px, py + ph], [px + pw, py + ph]].forEach(([cx, cy], i) => {
        ctx.beginPath();
        const dx = i % 2 === 1 ? -tick : tick;
        const dy = i < 2 ? tick : -tick;
        ctx.moveTo(cx, cy + dy); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx, cy);
        ctx.stroke();
      });

      /* label bg */
      ctx.fillStyle = p.color;
      const labelH = 17, labelPad = 6;
      const labelText = `${p.label}  ${p.conf}%`;
      ctx.font = '600 10px Inter, sans-serif';
      const tw = ctx.measureText(labelText).width + labelPad * 2;
      ctx.beginPath();
      ctx.roundRect(px, py - labelH - 2, tw, labelH, 3);
      ctx.fill();

      /* label text */
      ctx.fillStyle = '#fff';
      ctx.fillText(labelText, px + labelPad, py - labelH / 2 + 2);
    });

    // Timestamp overlay
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '500 11px monospace';
    const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
    ctx.fillText(`REC  ${ts}   CAM-${options.camId || '01'}`, 12, H - 12);

    // Scan line effect
    const scanY = ((Date.now() / 18) % H);
    ctx.fillStyle = 'rgba(255,255,255,.018)';
    ctx.fillRect(0, scanY, W, 2);

    // Noise / grain overlay (subtle)
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * .018})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }
  loop();
}

/* ================================================================
   DONUT CHART (Canvas)
   ================================================================ */
function drawDonut(canvas, segments) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = 140;
  canvas.width = S; canvas.height = S;
  const cx = S / 2, cy = S / 2, R = 56, r = 36;
  let startAngle = -Math.PI / 2;
  const total = segments.reduce((a, s) => a + s.value, 0);
  segments.forEach(seg => {
    const angle = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    startAngle += angle;
  });
  // Hole
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  // Center text
  ctx.fillStyle = '#171923';
  ctx.font = '700 20px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.font = '500 10px Inter, sans-serif';
  ctx.fillStyle = '#6B7280';
  ctx.fillText('Total', cx, cy + 10);
}

/* ================================================================
   LINE / BAR CHART (CANVAS)
   ================================================================ */
function drawLineChart(canvas, data, options = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.offsetWidth  || 500;
  const H = canvas.height = canvas.offsetHeight || 200;

  ctx.clearRect(0, 0, W, H);
  const px = 40, py = 20, pw = W - px - 10, ph = H - py - 30;
  const max = Math.max(...data.map(d => d.value)) * 1.15 || 10;
  const step = pw / (data.length - 1);

  // Grid lines
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = py + ph - (ph * i / 4);
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke();
    ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max * i / 4), px - 4, y + 4);
  }

  // X axis labels
  ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
  data.forEach((d, i) => {
    ctx.fillText(d.label, px + i * step, H - 8);
  });

  // Area fill
  const grad = ctx.createLinearGradient(0, py, 0, py + ph);
  grad.addColorStop(0, options.color ? options.color + '28' : '#6C4CE828');
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = px + i * step;
    const y = py + ph - (d.value / max * ph);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(px + (data.length - 1) * step, py + ph);
  ctx.lineTo(px, py + ph);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = options.color || '#6C4CE8';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  data.forEach((d, i) => {
    const x = px + i * step;
    const y = py + ph - (d.value / max * ph);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  data.forEach((d, i) => {
    const x = px + i * step;
    const y = py + ph - (d.value / max * ph);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = options.color || '#6C4CE8';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function drawBarChart(canvas, data, options = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.offsetWidth  || 500;
  const H = canvas.height = canvas.offsetHeight || 200;
  ctx.clearRect(0, 0, W, H);
  const px = 44, py = 16, pw = W - px - 12, ph = H - py - 28;
  const max = Math.max(...data.map(d => d.value)) * 1.15 || 10;
  const barW = (pw / data.length) * 0.52;

  // Grid
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = py + ph - (ph * i / 4);
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke();
    ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max * i / 4), px - 4, y + 4);
  }

  // Bars
  data.forEach((d, i) => {
    const x = px + (pw / data.length) * i + (pw / data.length - barW) / 2;
    const bh = (d.value / max) * ph;
    const y = py + ph - bh;
    const grad = ctx.createLinearGradient(0, y, 0, py + ph);
    grad.addColorStop(0, d.color || (options.color || '#6C4CE8'));
    grad.addColorStop(1, (d.color || options.color || '#6C4CE8') + '80');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, [4, 4, 0, 0]);
    ctx.fill();

    // X label
    ctx.fillStyle = '#9CA3AF'; ctx.font = '9.5px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, H - 8);
  });
}
