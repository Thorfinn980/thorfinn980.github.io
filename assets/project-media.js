for (const gallery of document.querySelectorAll('[data-gallery]')) {
  const stage = gallery.querySelector('.gallery-stage');
  const image = stage.querySelector('img');
  const caption = gallery.querySelector('figcaption');
  const choices = gallery.querySelector('.gallery-choices');
  const first = choices.querySelector('a');
  const replay = choices.querySelector('.replay-link');
  let lastStill = first;

  function show(item) {
    const previous = choices.querySelector('[aria-current]');
    if (previous) previous.removeAttribute('aria-current');
    item.setAttribute('aria-current', 'true');
    image.src = item.href;
    image.alt = item.dataset.alt;
    stage.href = item.href;
    stage.setAttribute('aria-label', item === replay ? 'Open full-size dice replay' : 'Open full-size image');
    caption.textContent = item.dataset.caption;
    if (item !== replay) lastStill = item;
    if (replay) replay.textContent = item === replay ? 'Stop replay' : 'Play dice replay';
  }

  choices.addEventListener('click', (event) => {
    const item = event.target.closest('a');
    if (!item || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (item === replay && item.hasAttribute('aria-current')) {
      show(lastStill);
    } else {
      show(item);
    }
  });
}
