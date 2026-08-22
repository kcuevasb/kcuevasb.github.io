'use strict';

/* ============ File / tab switching ============ */
(function files(){
  const treeFiles = document.querySelectorAll('.tree-file');
  const tabs = document.querySelectorAll('.tab');
  const panes = document.querySelectorAll('.editor > *');

  function openFile(id){
    treeFiles.forEach(f => f.classList.toggle('active', f.dataset.file === id));
    tabs.forEach(t => t.classList.toggle('active', t.dataset.file === id));
    panes.forEach(p => { p.hidden = p.id !== 'file-' + id; });
    closeProjectMobile();
  }

  treeFiles.forEach(f => f.addEventListener('click', () => openFile(f.dataset.file)));
  tabs.forEach(t => t.addEventListener('click', () => openFile(t.dataset.file)));
})();

/* ============ Mobile Project tool window drawer ============ */
const projectPanel = document.getElementById('project-panel');
const backdrop = document.getElementById('project-backdrop');
const menuBtn = document.getElementById('menu-toggle');

function openProjectMobile(){
  projectPanel.classList.add('open');
  backdrop.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
}
function closeProjectMobile(){
  projectPanel.classList.remove('open');
  backdrop.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}
menuBtn.addEventListener('click', () => {
  projectPanel.classList.contains('open') ? closeProjectMobile() : openProjectMobile();
});
backdrop.addEventListener('click', closeProjectMobile);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProjectMobile(); });
