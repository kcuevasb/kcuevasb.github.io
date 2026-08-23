'use strict';
(function(){
  const cards = Array.from(document.querySelectorAll('.card'));
  if (!cards.length) return;
  let idx = 0;

  function highlight(i){
    cards.forEach((c, ci) => c.classList.toggle('selected', ci === i));
    cards[i].focus({ preventScroll: true });
    cards[i].scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('keydown', (e) => {
    // La lista es vertical, así que las flechas de verdad son ↑/↓; se dejan
    // ←/→ porque antes los capítulos iban en fila y alguien puede tenerlo
    // en los dedos.
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const prev = e.key === 'ArrowUp' || e.key === 'ArrowLeft';

    if (next){ e.preventDefault(); idx = (idx + 1) % cards.length; highlight(idx); }
    else if (prev){ e.preventDefault(); idx = (idx - 1 + cards.length) % cards.length; highlight(idx); }
    else if (e.key === 'Enter' && document.activeElement === document.body){ cards[idx].click(); }
    else {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= cards.length){ window.location.href = cards[n-1].getAttribute('href'); }
    }
  });

  cards.forEach((c, i) => c.addEventListener('focus', () => { idx = i; highlight(i); }));
})();
