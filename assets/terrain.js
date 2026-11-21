(() => {
  const figure = document.querySelector('.terrain');
  if (!figure) return;
  let canvas = figure.querySelector('canvas');
  const initial = -.61;
  const buttons = [...figure.querySelectorAll('[data-view]')];
  let angle = initial, velocity = 0, drag = null, lastFrame = 0, frame = 0;
  let flat = false, visible = false, draw;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function noise(x, y) {
    const at = (a,b) => {
      const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const a = Math.floor(x), b = Math.floor(y);
    let u = x - a, v = y - b;
    u = u*u*(3-2*u); v = v*v*(3-2*v);
    return (at(a,b)*(1-u)+at(a+1,b)*u)*(1-v) + (at(a,b+1)*(1-u)+at(a+1,b+1)*u)*v;
  }
  function elevation(x,y) {
    const ridge = .13+.24*Math.sin(2.7*x+.6)-.22*x;
    const crest = Math.exp(-(((y-ridge)/.43)**2));
    const crown = .24+.65*Math.exp(-(((x+.15)/.54)**2))+.39*Math.exp(-(((x-.62)/.23)**2));
    return -.085 + crest*crown + .33*Math.exp(-((x+.67)**2/.18+(y+.53)**2/.19)) +
      .30*noise(x*2.3+11,y*2.3+3)+.15*noise(x*5.3+8,y*5.3)+.055*noise(x*12,y*12+5);
  }

  function mesh(n) {
    const vertices = [], indices = [];
    const heights = new Float32Array((n+1)*(n+1));
    for (let y=0; y<=n; y++) for (let x=0; x<=n; x++) {
      heights[y*(n+1)+x] = elevation(x*2/n-1,y*2/n-1);
    }
    for (let y=0; y<=n; y++) for (let x=0; x<=n; x++) {
      const i = y*(n+1)+x;
      const shade = (heights[Math.min(n,y+1)*(n+1)+x] - heights[y*(n+1)+Math.min(n,x+1)]) * n*.15;
      vertices.push(x*2/n-1, y*2/n-1, heights[i], Math.max(-1,Math.min(1,shade)),0);
      if (x<n && y<n) indices.push(i,i+1,i+n+1,i+1,i+n+2,i+n+1);
    }
    function wall(a,b,side) {
      const k = vertices.length/5;
      for (const [v,bottom] of [[a,false],[b,false],[b,true],[a,true]]) {
        vertices.push(vertices[v*5],vertices[v*5+1],bottom ? -.10 : heights[v],0,side);
      }
      indices.push(k,k+1,k+2,k,k+2,k+3);
    }
    for (let i=0; i<n; i++) {
      wall(i,i+1,1); wall(n*(n+1)+i,n*(n+1)+i+1,1);
      wall(i*(n+1),(i+1)*(n+1),2); wall(i*(n+1)+n,(i+1)*(n+1)+n,2);
    }
    return {vertices:new Float32Array(vertices), indices:new Uint16Array(indices)};
  }

  function gpuRenderer(gl) {
    const vert = `
      attribute vec3 point;
      attribute vec2 material;
      uniform vec2 rotation, scale;
      uniform float flatView;
      varying vec3 surface;
      void main() {
        float sideways = rotation.x*point.x - rotation.y*point.y;
        float depth = rotation.y*point.x + rotation.x*point.y;
        float projected = depth*mix(.43,.87,flatView) - point.z*.86*(1.-flatView);
        gl_Position = vec4(sideways*scale.x,mix(-.22,0.,flatView)-projected*scale.y,
          -(depth + point.z*.6)*.32,1.);
        surface = vec3(point.z,material);
      }`;
    const derivatives = gl.getExtension('OES_standard_derivatives');
    const frag = (derivatives ? '#extension GL_OES_standard_derivatives : enable\n' : '') + `
      precision mediump float;
      varying vec3 surface;
      uniform float flatView;
      void main() {
        float h = clamp(surface.x/1.17,0.,1.), light=surface.y*(1.-flatView);
        vec3 base = vec3(.059,.153,.506) + h*vec3(.184,.373,.392)
          + h*h*h*vec3(.267,.145,0.) + light*vec3(.094,.125,.106);
        if (surface.z > .5) {
          if (flatView > .5) discard;
          base = mix(vec3(.077,.21,.46),vec3(.053,.14,.33),step(1.5,surface.z));
          if(abs(surface.x+.041)<.005) base += vec3(.10,.12,.16);
        } else {
          float level = surface.x*40.;
          float d = abs(fract(level+.5)-.5);
          float w = ` + (derivatives ? 'clamp(fwidth(level),.045,.85)' : '.22') + `;
          float major = 1.-step(.5,mod(floor(level+.5)+400.,4.));
          float line = 1.-smoothstep(.0,w*(.56+.26*major),d);
          base = mix(base,mix(vec3(.30,.52,.88),vec3(.89,.96,1.),h),line*(.60+.34*major));
        }
        gl_FragColor = vec4(base,1.);
      }`;
    function compile(type,source) {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error('Terrain shader unavailable');
      return shader;
    }
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vert)); gl.attachShader(program,compile(gl.FRAGMENT_SHADER,frag));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('Terrain program unavailable');
    gl.useProgram(program);
    const geometry=mesh(64);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);
    for (const [name,length,offset] of [['point',3,0],['material',2,12]]) {
      const a=gl.getAttribLocation(program,name);
      gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,length,gl.FLOAT,false,20,offset);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,geometry.indices,gl.STATIC_DRAW);
    const rotation=gl.getUniformLocation(program,'rotation'), scale=gl.getUniformLocation(program,'scale'), mode=gl.getUniformLocation(program,'flatView');
    gl.enable(gl.DEPTH_TEST);
    return (c,s,k,w,h) => {
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform2f(rotation,c,s); gl.uniform2f(scale,2*k/w,2*k/h); gl.uniform1f(mode,flat?1:0);
      gl.drawElements(gl.TRIANGLES,geometry.indices.length,gl.UNSIGNED_SHORT,0);
    };
  }

  // Small painter-ordered mesh for browsers without WebGL. Contours and paint styles are static.
  function softwareRenderer(ctx) {
    const n=28, cells=[], grid=[];
    for(let j=0;j<=n;j++) for(let i=0;i<=n;i++) {
      const x=2*i/n-1,y=2*j/n-1;
      grid.push({x,y,z:elevation(x,y),px:0,py:0});
    }
    for(let j=0;j<n;j++) for(let i=0;i<n;i++) {
      const a=j*(n+1)+i, p=[grid[a],grid[a+1],grid[a+n+2],grid[a+n+1]];
      const levels=p.map(v=>v.z), h=Math.max(0,Math.min(1,levels.reduce((a,b)=>a+b)/4));
      const light=Math.max(-1,Math.min(1,(p[3].z-p[1].z)*5)), segments=[];
      for(let t=Math.ceil(Math.min(...levels)*28);t<=Math.max(...levels)*28;t++) {
        const hits=[];
        for(let e=0;e<4;e++) {
          const u=p[e],v=p[(e+1)%4],z=t/28;
          if((u.z<z)===(v.z<z)) continue;
          const f=(z-u.z)/(v.z-u.z);
          hits.push([u,v,f]);
        }
        if(hits.length>=2) segments.push(...hits);
      }
      cells.push({p,segments,color:'rgb('+[17+80*h+17*light,42+113*h+22*light,132+99*h+20*light].map(Math.round).join(',')+')'});
    }
    return (c,s,k,w,h) => {
      ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0); ctx.clearRect(0,0,w,h);
      for(const p of grid) {
        p.px=w*.5+(c*p.x-s*p.y)*k;
        p.py=h*(flat?.50:.61)+((s*p.x+c*p.y)*(flat?.87:.43)-(flat?0:p.z*.86))*k;
      }
      function side(a,b,color) {
        // Only the two facing edges are visible. Their tops share the mesh projection.
        const bottomA=a.py+(a.z+.10)*.86*k, bottomB=b.py+(b.z+.10)*.86*k;
        ctx.beginPath();ctx.moveTo(a.px,a.py);ctx.lineTo(b.px,b.py);
        ctx.lineTo(b.px,bottomB);ctx.lineTo(a.px,bottomA);ctx.closePath();
        ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=.6;ctx.stroke();
      }
      for(let row=0;row<n;row++) for(let col=0;col<n;col++) {
        const j=c>=0?row:n-1-row, i=s>=0?col:n-1-col, cell=cells[j*n+i];
        ctx.beginPath(); ctx.moveTo(cell.p[0].px,cell.p[0].py);
        for(let v=1;v<4;v++) ctx.lineTo(cell.p[v].px,cell.p[v].py);
        ctx.closePath(); ctx.fillStyle=cell.color; ctx.fill(); ctx.strokeStyle=cell.color; ctx.lineWidth=.65; ctx.stroke();
        ctx.beginPath();
        for(let v=0;v<cell.segments.length;v++){
          const [a,b,f]=cell.segments[v],x=a.px+(b.px-a.px)*f,y=a.py+(b.py-a.py)*f;
          if(v%2===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle='#85ade0';ctx.lineWidth=.58;ctx.stroke();
        if(!flat && row===n-1) {
          const edge=c>=0?2:0;side(cell.p[edge],cell.p[edge+1],'#17376c');
        }
        if(!flat && col===n-1) {
          const edge=s>=0?1:3;side(cell.p[edge],cell.p[(edge+1)%4],'#142c58');
        }
      }
    };
  }
  function render(now) {
    frame=0;
    if (!visible || document.hidden || !draw) return;
    const dt=lastFrame ? Math.min((now-lastFrame)/1000,.04) : 0;
    lastFrame=now;
    if (!drag && velocity) {
      angle+=velocity*dt; velocity*=Math.exp(-8*dt);
      if(Math.abs(velocity)<.018) velocity=0;
    }
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w || !h) return;
    const dpr=Math.min(window.devicePixelRatio||1,1.5),pw=Math.round(w*dpr),ph=Math.round(h*dpr);
    if(canvas.width!==pw || canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
    const k=flat?Math.min(w*.28,h*.35):Math.min(w*.326,h*.44);
    draw(Math.cos(angle),Math.sin(angle),k,w,h);
    if(!drag && velocity) redraw();
  }
  function redraw() { if(visible && !document.hidden && !frame) frame=requestAnimationFrame(render); }
  function initialize() {
    let gl;
    try {
      gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});
      if(gl) draw=gpuRenderer(gl);
    } catch (_) { /* A fresh canvas is needed to switch context types. */ }
    if(!draw) {
      if(gl){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);canvas=fresh;}
      const ctx=canvas.getContext('2d');
      if(!ctx) return;
      draw=softwareRenderer(ctx);
    }
    canvas.addEventListener('webglcontextlost', event=>{
      event.preventDefault();figure.classList.remove('is-ready');
    });
    canvas.addEventListener('webglcontextrestored',()=>{
      draw=gpuRenderer(gl);figure.classList.add('is-ready');redraw();
    });
    canvas.tabIndex=0;
    figure.classList.add('is-ready');
    figure.querySelector('.terrain-hint').textContent='Drag to rotate';
    buttons.forEach(button=>button.addEventListener('click',()=>{
      flat=button.dataset.view==='contours';
      buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));redraw();
    }));
    canvas.addEventListener('pointerdown',event=>{
      if(!event.isPrimary || event.button!==0)return;
      velocity=0;drag={id:event.pointerId,x:event.clientX,time:event.timeStamp,speed:0};
      canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove',event=>{
      if(!drag || drag.id!==event.pointerId)return;
      const delta=(event.clientX-drag.x)*Math.PI/Math.max(200,canvas.clientWidth*.68);
      const dt=Math.max(8,event.timeStamp-drag.time)/1000;
      angle+=delta;drag.speed=.45*drag.speed+.55*Math.max(-4,Math.min(4,delta/dt));
      drag.x=event.clientX;drag.time=event.timeStamp;redraw();
    });
    canvas.addEventListener('pointerup',event=>{
      if(drag && drag.id===event.pointerId && event.timeStamp-drag.time<80 && !reduced.matches){
        velocity=drag.speed;lastFrame=0;redraw();
      }
    });
    canvas.addEventListener('lostpointercapture',()=>{drag=null;canvas.classList.remove('dragging');});
    canvas.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();velocity=0;
      angle=event.key==='Home'?initial:angle+(event.key==='ArrowRight'?.15:-.15);redraw();
    });
  }
  function visibility(on) {
    visible=on && !figure.closest('[hidden]');
    if(visible && !draw) initialize();
    if(!visible || document.hidden){cancelAnimationFrame(frame);frame=0;velocity=0;lastFrame=0;}
    else redraw();
  }
  new IntersectionObserver(([entry])=>visibility(entry.isIntersecting)).observe(figure);
  new ResizeObserver(redraw).observe(figure);
  document.addEventListener('showcasechange',()=>{if(figure.closest('[hidden]')) visibility(false);});
  document.addEventListener('visibilitychange',()=>visibility(visible));
})();
