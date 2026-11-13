/* Nicely Done — the sealed glass on the home page.
   One hand-written fragment shader, no 3D library: a ray-marched slab of glass with a page inside it.
   Light is split into three colours where it passes through the glass, and the slab turns toward you.

   It is careful with the machine it runs on:
   - a still frame of this same shader (prism-still.webp) is what the page loads with, and what stays
     when motion is reduced, WebGL is missing, the device is low on memory or data saving is on;
   - the canvas starts after the first paint, and draws a frame only while something is changing:
     the pointer moved, a spring has not settled, a file is going in. Off screen, in a hidden tab,
     or once the page is idle (html.idle), it draws nothing at all. */
(function () {
  'use strict';
  const stage = document.querySelector('.hero-stage'), box = document.getElementById('slab'), canvas = document.getElementById('prism');
  const API = (window.NDPrism = { take: function () { return Promise.resolve(); }, lean: function () {} });
  if (!stage || !box || !canvas) return;
  const root = document.documentElement, rtl = root.dir === 'rtl';
  const conn = navigator.connection || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const low = (navigator.deviceMemory && navigator.deviceMemory <= 2) || conn.saveData === true;
  if (reduce || low) return;

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = [
    'precision highp float;',
    'uniform vec2 R;uniform float T;uniform vec2 A;uniform float PY;uniform float K;uniform float FX;uniform sampler2D PG;',
    'mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}',
    'float box(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}',
    'vec3 tf(vec3 p){p.xz*=rot(A.x);p.yz*=rot(A.y);return p;}',
    'float map(vec3 p){return box(tf(p),vec3(.78,1.02,.2),.12);}',
    'vec3 nrm(vec3 p){vec2 e=vec2(.001,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}',
    // the room the glass sits in: almost black, a white key light, a long soft light overhead, a blue slit, a mint fill
    'vec3 env(vec3 d){vec3 c=vec3(.0015,.002,.005)+vec3(.004,.005,.014)*(1.-abs(d.y));',
    'c+=vec3(1.)*pow(max(0.,dot(d,normalize(vec3(-.5,.6,-.6)))),40.)*1.4;',
    'c+=vec3(.55,.66,1.)*smoothstep(.3,.95,d.y)*.2;',
    'c+=vec3(.36,.55,1.)*smoothstep(.97,1.,sin(d.x*9.+T*.2))*.25;',
    'c+=vec3(.25,.9,.75)*pow(max(0.,dot(d,normalize(vec3(.8,-.2,-.5)))),12.)*.35;return c;}',
    // the page sealed inside: where a bent ray meets the middle plane of the slab (alpha says whether it met the page)
    'vec4 page(vec3 ro,vec3 rd){vec3 o=tf(ro),d=tf(rd);float t=-o.z/d.z;vec3 h=o+d*t;h.y-=PY;',
    'if(t>0.&&abs(h.x)<.5&&abs(h.y)<.68&&abs(h.y+PY)<1.06){vec2 q=vec2(h.x*FX+.5,h.y/1.36+.5);return vec4(texture2D(PG,q).rgb*.92,1.);}return vec4(env(rd),0.);}',
    // light arriving from the side: five thin lines that rise toward the glass
    'float beams(vec2 u){float s=0.;for(int k=0;k<5;k++){float fk=float(k),x=u.x,y=.27-fk*.125;',
    'float b=y+.07*sin(x*2.6+T*.55+fk*1.3)-max(0.,x-.34)*max(0.,x-.34)*1.5;float dy=abs(u.y-b);float w=exp(-dy*dy/.0000075)+.1*exp(-dy/.022);',
    's+=w*(.7+.3*sin(x*13.+T*1.7+fk*2.1));}',
    'return s*smoothstep(-.4,-.24,u.x)*(1.-smoothstep(.46,.7,u.x))*(1.-smoothstep(.3,.4,abs(u.y)));}',
    'void main(){vec2 uv=(gl_FragCoord.xy-vec2(R.x*.45,R.y*.5))/R.y;',
    'vec3 ro=vec3(0.,0.,-6.4),rd=normalize(vec3(uv,1.9));float t=4.4,m=1.;bool hit=false;',
    // only rays that pass near the slab are marched at all
    'float bq=dot(ro,rd);if(bq*bq-dot(ro,ro)+2.4>0.){for(int i=0;i<64;i++){float d=map(ro+rd*t);m=min(m,d/t);if(d<.001){hit=true;break;}t+=d;if(t>8.4)break;}}',
    'vec3 col;vec3 beam=vec3(.34,.52,1.)*.62*K;',
    'if(hit){vec3 p=ro+rd*t,n=nrm(p);float fr=pow(1.-max(0.,dot(-rd,n)),2.4);vec3 r=reflect(rd,n);',
    // three colours, three slightly different bends: this is where the spectrum comes from
    'vec3 d0=refract(rd,n,1./1.42),d1=refract(rd,n,1./1.48),d2=refract(rd,n,1./1.55);',
    'vec4 c0=page(p,d0),c1=page(p,d1),c2=page(p,d2);vec3 cr=vec3(c0.r,c1.g,c2.b);',
    'col=mix(cr*.9+vec3(.012,.015,.034),env(r)*2.4,fr);float e=pow(fr,1.5);',
    'col+=e*vec3(1.,.3,.43)*.5*max(0.,n.x)+e*vec3(.25,.9,.75)*.5*max(0.,-n.x);col=pow(col,vec3(.4545));',
    // the light behind the glass is seen bent, and split, through it
    'vec3 bb=vec3(beams(uv+(d0.xy-rd.xy)*1.5)*(1.-c0.a),beams(uv+(d1.xy-rd.xy)*1.5)*(1.-c1.a),beams(uv+(d2.xy-rd.xy)*1.5)*(1.-c2.a));',
    'vec3 q=abs(tf(p))-vec3(.78,1.02,.2);float mid=q.x+q.y+q.z-max(q.x,max(q.y,q.z))-min(q.x,min(q.y,q.z));',
    'col+=bb*beam*1.25*(1.-fr)*(1.-smoothstep(-.05,.03,mid));}',
    'else{col=vec3(.0235,.0275,.0471)+beam*beams(uv);',
    // a soft edge where the silhouette crosses a pixel, so the glass is never jagged
    'float px=1.4/(R.y*1.9);float a=1.-smoothstep(0.,px*1.6,m);if(a>0.){vec3 ec=pow(env(rd)*2.4+vec3(.03,.04,.07),vec3(.4545));col=mix(col,ec,a*.85);}}',
    'gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  /* ---------- the page inside: drawn on a 2D canvas, used as a texture ---------- */
  const PW = 512, PH = 696, sheet = document.createElement('canvas');
  sheet.width = PW; sheet.height = PH;
  function drawSheet(name, more) {
    const c = sheet.getContext('2d');
    c.fillStyle = '#eef0f7'; c.fillRect(0, 0, PW, PH);
    c.fillStyle = '#ff4d6d'; c.fillRect(0, 0, PW, 76);
    const ar = name ? /[؀-ۿ]/.test(name) : rtl, x0 = 62, x1 = PW - 62;
    let y = 150;
    if (name) {
      // the file you gave it: its own name, set on the page
      const face = getComputedStyle(document.body).fontFamily;
      c.fillStyle = '#06070c'; c.textBaseline = 'top'; c.direction = ar ? 'rtl' : 'ltr'; c.textAlign = ar ? 'right' : 'left';
      let size = 54; const lines = [];
      for (; size >= 30; size -= 6) {
        c.font = '600 ' + size + 'px ' + face; lines.length = 0;
        let cur = '';
        for (const ch of Array.from(name)) { if (c.measureText(cur + ch).width > x1 - x0 && cur) { lines.push(cur); cur = ch; } else cur += ch; }
        lines.push(cur);
        if (lines.length <= 3) break;
      }
      lines.slice(0, 4).forEach((l, i) => c.fillText(l, ar ? x1 : x0, y + i * size * 1.16));
      y += Math.min(lines.length, 4) * size * 1.16 + 26;
      if (more > 1) { c.font = '500 26px ' + face; c.fillStyle = '#596080'; c.fillText('+ ' + (more - 1), ar ? x1 : x0, y); y += 52; }
    } else { c.fillStyle = '#9aa0b8'; c.fillRect(x0, y, (x1 - x0) * 0.62, 20); y += 62; }
    c.fillStyle = '#b9bdd0';
    for (let i = 0; y < PH - 150; i++, y += 34) { const w = (x1 - x0) * (i % 4 === 3 ? 0.55 : 1); c.fillRect(ar ? x1 - w : x0, y, w, 11); }
    // a signature line and a tick: a finished document
    c.fillStyle = '#9aa0b8'; c.fillRect(ar ? x0 : x1 - 170, PH - 96, 170, 3);
    c.strokeStyle = '#12aa8a'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    const tx = ar ? x1 - 60 : x0; c.moveTo(tx, PH - 108); c.lineTo(tx + 18, PH - 90); c.lineTo(tx + 52, PH - 128); c.stroke();
  }

  /* ---------- WebGL ---------- */
  let gl = null, U = null, tex = null;
  function init() {
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'default' }); } catch (e) { gl = null; }
    if (!gl) return false;
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!hp || !hp.precision) return false;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return false;
    const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    U = {}; ['R', 'T', 'A', 'PY', 'K', 'FX', 'PG'].forEach((n) => { U[n] = gl.getUniformLocation(pr, n); });
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.PG, 0);
    upload();
    return true;
  }
  function upload() { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sheet); }

  /* ---------- springs: every moving value starts from where it is, and keeps its speed ---------- */
  function spring(x) { return { x: x, v: 0, to: x }; }
  // response: seconds to get there; damping 1 = no overshoot, below 1 = a little bounce
  function step(s, dt, response, damping) {
    const w = 6.2832 / response, a = -w * w * (s.x - s.to) - 2 * damping * w * s.v;
    s.v += a * dt; s.x += s.v * dt;
    return Math.abs(s.v) > 0.0004 || Math.abs(s.x - s.to) > 0.0004;
  }
  const REST = { yaw: 0.55, pitch: -0.18 };
  const yaw = spring(REST.yaw), pitch = spring(REST.pitch), slide = spring(0), flash = spring(1);
  let bounce = 1, T = 2.4, px = 0, py = 0, lean = 0, dragging = false, scale = 1, slow = 0;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const rubber = (over, dim) => (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));
  const band = (x, lo, hi, dim) => (x < lo ? lo + rubber(x - lo, dim) : x > hi ? hi + rubber(x - hi, dim) : x);

  /* ---------- drawing ---------- */
  let cw = 0, ch = 0;
  function size() {
    const r = box.getBoundingClientRect(); if (!r.width) return false;
    // never more than about a million pixels: a ray is marched for each one
    const s = Math.min(Math.min(window.devicePixelRatio || 1, 2), Math.sqrt(1.6e6 / (r.width * r.height))) * scale;
    const w = Math.max(2, Math.round(r.width * s)), h = Math.max(2, Math.round(r.height * s));
    if (w !== cw || h !== ch) { cw = canvas.width = w; ch = canvas.height = h; gl.viewport(0, 0, w, h); }
    return true;
  }
  function draw() {
    gl.uniform2f(U.R, cw, ch); gl.uniform1f(U.T, T); gl.uniform2f(U.A, yaw.x, pitch.x);
    gl.uniform1f(U.PY, slide.x); gl.uniform1f(U.K, flash.x); gl.uniform1f(U.FX, rtl ? -1 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------- the loop: runs only while there is something to show ---------- */
  let raf = 0, last = 0, seen = true, lost = false, wakeUntil = 0, warm = 0, cost = 0, shown = false;
  const probe = new Uint8Array(4);
  const ambient = () => fine.matches && innerWidth > 860 && !root.classList.contains('idle');
  function frame(now) {
    raf = 0;
    if (lost || !seen || document.hidden) return;
    const raw = last ? (now - last) / 1000 : 0.016, dt = Math.min(0.05, raw); last = now;
    // the canvas is only shown at full sharpness. It draws its first frames unseen, under the still picture;
    // if this machine keeps up it takes over, and if it ever stops keeping up the still comes back for good.
    if (raw > 0.04) { if (++slow >= 4 && !window.ND_PRISM_KEEP) { lost = true; box.classList.remove('live'); return; } }
    else if (slow > 0) slow--;
    T += dt;
    const amb = ambient();
    if (!dragging) {
      yaw.to = REST.yaw + px * 0.4 + lean * 0.35 + (amb ? 0.2 * Math.sin(T * 0.3) : 0);
      pitch.to = REST.pitch - py * 0.3 - lean * 0.22 + (amb ? 0.1 * Math.cos(T * 0.25) : 0);
    }
    let moving = false;
    if (!dragging) { moving = step(yaw, dt, 0.55, bounce) || moving; moving = step(pitch, dt, 0.55, bounce) || moving; }
    moving = step(slide, dt, 0.5, 0.82) || moving;
    moving = step(flash, dt, 0.7, 1) || moving;
    if (!moving) bounce = 1;
    if (size()) {
      if (shown) draw();
      else {
        // timed for real: reading one pixel back makes the graphics card finish the frame before the clock stops
        const t0 = performance.now(); draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe); cost += performance.now() - t0;
        if (++warm >= 10) {
          if (cost / warm > 22 && !window.ND_PRISM_KEEP) { lost = true; return; }   // too slow for this machine: the still stays
          shown = true; box.classList.add('live'); yaw.v = rtl ? 0.9 : -0.9; bounce = 0.8; wakeUntil = now + 600;
        }
      }
    }
    if (dragging || moving || amb || !shown || now < wakeUntil) raf = requestAnimationFrame(frame);   // the first ten frames run back to back, so the measurement is fair
    else last = 0;
  }
  function kick(ms) { if (ms) wakeUntil = Math.max(wakeUntil, performance.now() + ms); if (!raf && gl && !lost) raf = requestAnimationFrame(frame); }

  /* ---------- start, after the page has painted ---------- */
  function start() {
    drawSheet('');
    if (!init()) return;
    if (!size()) return;
    draw();
    kick(900);   // ten unseen frames to measure this machine; then it wakes with a small turn, so you can tell it is alive

    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    new MutationObserver(() => kick()).observe(root, { attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', () => kick(), { passive: true });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; box.classList.remove('live'); });
    canvas.addEventListener('webglcontextrestored', () => { lost = false; if (init()) { if (shown) box.classList.add('live'); kick(300); } });

    // it turns toward the pointer, wherever the pointer is on the page top
    const hero = stage.closest('section') || stage;
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || dragging) return;
      px = (e.clientX / innerWidth - 0.5) * (rtl ? -1 : 1); py = e.clientY / innerHeight - 0.5; kick();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { px = 0; py = 0; kick(); });

    // and you can take hold of it: it follows the hand 1:1 and springs back with the speed you gave it
    let gx = 0, gy = 0, y0 = 0, p0 = 0, hist = [];
    stage.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      dragging = true; stage.classList.add('grabbing'); try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      gx = e.clientX; gy = e.clientY; y0 = yaw.x; p0 = pitch.x; yaw.v = pitch.v = 0; hist = [[e.timeStamp, yaw.x, pitch.x]]; kick();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const k = 2.4 / Math.max(240, box.getBoundingClientRect().height * 0.62), dir = rtl ? -1 : 1;
      yaw.x = band(y0 - (e.clientX - gx) * k * dir, -0.75, 1.5, 1.2);
      if (e.pointerType === 'mouse') pitch.x = band(p0 + (e.clientY - gy) * k * 0.7, -0.75, 0.45, 0.8);
      hist.push([e.timeStamp, yaw.x, pitch.x]); if (hist.length > 5) hist.shift();
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false; stage.classList.remove('grabbing');
      const a = hist[0], b = hist[hist.length - 1], dt = (b[0] - a[0]) / 1000;
      if (dt > 0.01 && e.timeStamp - b[0] < 80) { yaw.v = Math.max(-9, Math.min(9, (b[1] - a[1]) / dt)); pitch.v = Math.max(-9, Math.min(9, (b[2] - a[2]) / dt)); }
      bounce = 0.78; kick();
    };
    stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release);
  }

  /* ---------- a file is coming: the glass leans toward it, then seals it in ---------- */
  API.lean = function (on) { lean = on ? 1 : 0; kick(); };
  API.take = function (name, count) {
    if (!gl || lost) return Promise.resolve();
    drawSheet(String(name || ''), count || 1); upload();
    lean = 0; slide.x = 1.9; slide.v = 0; slide.to = 0;        // the page drops in from above the glass
    pitch.v += 2.2; yaw.v += rtl ? 1.4 : -1.4; bounce = 0.74;   // and the slab takes the weight
    flash.x = 2.6; flash.to = 1;
    kick(1100);
    return new Promise((res) => setTimeout(res, 950));
  };
  /* used by tools/prism-still.js to record the still frame this page loads with */
  API.still = function (w, h, type, q) {
    if (!gl) return null;
    const keep = [yaw.x, pitch.x, slide.x, flash.x, T, cw, ch];
    yaw.x = REST.yaw; pitch.x = REST.pitch; slide.x = 0; flash.x = 1; T = 2.4;
    cw = canvas.width = w; ch = canvas.height = h; gl.viewport(0, 0, w, h); draw();
    const url = canvas.toDataURL(type || 'image/png', q);
    yaw.x = keep[0]; pitch.x = keep[1]; slide.x = keep[2]; flash.x = keep[3]; T = keep[4]; cw = 0; kick(100);
    return url;
  };

  const begin = () => requestAnimationFrame(() => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 200)));
  if (document.readyState === 'complete') begin(); else addEventListener('load', begin, { once: true });
})();
