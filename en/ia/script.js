'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const messagesEl = document.getElementById('messages');
const chatTitle = document.getElementById('chat-top-title');
const threads = Array.from(document.querySelectorAll('.thread'));
const seenThreads = new Set();

const THREAD_LABELS = {
  'sobre-mi': 'About me',
  experiencia: 'Experience',
  skills: 'Skills',
  contacto: 'Contact',
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
  'sobre-mi': ['who', 'you are', 'about you', 'yourself', 'introduce'],
  experiencia: ['experience', 'work', 'job', 'company', 'career', 'history'],
  skills: ['skill', 'technolog', 'stack', 'tech', 'good at', 'master'],
  contacto: ['contact', 'email', 'mail', 'linkedin', 'github', 'talk', 'reach'],
};

// Content that moved to other chapters — answer with a pointer instead of
// pretending it lives here.
const REDIRECTS = {
  proyectos: { words: ['project', 'app', 'personal', 'self-taught', 'side'], to: 'the Matrix chapter' },
  formacion: { words: ['stud', 'educat', 'school', 'degree', 'college'], to: 'the Windows 98 chapter' },
  nttdata: { words: ['ntt', 'imq', 'valdecilla', 'siemens', 'eclipse'], to: 'the NTT Data chapter (Eclipse look)' },
  knowmad: { words: ['knowmad', 'corte inglés', 'corte ingles', 'beedigital', 'intellij'], to: 'the Knowmad Mood chapter (IntelliJ look)' },
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
  if (lower.includes('help') || lower.includes('ayuda')){
    appendCustomExchange(q, '<p>I can tell you about: <strong>who I am</strong>, <strong>experience</strong>, <strong>skills</strong> or <strong>contact</strong>. For personal projects or education, have a look at the other editions — you can also use the menu on the left.</p>');
    return;
  }

  const redirect = matchRedirect(q);
  if (redirect){
    appendCustomExchange(q, `<p>That one is covered in ${redirect} — this chapter only covers my current stage, at Sopra Steria. Head back to the selector to see it.</p>`);
    return;
  }

  const threadId = matchThread(q);
  if (threadId){
    appendCustomExchange(q, `<p>That question fits <strong>${THREAD_LABELS[threadId]}</strong> — opening that section…</p>`);
    setTimeout(() => renderThread(threadId, { skipThinking: true }), 650);
    return;
  }

  appendCustomExchange(q, '<p>I do not have a scripted answer for that yet. Try &quot;help&quot;, or better, ask Kepa directly by email — he does improvise.</p>');
});

/* ============ Init ============ */
renderThread('sobre-mi', { skipThinking: true });
