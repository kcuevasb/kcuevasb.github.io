'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const messagesEl = document.getElementById('messages');
const chatTitle = document.getElementById('chat-top-title');
const threads = Array.from(document.querySelectorAll('.thread'));
const seenThreads = new Set();

const THREAD_LABELS = {
  'sobre-mi': 'Sobre mí',
  experiencia: 'Experiencia',
  skills: 'Skills',
  contacto: 'Contacto',
};

function fillSkillMeters(scope){
  (scope || document).querySelectorAll('.skill-row').forEach(row => {
    const level = parseInt(row.dataset.level, 10) || 0;
    const bar = row.querySelector('.meter b');
    if (bar) bar.style.width = (level / 5 * 100) + '%';
  });
}

function renderThread(id, { skipThinking } = {}){
  const tpl = document.getElementById('tpl-' + id);
  if (!tpl) return;

  threads.forEach(t => t.classList.toggle('active', t.dataset.thread === id));
  chatTitle.textContent = THREAD_LABELS[id] || id;

  messagesEl.innerHTML = '';

  const frag = tpl.content.cloneNode(true);
  const userQ = frag.querySelector('.user-q');
  const aBody = frag.querySelector('.a-body');

  const pair = document.createElement('div');
  pair.className = 'msg-pair';

  const userRow = document.createElement('div');
  userRow.className = 'user-row';
  userRow.appendChild(userQ);
  pair.appendChild(userRow);

  const assistantRow = document.createElement('div');
  assistantRow.className = 'assistant-row';
  assistantRow.innerHTML = '<span class="avatar">K</span>';
  const bubble = document.createElement('div');
  bubble.className = 'a-bubble';
  assistantRow.appendChild(bubble);
  pair.appendChild(assistantRow);

  messagesEl.appendChild(pair);

  const showAnswer = () => {
    bubble.innerHTML = '';
    bubble.appendChild(aBody);
    fillSkillMeters(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const alreadySeen = seenThreads.has(id);
  if (reduceMotion || (skipThinking) || alreadySeen){
    showAnswer();
  } else {
    bubble.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';
    messagesEl.scrollTop = messagesEl.scrollHeight;
    setTimeout(showAnswer, 550);
  }
  seenThreads.add(id);
}

threads.forEach(btn => {
  btn.addEventListener('click', () => {
    renderThread(btn.dataset.thread);
    closeSidebarMobile();
  });
});

document.getElementById('new-chat-btn').addEventListener('click', () => {
  renderThread('sobre-mi');
  closeSidebarMobile();
});

/* ============ Mobile sidebar drawer ============ */
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const menuBtn = document.getElementById('menu-toggle');

function openSidebarMobile(){
  sidebar.classList.add('open');
  backdrop.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
}
function closeSidebarMobile(){
  sidebar.classList.remove('open');
  backdrop.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}
menuBtn.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebarMobile() : openSidebarMobile();
});
backdrop.addEventListener('click', closeSidebarMobile);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebarMobile(); });

/* ============ Composer (canned Q&A) ============ */
const composer = document.getElementById('composer');
const input = document.getElementById('composer-input');

const KEYWORDS = {
  'sobre-mi': ['quien', 'quién', 'eres', 'sobre ti', 'presentate', 'preséntate'],
  experiencia: ['experiencia', 'trabajo', 'empresa', 'curro', 'historial'],
  skills: ['skill', 'tecnolog', 'stack', 'dominas', 'sabes'],
  contacto: ['contact', 'email', 'correo', 'linkedin', 'github', 'hablar'],
};

// Content that moved to other chapters — answer with a pointer instead of
// pretending it lives here.
const REDIRECTS = {
  proyectos: { words: ['proyecto', 'app', 'personal', 'autodidact'], to: 'el capítulo Matrix' },
  formacion: { words: ['estudi', 'formaci', 'colegio', 'instituto'], to: 'el capítulo Windows 98' },
  nttdata: { words: ['ntt', 'imq', 'valdecilla', 'siemens', 'eclipse'], to: 'el capítulo NTT Data (estética Eclipse)' },
  knowmad: { words: ['knowmad', 'corte inglés', 'corte ingles', 'beedigital', 'intellij'], to: 'el capítulo Knowmad Mood (estética IntelliJ)' },
};

function matchRedirect(text){
  const t = text.toLowerCase();
  for (const r of Object.values(REDIRECTS)){
    if (r.words.some(w => t.includes(w))) return r.to;
  }
  return null;
}

function matchThread(text){
  const t = text.toLowerCase();
  for (const [id, words] of Object.entries(KEYWORDS)){
    if (words.some(w => t.includes(w))) return id;
  }
  return null;
}

function appendCustomExchange(question, answerHTML){
  const pair = document.createElement('div');
  pair.className = 'msg-pair';
  pair.innerHTML = `
    <div class="user-row"><p class="user-q"></p></div>
    <div class="assistant-row">
      <span class="avatar">K</span>
      <div class="a-bubble"><div class="thinking"><span></span><span></span><span></span></div></div>
    </div>`;
  pair.querySelector('.user-q').textContent = question;
  messagesEl.appendChild(pair);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const bubble = pair.querySelector('.a-bubble');
  const reveal = () => {
    bubble.innerHTML = `<div class="a-body">${answerHTML}</div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };
  if (reduceMotion) reveal(); else setTimeout(reveal, 500);
}

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  input.value = '';

  const lower = q.toLowerCase();
  if (lower.includes('ayuda') || lower.includes('help')){
    appendCustomExchange(q, '<p>Puedo hablarte de: <strong>quién soy</strong>, <strong>experiencia</strong>, <strong>skills</strong> o <strong>contacto</strong>. Para proyectos personales o formación, echa un vistazo a las otras ediciones — también puedes usar el menú de la izquierda.</p>');
    return;
  }

  const redirect = matchRedirect(q);
  if (redirect){
    appendCustomExchange(q, `<p>Eso lo cuento en ${redirect} — este capítulo se centra solo en mi etapa actual, en Sopra Steria. Vuelve al selector para verlo.</p>`);
    return;
  }

  const threadId = matchThread(q);
  if (threadId){
    appendCustomExchange(q, `<p>Esa pregunta encaja con <strong>${THREAD_LABELS[threadId]}</strong> — abriendo esa sección…</p>`);
    setTimeout(() => renderThread(threadId, { skipThinking: true }), 650);
    return;
  }

  appendCustomExchange(q, '<p>No tengo una respuesta guionizada para eso todavía. Prueba «ayuda», o mejor, pregúntaselo directamente a Kepa por email — sí que improvisa.</p>');
});

/* ============ Init ============ */
renderThread('sobre-mi', { skipThinking: true });
