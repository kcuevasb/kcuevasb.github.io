'use strict';

function isMobile(){ return window.matchMedia('(max-width: 768px)').matches; }

/* ============ BIOS / boot ============ */
(function boot(){
  const bios = document.getElementById('bios');
  const biosText = document.getElementById('bios-text');
  const desktop = document.getElementById('desktop');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const lines = [
    'Kepa-CV BIOS v9.8.0',
    'CPU: Coffee-Fueled Backend Engineer @ 100% Java',
    'Memory Test: 640K esperientzia... OK',
    'Gailuak detektatzen: Spring Boot, Kafka, Kubernetes... OK',
    'MS-DOS kargatzen... prest.',
    '',
    'Windows 98 abiarazten...'
  ];

  function finish(){
    bios.classList.add('hide');
    desktop.hidden = false;
    document.removeEventListener('keydown', finish);
    document.removeEventListener('click', finish);
    setTimeout(showBalloon, 1200);
  }

  if (reduceMotion){ finish(); return; }

  document.addEventListener('keydown', finish);
  document.addEventListener('click', finish);

  let li = 0, ci = 0, out = '';
  const timer = setInterval(() => {
    if (li >= lines.length){ clearInterval(timer); setTimeout(finish, 500); return; }
    const line = lines[li];
    if (ci < line.length){ out += line[ci]; ci++; }
    else { out += '\n'; li++; ci = 0; }
    biosText.textContent = out;
  }, 14);
})();

function showBalloon(){
  const b = document.getElementById('balloon');
  b.hidden = false;
  document.getElementById('balloon-x').addEventListener('click', () => b.hidden = true);
  setTimeout(() => { b.hidden = true; }, 9000);
}

/* ============ Clock ============ */
(function clock(){
  const el = document.getElementById('clock');
  function tick(){
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    el.textContent = `${h}:${m}`;
  }
  tick();
  setInterval(tick, 15000);
})();

/* ============ Window manager ============ */
(function windowManager(){
  const wins = Array.from(document.querySelectorAll('.win'));
  const tasksBar = document.getElementById('taskbar-tasks');
  let zTop = 10;

  function taskButtonFor(win){
    return tasksBar.querySelector(`[data-for="${win.id}"]`);
  }

  function bringToFront(win){
    wins.forEach(w => w.classList.remove('active'));
    win.classList.add('active');
    zTop += 1;
    win.style.zIndex = zTop;
    tasksBar.querySelectorAll('.task-btn').forEach(b => b.classList.toggle('active', b.dataset.for === win.id));
  }

  function openWindow(id){
    const win = document.getElementById('win-' + id);
    if (!win) return;
    if (win.hidden){
      win.hidden = false;
      ensureTaskButton(win);
    }
    bringToFront(win);
    fillSkillBars(win);
  }
  window.openWin98Window = openWindow;

  function ensureTaskButton(win){
    if (taskButtonFor(win)) return;
    const btn = document.createElement('button');
    btn.className = 'task-btn';
    btn.dataset.for = win.id;
    btn.textContent = win.dataset.title || win.id;
    btn.addEventListener('click', () => {
      if (win.hidden){ win.hidden = false; bringToFront(win); return; }
      if (win.classList.contains('active')){ win.hidden = true; }
      else { bringToFront(win); }
    });
    tasksBar.appendChild(btn);
  }

  function closeWindow(win){
    win.hidden = true;
    const btn = taskButtonFor(win);
    if (btn) btn.remove();
  }

  wins.forEach(win => {
    win.addEventListener('mousedown', () => bringToFront(win));

    win.querySelectorAll('.wbtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'close') closeWindow(win);
        else if (act === 'min') win.hidden = true;
        else if (act === 'max') win.classList.toggle('maxed');
        if (act === 'max'){
          if (win.classList.contains('maxed')){
            win.dataset.prevStyle = win.getAttribute('style');
            win.style.left = '2%'; win.style.top = '2%'; win.style.width = '96%'; win.style.height = '90%';
          } else {
            win.setAttribute('style', win.dataset.prevStyle || '');
          }
        }
      });
    });

    // drag by titlebar
    const titlebar = win.querySelector('.win-title');
    let dragging = false, offX = 0, offY = 0;
    titlebar.addEventListener('mousedown', (e) => {
      if (isMobile()) return;
      if (e.target.closest('.wbtn')) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      bringToFront(win);
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      win.style.left = Math.max(0, e.clientX - offX) + 'px';
      win.style.top = Math.max(0, e.clientY - offY) + 'px';
    });
    document.addEventListener('mouseup', () => dragging = false);

    // touch drag — skipped on mobile, where windows are forced full-screen
    // by CSS (see the max-width:768px block in styles.css) and dragging a
    // fullscreen "app" makes no sense.
    titlebar.addEventListener('touchstart', (e) => {
      if (isMobile()) return;
      if (e.target.closest('.wbtn')) return;
      const t = e.touches[0];
      const rect = win.getBoundingClientRect();
      offX = t.clientX - rect.left; offY = t.clientY - rect.top;
      dragging = true;
      bringToFront(win);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!dragging || isMobile()) return;
      const t = e.touches[0];
      win.style.left = Math.max(0, t.clientX - offX) + 'px';
      win.style.top = Math.max(0, t.clientY - offY) + 'px';
    }, { passive: true });
    document.addEventListener('touchend', () => dragging = false);
  });

  // desktop icons open windows
  document.querySelectorAll('[data-win]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openWindow(el.dataset.win);
      document.getElementById('start-menu').hidden = true;
      document.getElementById('start-btn').classList.remove('open');
    });
  });

  // open the first window (Mi PC) by default, like a fresh install
  openWindow('whoami');
})();

/* ============ Start menu ============ */
(function startMenu(){
  const btn = document.getElementById('start-btn');
  const menu = document.getElementById('start-menu');
  btn.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    btn.classList.toggle('open', !menu.hidden);
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== btn){
      menu.hidden = true;
      btn.classList.remove('open');
    }
  });
})();

/* ============ Shutdown ============ */
(function shutdown(){
  const btn = document.getElementById('shutdown-btn');
  btn.addEventListener('click', () => {
    document.getElementById('shutdown').hidden = false;
    setTimeout(() => { window.location.href = '../'; }, 1800);
  });
})();

/* ============ Recycle bin easter egg ============ */
(function recycleBin(){
  const icon = document.getElementById('recycle-icon');
  icon.addEventListener('click', () => {
    alert('La Papelera de reciclaje está vacía.\n(No hay nada de mi experiencia que quisiera borrar.)');
  });
})();

/* ============ Explorer preview pane ============ */
(function explorer(){
  const rows = document.querySelectorAll('.exp-row');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      rows.forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      document.querySelectorAll('.exp-detail').forEach(d => d.hidden = true);
      const target = document.getElementById('exp-' + row.dataset.p);
      if (target) target.hidden = false;
    });
  });
})();

/* ============ Skill bars fill ============ */
function fillSkillBars(scope){
  (scope || document).querySelectorAll('.skill98').forEach(el => {
    const level = parseInt(el.dataset.level, 10) || 0;
    el.querySelector('.p98-fill').style.width = (level / 5 * 100) + '%';
  });
}
