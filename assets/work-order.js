(() => {
  const demo = document.querySelector('[data-demo]');
  if (!demo) return;

  const stages = [...demo.querySelectorAll('.workflow li')];
  const status = demo.querySelector('.demo-status');
  const noteArea = demo.querySelector('.note-area');
  const note = demo.querySelector('textarea');
  const controls = demo.querySelector('.demo-controls');
  const action = demo.querySelector('.demo-action');
  const reset = demo.querySelector('.demo-reset');
  const initialMessage = status.textContent;
  let step = 0;

  function update() {
    stages.forEach((stage, i) => {
      if (i === step) stage.setAttribute('aria-current', 'step');
      else stage.removeAttribute('aria-current');
      stage.classList.toggle('done', i < step);
    });
    noteArea.hidden = step !== 1;
    reset.hidden = step === 0;
    action.hidden = step === 2;
    action.textContent = step === 0 ? 'Start repair' : 'Complete repair';
    action.disabled = step === 1 && !note.value.trim();
    if (step === 0) status.textContent = initialMessage;
    if (step === 1) status.textContent = 'Repair started. Add a note to close the order.';
    if (step === 2) status.textContent = 'Completion note: ' + note.value.trim();
  }
  controls.hidden = false;
  note.addEventListener('input', () => { action.disabled = !note.value.trim(); });
  action.addEventListener('click', () => {
    if (step === 2 || (step === 1 && !note.value.trim())) return;
    step++;
    update();
    if (step === 1) note.focus();
    else reset.focus();
  });
  reset.addEventListener('click', () => {
    note.value = '';
    step = 0;
    update();
    action.focus();
  });
})();
