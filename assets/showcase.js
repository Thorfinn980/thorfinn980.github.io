(() => {
  const showcase = document.querySelector('.showcase');
  if (showcase) {
    const slides = [...showcase.querySelectorAll('.show-slide')];
    const title = showcase.querySelector('[data-slide-title]');
    const status = showcase.querySelector('[data-show-status]');
    let current = 0;
    function change(step) {
      slides[current].hidden = true;
      current = (current + step + slides.length) % slides.length;
      const slide = slides[current];
      slide.hidden = false;
      title.textContent = slide.dataset.title;
      if (slide.dataset.link) title.href = slide.dataset.link;
      else title.removeAttribute('href');
      status.textContent = slide.dataset.title + ', ' + (current + 1) + ' of ' + slides.length;
      document.dispatchEvent(new Event('showcasechange'));
    }
    showcase.querySelector('[data-prev]').addEventListener('click', () => change(-1));
    showcase.querySelector('[data-next]').addEventListener('click', () => change(1));
    const controls = showcase.querySelector('.showcase-nav');
    controls.hidden = false;
    controls.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault(); change(event.key === 'ArrowLeft' ? -1 : 1);
    });
  }
  function expandDestination() {
    const item = document.getElementById(location.hash.slice(1));
    if (item?.matches('.archive details') && !item.open) item.open = true;
  }
  window.addEventListener('hashchange', expandDestination);
  expandDestination();
})();
