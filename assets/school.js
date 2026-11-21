// A small, two-dimensional schooling study in river coordinates.
(() => {
  const width = 864, height = 540, count = 34;
  const topBank = x => 56 + 34 * Math.sin(x / 150 - .9) + 17 * Math.cos(x / 79);
  const lowerBank = x => 482 + 32 * Math.sin(x / 164 + .6) + 21 * Math.cos(x / 101);
  const body = new Path2D('M -13,0 Q -3,-5.4 7,-3.1 Q 12,-2.2 14,0 Q 11,3 6,3.2 Q -3,4.4 -13,0 Z');
  const fins = new Path2D('M 1,1 L -3,6 L 5,2 Z M -2,-1 L -6,-5 L 2,-2 Z');
  const tail = new Path2D('M 1,0 L -7,-4.5 L -5.6,0 L -7,4.1 Z');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  for (const figure of document.querySelectorAll('[data-school]')) {
    const canvas = figure.querySelector('.school-fish');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const pauseButton = figure.querySelector('[data-pause]');
    const hint = figure.querySelector('.school-hint');
    let seed = 731;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    const fish = Array.from({length: count}, (_, i) => {
      const a = random() * Math.PI * 2, r = Math.sqrt(random());
      return {x: 432 + 207 * r * Math.cos(a), y: 270 + 92 * r * Math.sin(a),
        vx: 30 + 15 * random(), vy: -10 + 18 * random(), size: .65 + .5 * random(),
        phase: random() * 6.28, shade: ['#bec5a7','#9fb6a1','#d6c59c'][i % 3]};
    });
    const ax = new Float32Array(count), ay = new Float32Array(count);
    let time = 0, lure = null, raf = 0, last = 0, inView = false, ready = false, paused = motion.matches;
    function simulate(dt) {
      time += dt;
      if (lure && (lure.age += dt) > 7) lure = null;
      const driftX = width * .5 + 215 * Math.cos(time * .13);
      const driftY = height * .5 + 75 * Math.sin(time * .19);
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        let near = 0, cx = 0, cy = 0, alignX = 0, alignY = 0, sx = 0, sy = 0;
        for (const n of fish) {
          const dx = n.x - f.x, dy = n.y - f.y, d2 = dx * dx + dy * dy;
          if (d2 < .01 || d2 > 85 * 85) continue;
          near++; cx += dx; cy += dy; alignX += n.vx - f.vx; alignY += n.vy - f.vy;
          if (d2 < 31 * 31) {
            const d = Math.sqrt(d2), weight = (1 - d / 31) / d;
            sx -= dx * weight; sy -= dy * weight;
          }
        }
        let fx = sx * 84 + (driftX - f.x) * .09;
        let fy = sy * 84 + (driftY - f.y) * .15 + 3 * Math.sin(f.x / 90 + time * .3);
        if (near) {
          fx += (cx * .57 + alignX * .98) / near;
          fy += (cy * .57 + alignY * .98) / near;
        }
        if (lure) {
          const dx = lure.x - f.x, dy = lure.y - f.y, d = Math.hypot(dx,dy);
          if (d > .1 && d < 270) {
            const pull = 48 * (1 - d / 270) * Math.min(1, (d - 24) / 30);
            fx += (dx * pull - dy * 11) / d;
            fy += (dy * pull + dx * 11) / d;
          }
        }
        fx += 1.5 * (Math.max(0, 83 - f.x) - Math.max(0, f.x - width + 83));
        fy += 1.8 * (Math.max(0, topBank(f.x) + 57 - f.y) - Math.max(0, f.y - lowerBank(f.x) + 57));
        const limit = 1 / Math.max(1, Math.hypot(fx,fy) / 79);
        ax[i] = fx * limit; ay[i] = fy * limit;
      }
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        f.vx += ax[i] * dt; f.vy += ay[i] * dt;
        const speed = Math.max(.001, Math.hypot(f.vx,f.vy));
        const scale = Math.max(16, Math.min(53, speed)) / speed;
        f.vx *= scale; f.vy *= scale;
        f.x += f.vx * dt; f.y += f.vy * dt;
        f.phase += dt * (4 + speed * .09);
      }
    }
    function paint() {
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (lure) {
        ctx.strokeStyle = '#f2d29a'; ctx.fillStyle = '#f2ba79'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(lure.x,lure.y,6 + (lure.age * 13) % 16,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(lure.x,lure.y,2.6,0,Math.PI*2); ctx.fill();
      }
      for (const f of fish) {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(Math.atan2(f.vy,f.vx)); ctx.scale(f.size,f.size);
        ctx.fillStyle = 'rgba(8,36,38,.35)'; ctx.beginPath(); ctx.ellipse(1,4,13,2.7,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#c6a76d'; ctx.fill(fins);
        ctx.save(); ctx.translate(-10,0); ctx.rotate(.35 * Math.sin(f.phase)); ctx.fill(tail); ctx.restore();
        ctx.fillStyle = f.shade; ctx.fill(body);
        ctx.fillStyle = '#e9d9ab'; ctx.fillRect(-6,-1.4,13,.85);
        ctx.fillStyle = '#173c3d'; ctx.fillRect(8,-1.9,1.9,1.5);
        ctx.restore();
      }
    }
    function resize() {
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      paint();
    }
    function tick(now) {
      raf = 0;
      if (!last) last = now;
      const elapsed = now - last;
      if (elapsed >= 1000 / 30 - 1) {
        simulate(Math.min(elapsed / 1000, .07)); paint(); last = now;
      }
      raf = requestAnimationFrame(tick);
    }
    function sync() {
      const active = ready && inView && !document.hidden && !figure.closest('[hidden]');
      if (active && !paused && !raf) { last = 0; raf = requestAnimationFrame(tick); }
      if ((!active || paused) && raf) { cancelAnimationFrame(raf); raf = 0; }
      pauseButton.textContent = paused ? 'Play' : 'Pause';
    }
    function cast(x, y) {
      x = Math.max(24, Math.min(width - 24,x));
      lure = {x, y: Math.max(topBank(x) + 18, Math.min(lowerBank(x) - 18,y)), age: 0};
      if (paused) { paused = false; sync(); }
      paint();
    }
    canvas.addEventListener('click', event => {
      const box = canvas.getBoundingClientRect();
      cast((event.clientX - box.left) / box.width * width, (event.clientY - box.top) / box.height * height);
    });
    figure.querySelector('[data-cast]').addEventListener('click', () => cast(230 + random() * 410, 195 + random() * 135));
    canvas.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); cast(width / 2,height / 2); }
    });
    pauseButton.addEventListener('click', () => { paused = !paused; sync(); });
    motion.addEventListener('change', () => { paused = motion.matches; sync(); });
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(figure);
    new ResizeObserver(resize).observe(canvas);
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('showcasechange', sync);
    // Keep the still visible until the riverbed is decoded.
    const backdrop = figure.querySelector('.school-bed');
    function start() {
      if (!backdrop.naturalWidth || ready) return;
      ready = true;
      figure.classList.add('school-ready');
      figure.querySelector('.school-actions').hidden = false;
      canvas.tabIndex = 0; hint.textContent = 'Click the water to cast';
      resize(); sync();
    }
    backdrop.addEventListener('load', start, {once: true});
    start();
  }
})();
