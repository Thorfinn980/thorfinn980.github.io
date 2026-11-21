/* A deterministic height field shared by both views. Positive depth faces the viewer. */
(() => {
  const canvas = document.querySelector('.terrain-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const figure = canvas.closest('.terrain');
  const buttons = [...figure.querySelectorAll('[data-view]')];
  const hint = figure.querySelector('.terrain-hint');
  const size = 64;
  const steps = 40;
  const initialAngle = -0.61;
  let angle = initialAngle;
  let view = 'relief';
  let frame = 0;
  let drag = null;

  function noise(x, y) {
    function at(a, b) {
      const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return n - Math.floor(n);
    }
    const a = Math.floor(x), b = Math.floor(y);
    let u = x - a, v = y - b;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    const lower = at(a, b) * (1 - u) + at(a + 1, b) * u;
    const upper = at(a, b + 1) * (1 - u) + at(a + 1, b + 1) * u;
    return lower * (1 - v) + upper * v;
  }

  function elevation(x, y) {
    const ridge = 0.13 + 0.24 * Math.sin(2.7 * x + 0.6) - 0.22 * x;
    const crest = Math.exp(-Math.pow((y - ridge) / 0.43, 2));
    const crown = 0.24 + 0.65 * Math.exp(-Math.pow((x + 0.15) / 0.54, 2)) +
      0.39 * Math.exp(-Math.pow((x - 0.62) / 0.23, 2));
    const shoulder = 0.33 * Math.exp(-((x + 0.67) ** 2 / 0.18 + (y + 0.53) ** 2 / 0.19));
    const foothills = 0.30 * noise(x * 2.3 + 11, y * 2.3 + 3) +
      0.15 * noise(x * 5.3 + 8, y * 5.3) + 0.055 * noise(x * 12, y * 12 + 5);
    return 0.055 + crest * crown + shoulder + foothills - 0.14;
  }

  const points = [];
  const cells = [];
  for (let row = 0; row <= size; row++) {
    for (let col = 0; col <= size; col++) {
      const x = col / size * 2 - 1, y = row / size * 2 - 1;
      points.push({ x, y, z: elevation(x, y) });
    }
  }

  // Marching squares keeps contour spacing tied to elevation in either projection.
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = row * (size + 1) + col;
      const corners = [i, i + 1, i + size + 2, i + size + 1];
      const h = corners.map(k => points[k].z);
      const contours = [];
      for (let level = Math.ceil(Math.min(...h) * steps); level <= Math.max(...h) * steps; level++) {
        const hits = [];
        const height = level / steps;
        for (let k = 0; k < 4; k++) {
          const next = (k + 1) % 4;
          if ((h[k] < height) === (h[next] < height)) continue;
          hits.push([k, next, (height - h[k]) / (h[next] - h[k])]);
        }
        for (let k = 1; k < hits.length; k += 2) {
          contours.push({ a: hits[k - 1], b: hits[k], major: level % 4 === 0 });
        }
      }
      const walls = [];
      if (row === 0) walls.push([0, 1, 0, -1]);
      if (col === size - 1) walls.push([1, 2, 1, 0]);
      if (row === size - 1) walls.push([2, 3, 0, 1]);
      if (col === 0) walls.push([3, 0, -1, 0]);
      cells.push({ corners, contours, walls, x: col, y: row, z: h.reduce((a,b) => a+b, 0) / 4,
        shade: Math.max(-1, Math.min(1, (h[3] - h[1]) * 9.5)) });
    }
  }

  const ink = (r, g, b) => 'rgb(' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v)))).join(',') + ')';
  function polygon(vertices, color) {
    ctx.beginPath();
    vertices.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.68;
    ctx.stroke();
  }
  function line(a, b, color, weight) {
    ctx.beginPath();
    ctx.moveTo(a[0],a[1]);
    ctx.lineTo(b[0],b[1]);
    ctx.strokeStyle=color;
    ctx.lineWidth=weight;
    ctx.stroke();
  }

  function render() {
    frame = 0;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const flat = view === 'contours';
    const s = Math.sin(angle), c = Math.cos(angle);
    const scale = flat ? Math.min(w * 0.28,h * 0.35) : Math.min(w * 0.326,h * 0.44);
    const baseline = h * (flat ? 0.50 : 0.61);
    const project = (p, z) => [
      w/2 + (c*p.x - s*p.y) * scale,
      baseline + ((s*p.x + c*p.y) * (flat ? 0.87 : 0.43) - (flat ? 0 : z * 0.86)) * scale
    ];
    const projected = points.map(p => project(p, p.z));
    const sorted = [...cells].sort((a,b) => (a.x-b.x)*s + (a.y-b.y)*c);
    for (const cell of sorted) {
      const vertices = cell.corners.map(k => projected[k]);
      const e = Math.max(0, Math.min(1, cell.z / 1.17));
      const light = flat ? 0 : cell.shade;
      const highlight = e * e * e;
      const color = ink(15+47*e+68*highlight+24*light, 39+95*e+37*highlight+32*light, 129+100*e+27*light);
      polygon(vertices, color);
      for (const contour of cell.contours) {
        const interpolate = ([i,j,t]) => [
          vertices[i][0]+t*(vertices[j][0]-vertices[i][0]),
          vertices[i][1]+t*(vertices[j][1]-vertices[i][1])
        ];
        line(interpolate(contour.a), interpolate(contour.b),
          contour.major ? ink(88+152*e,143+101*e,237+18*e) : ink(46+142*e,98+120*e,203+51*e),
          contour.major ? 1.05 : 0.7);
      }
      if (!flat) for (const [a,b,nx,ny] of cell.walls) {
        if (nx*s + ny*c <= 0) continue;
        const bottomA = project(points[cell.corners[a]], -0.10);
        const bottomB = project(points[cell.corners[b]], -0.10);
        const wallColor = nx ? ink(16+8*e,39+14*e,94+30*e) : ink(21+12*e,58+18*e,136+28*e);
        polygon([vertices[a],vertices[b],bottomB,bottomA],wallColor);
        line(vertices[a],vertices[b],'#699bef',0.9);
        const beddingA = project(points[cell.corners[a]], -0.04);
        const beddingB = project(points[cell.corners[b]], -0.04);
        line(beddingA,beddingB,'#365a9c',0.65);
        line(bottomA,bottomB,'#4168ac',0.75);
      }
    }
  }
  function redraw() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function setView(next) {
    view = next;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === next)));
    redraw();
  }
  buttons.forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, start: event.clientX, angle };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    angle = drag.angle + (event.clientX - drag.start) * 0.009;
    redraw();
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; canvas.classList.remove('dragging'); });
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home'].includes(event.key)) return;
    event.preventDefault();
    angle = event.key === 'Home' ? initialAngle : angle + (event.key === 'ArrowRight' ? 0.16 : -0.16);
    redraw();
  });
  render();
  canvas.tabIndex = 0;
  figure.classList.add('is-ready');
  hint.textContent = 'Drag to rotate';
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(canvas);
  else window.addEventListener('resize', redraw);
})();
