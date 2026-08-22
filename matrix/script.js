'use strict';

/* ============ Matrix rain ============ */
(function matrixRain(){
  const canvas = document.getElementById('matrix-canvas');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w, h, cols, drops, fontSize = 16;
  const chars = 'アイウエオカキクケコサシスセソ01アカサタナ01ハマヤラワKEPACUEVAS<>{}/;=';

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    cols = Math.floor(w / fontSize);
    drops = new Array(cols).fill(0).map(() => Math.random() * -100);
  }
  window.addEventListener('resize', resize);
  resize();

  let running = true;
  let rafId;

  // requestAnimationFrame runs at ~60fps, which made the rain fall too
  // fast to read. Throttling to ~20fps slows it without touching the
  // look: each drawn frame still advances every drop exactly one row,
  // so the trail-to-speed ratio stays identical.
  const FRAME_MS = 1000 / 20;
  let lastFrame = 0;

  // `now = 0` matters: draw() is also called directly (on start and when
  // re-enabling FX), and without a default `now - lastFrame` would be NaN,
  // which fails the throttle check and silently restores full 60fps.
  function draw(now = 0){
    if (!running) return;
    rafId = requestAnimationFrame(draw);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;

    ctx.fillStyle = 'rgba(3,8,5,0.10)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < cols; i++){
      const char = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      const isHead = Math.random() > 0.92;
      ctx.fillStyle = isHead ? '#c8ffd4' : '#00ff41';
      ctx.globalAlpha = isHead ? 0.95 : 0.55;
      ctx.fillText(char, x, y);
      ctx.globalAlpha = 1;

      if (y > h && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }

  if (!reduceMotion) draw();
  else { ctx.fillStyle = '#030805'; ctx.fillRect(0,0,w,h); }

  const fxToggle = document.getElementById('fx-toggle');
  fxToggle.addEventListener('click', () => {
    running = !running;
    fxToggle.textContent = 'FX: ' + (running ? 'ON' : 'OFF');
    fxToggle.setAttribute('aria-pressed', String(running));
    if (running) draw();
    else cancelAnimationFrame(rafId);
  });
})();

/* ============ Boot sequence ============ */
(function boot(){
  const bootScreen = document.getElementById('boot-screen');
  const bootText = document.getElementById('boot-text');
  const site = document.getElementById('site');

  const lines = [
    '> INICIANDO SISTEMA...',
    '> CARGANDO CV_KEPA_CUEVAS_BARRASA.exe',
    '> MONTANDO /experiencia /skills /proyectos_ia',
    '> COMPROBANDO INTEGRIDAD.......... OK',
    '> ACCESO CONCEDIDO.',
    '',
    'bienvenido.'
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function finish(){
    bootScreen.classList.add('hide');
    site.hidden = false;
    document.removeEventListener('keydown', finish);
    document.removeEventListener('click', finish);
  }

  if (reduceMotion){
    finish();
    return;
  }

  document.addEventListener('keydown', finish);
  document.addEventListener('click', finish);

  let li = 0, ci = 0, out = '';
  const timer = setInterval(() => {
    if (li >= lines.length){
      clearInterval(timer);
      setTimeout(finish, 600);
      return;
    }
    const line = lines[li];
    if (ci < line.length){
      out += line[ci];
      ci++;
    } else {
      out += '\n';
      li++;
      ci = 0;
    }
    bootText.textContent = out;
  }, 18);
})();

/* ============ Nav: smooth active state ============ */
(function nav(){
  const buttons = document.querySelectorAll('.pixel-nav button');
  const sections = [...buttons].map(b => document.querySelector(b.dataset.target)).filter(Boolean);

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector(btn.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const btn = document.querySelector(`.pixel-nav button[data-target="#${entry.target.id}"]`);
      if (!btn) return;
      if (entry.isIntersecting) buttons.forEach(b => b.classList.toggle('active', b === btn));
    });
  }, { rootMargin: '-40% 0px -50% 0px' });

  sections.forEach(s => io.observe(s));
})();

/* ============ Experience accordion ============ */
(function accordion(){
  document.querySelectorAll('.job-head').forEach(head => {
    head.addEventListener('click', () => {
      const job = head.closest('.job');
      const isOpen = job.getAttribute('data-open') === 'true';
      job.setAttribute('data-open', String(!isOpen));
    });
  });
})();

/* ============ Skill bars fill on scroll ============ */
(function skillBars(){
  const skills = document.querySelectorAll('.skill');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const level = parseInt(el.dataset.level, 10) || 0;
      const fill = el.querySelector('.bar-fill');
      fill.style.width = (level / 5 * 100) + '%';
      io.unobserve(el);
    });
  }, { threshold: 0.4 });
  skills.forEach(s => io.observe(s));
})();

/* ============ Interactive console (easter egg) ============ */
(function console_(){
  const input = document.getElementById('console-input');
  const log = document.getElementById('console-log');
  if (!input) return;

  function print(text, cls){
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  const commands = {
    help: () => [
      'comandos disponibles:',
      '  help          - esta ayuda',
      '  whoami        - sobre mi',
      '  skills        - top skills',
      '  projects      - proyectos autodidactas con IA',
      '  contact       - datos de contacto',
      '  sudo hire kepa - ;)',
      '  clear         - limpiar consola'
    ],
    whoami: () => ['Kepa Cuevas Barrasa — Software Engineer. Java/Spring Boot de día, apps con IA de noche.'],
    skills: () => ['Java, Spring Boot, Microservicios, Arquitectura Hexagonal, Kafka, Kubernetes, PostgreSQL, MongoDB, Docker.'],
    projects: () => ['StiEx · gim-app · cartelera-app (producción) · PhotoSwipe · Bounce — ver sección proyectos_ia ↑'],
    contact: () => ['email: kepa.cuevas@gmail.com', 'linkedin: /in/kepa-cuevas-barrasa-135338137', 'github: /kcuevasb'],
    clear: () => { log.innerHTML = ''; return null; },
  };

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const raw = input.value.trim();
    if (!raw) return;
    print('kepa@portfolio:~$ ' + raw, 'cl-cmd');
    input.value = '';

    const key = raw.toLowerCase();
    if (key === 'sudo hire kepa'){
      print('permiso concedido. redactando oferta... 📄✅', 'cl-hl');
      return;
    }
    const fn = commands[key];
    if (!fn){
      print(`bash: ${raw}: comando no encontrado (prueba "help")`, 'cl-err');
      return;
    }
    const out = fn();
    if (out) out.forEach(line => print(line));
  });
})();
