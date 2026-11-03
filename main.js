/* Verdant Genetics — landing page interactions
   Particle helix (canvas 2D) · scroll-scrubbed sprout · count-ups ·
   horizontal parallax trial fields · popping corn finale. */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  const SVGNS = "http://www.w3.org/2000/svg";
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Deterministic PRNG so illustrations are identical on every load
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* ------------------------------------------------------------------
     1. Particle helix → seed → starfield
  ------------------------------------------------------------------ */
  const state = { morph: 0 };
  const helix = (() => {
    const canvas = document.getElementById("helix");
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, S = 1, dpr = 1, N = 0, mobile = false;
    let A, B, C, D, OX, OY, SZ, COL, TW; // targets & per-particle data
    let running = true, raf = 0, last = 0, spin = 0;
    const mouse = { x: -9999, y: -9999, nx: 0, ny: 0, rx: 0, ry: 0 };

    // Glow sprites: gold, amber, pale
    const makeSprite = (core, mid) => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, core);
      grd.addColorStop(0.18, mid);
      grd.addColorStop(0.45, mid.replace(/[\d.]+\)$/, "0.25)"));
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      return c;
    };
    const sprites = [
      makeSprite("rgba(255,248,220,1)", "rgba(255,190,70,1)"),
      makeSprite("rgba(255,236,190,1)", "rgba(240,130,30,1)"),
      makeSprite("rgba(255,255,245,1)", "rgba(255,230,160,1)"),
    ];

    function build() {
      const r = rng(7);
      N = mobile ? 2400 : 4200;
      A = new Float32Array(N * 3); // helix
      B = new Float32Array(N * 3); // seed
      C = new Float32Array(N * 3); // stars
      D = new Float32Array(N * 4); // scatter xyz + delay
      OX = new Float32Array(N); OY = new Float32Array(N);
      SZ = new Float32Array(N); COL = new Uint8Array(N); TW = new Float32Array(N);

      // Helix along model Y axis
      const hl = mobile ? (H * 0.52) / S : (Math.hypot(W, H) * 0.56) / S;
      const R = mobile ? 0.36 : 0.3;
      const turns = hl * 1.5;
      const freq = (Math.PI * 2 * turns) / (2 * hl);
      const nR = Math.max(12, Math.floor(turns * 9));

      // Seed: almond with a pointed top, rounded base and a bright seam
      const Ls = 0.62, Rs = 0.4, tiltS = 0.38;
      const cs = Math.cos(tiltS), sn = Math.sin(tiltS);

      for (let i = 0; i < N; i++) {
        const k = i * 3;
        const pick = r();
        let x, y, z, col = r() < 0.5 ? 0 : 1, size = 0.9 + r() * 1.6;
        if (pick < 0.62) { // strands
          const strand = r() < 0.5 ? 0 : Math.PI;
          y = (r() * 2 - 1) * hl;
          const ang = y * freq + strand;
          const j = 0.025;
          x = R * Math.cos(ang) + (r() - 0.5) * j;
          z = R * Math.sin(ang) + (r() - 0.5) * j;
          size += 0.4;
        } else if (pick < 0.88) { // base-pair rungs
          const kk = Math.floor(r() * nR);
          y = -hl + (kk + 0.5) * ((2 * hl) / nR);
          const ang = y * freq;
          const s = r() * 2 - 1;
          x = R * s * Math.cos(ang);
          z = R * s * Math.sin(ang);
          col = 2; size *= 0.7;
        } else { // dust
          y = (r() * 2 - 1) * hl * 1.05;
          const ang = r() * Math.PI * 2, rr = R * (1.3 + r() * 2.2);
          x = rr * Math.cos(ang); z = rr * Math.sin(ang);
          size *= 0.55;
        }
        A[k] = x; A[k + 1] = y; A[k + 2] = z;

        // seed
        const sp = r();
        let u = r(), v = r() * Math.PI * 2, shell = 1;
        if (sp < 0.12) v = Math.PI / 2 + (r() - 0.5) * 0.06;         // seam
        else if (sp < 0.22) shell = Math.pow(r(), 0.6) * 0.55;        // embryo core
        const prof = Rs * Math.pow(Math.sin(Math.PI * u), 0.72) * (0.55 + 0.6 * u) * shell;
        let sx = prof * Math.cos(v), sy = (0.5 - u) * 2 * Ls, sz = prof * Math.sin(v) * 0.72;
        B[k] = sx * cs - sy * sn; B[k + 1] = sx * sn + sy * cs; B[k + 2] = sz;

        // stars
        C[k] = (r() * 2 - 1) * ((W * 0.62) / S);
        C[k + 1] = (r() * 2 - 1) * ((H * 0.62) / S);
        C[k + 2] = -1.6 + r() * 2.6;

        const sa = r() * Math.PI * 2, sb = Math.acos(r() * 2 - 1), sm = 0.6 + r() * 1.4;
        D[i * 4] = Math.sin(sb) * Math.cos(sa) * sm;
        D[i * 4 + 1] = Math.sin(sb) * Math.sin(sa) * sm;
        D[i * 4 + 2] = Math.cos(sb) * sm;
        D[i * 4 + 3] = r();
        SZ[i] = size; COL[i] = col; TW[i] = r() * Math.PI * 2;
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mobile = W < 700;
      S = Math.min(W, H) * (mobile ? 0.62 : 0.5);
      build();
      draw(performance.now());
    }

    function draw(now) {
      const m = state.morph;
      const seg = m <= 1 ? 0 : 1;
      const t = seg === 0 ? m : m - 1;
      const starW = clamp(m - 1);
      const P = seg === 0 ? A : B, Q = seg === 0 ? B : C;

      // per-state framing
      const tiltH = mobile ? -0.32 : -1.08;
      const tilt = lerp(tiltH, 0, ease(clamp(m)));
      const hcx = mobile ? W * 0.5 : W * 0.6, hcy = mobile ? H * 0.32 : H * 0.42;
      const scx = mobile ? W * 0.5 : W * 0.4, scy = mobile ? H * 0.4 : H * 0.5;
      const e1 = ease(clamp(m)), e2 = ease(starW);
      const cx = lerp(lerp(hcx, scx, e1), W * 0.5, e2);
      const cy = lerp(lerp(hcy, scy, e1), H * 0.5, e2);

      mouse.rx += (mouse.ny * 0.35 - mouse.rx) * 0.05;
      mouse.ry += (mouse.nx * 0.5 - mouse.ry) * 0.05;
      const ang = spin * (1 - starW) + spin * 0.04 * starW;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const cxr = Math.cos(mouse.rx), sxr = Math.sin(mouse.rx);
      const cyr = Math.cos(mouse.ry), syr = Math.sin(mouse.ry);
      const fov = 2.8, R2 = 130 * 130;
      const sizeMul = mobile ? 1.15 : 1.35;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < N; i++) {
        const k = i * 3, d = i * 4;
        const ti = clamp((t - D[d + 3] * 0.35) / 0.65);
        const e = ease(ti);
        const burst = Math.sin(Math.PI * e) * 0.55;
        let x = P[k] + (Q[k] - P[k]) * e + D[d] * burst;
        let y = P[k + 1] + (Q[k + 1] - P[k + 1]) * e + D[d + 1] * burst;
        let z = P[k + 2] + (Q[k + 2] - P[k + 2]) * e + D[d + 2] * burst;

        // spin about model Y
        let x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
        // tilt about Z
        let x2 = x1 * ct - y * st, y2 = x1 * st + y * ct;
        // mouse rotation about X then Y
        let y3 = y2 * cxr - z1 * sxr, z3 = y2 * sxr + z1 * cxr;
        let x4 = x2 * cyr + z3 * syr, z4 = -x2 * syr + z3 * cyr;

        if (z4 > fov - 0.25) continue;
        const persp = fov / (fov - z4);
        let px = cx + x4 * S * persp, py = cy - y3 * S * persp;

        // cursor repulsion (screen space, eased)
        const dx = px - mouse.x, dy = py - mouse.y, d2 = dx * dx + dy * dy;
        let tx = 0, ty = 0;
        if (d2 < R2 && d2 > 0.01) {
          const dist = Math.sqrt(d2), f = (1 - dist / 130) * 46;
          tx = (dx / dist) * f; ty = (dy / dist) * f;
        }
        OX[i] += (tx - OX[i]) * 0.1; OY[i] += (ty - OY[i]) * 0.1;
        px += OX[i]; py += OY[i];
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;

        let a = clamp(0.18 + (z4 + 1.2) * 0.36, 0.08, 1);
        if (starW > 0) a *= 1 - starW * 0.45 * (1 + Math.sin(now * 0.002 + TW[i]));
        const s = SZ[i] * persp * sizeMul * (1 - starW * 0.35) * 3.2;
        ctx.globalAlpha = a;
        ctx.drawImage(sprites[COL[i]], px - s * 0.5, py - s * 0.5, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      const dt = Math.min(50, now - (last || now));
      last = now;
      spin += dt * 0.00032;
      draw(now);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && running && !reduced) { last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    window.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top;
      mouse.nx = (mouse.x / W) * 2 - 1; mouse.ny = (mouse.y / H) * 2 - 1;
    }, { passive: true });
    document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; mouse.nx = mouse.ny = 0; });

    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 120); });

    new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      running ? start() : stop();
    }).observe(document.querySelector(".genesis"));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop(); else if (running) start();
    });

    resize();
    start();
    return { redraw: () => draw(performance.now()) };
  })();

  /* ------------------------------------------------------------------
     2. Trial-field landscapes (generated SVG)
  ------------------------------------------------------------------ */
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => {
    const A = hexToRgb(a), B = hexToRgb(b);
    return "#" + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, "0")).join("");
  };
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const hillPath = (base, amp, freq, phase, r) => {
    const pts = [];
    for (let x = -400; x <= 2000; x += 50) {
      const y = base - amp * (0.62 * Math.sin(x * freq + phase) + 0.38 * Math.sin(x * freq * 2.3 + phase * 1.7)) - r() * amp * 0.06;
      pts.push([x, y]);
    }
    let d = `M${pts[0][0]} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${pts[i][0]} ${pts[i][1].toFixed(1)} ${mx} ${my.toFixed(1)}`;
    }
    return d + " L2000 900 L-400 900Z";
  };

  const SCENES = {
    dawn: {
      sky: ["#232650", "#9a5b86", "#f6b089"], sun: { x: 1180, y: 540, r: 64, c: "#ffe3b4", g: "#ff9f7e" },
      hills: ["#7b5f8a", "#4c3f68", "#2e2a48"], field: ["#4c3550", "#3a2a44"], row: "#e7a7a0", fore: "#17121f", mist: "#ffd2c4",
    },
    noon: {
      sky: ["#1f6fb8", "#69b4e6", "#d9f1f6"], sun: { x: 1120, y: 190, r: 56, c: "#fffdf0", g: "#fff3b0" },
      hills: ["#86b2a6", "#5f9b4e", "#3d7b30"], field: ["#d1ad4f", "#a8842e"], row: "#fff1a8", fore: "#24501a", mist: "#ffffff",
    },
    dusk: {
      sky: ["#2c0d33", "#b23b2e", "#ffb14a"], sun: { x: 820, y: 575, r: 120, c: "#ffe797", g: "#ff7a1f" },
      hills: ["#8a3440", "#561f2e", "#30121f"], field: ["#8b3c1b", "#5c2613"], row: "#ffb35c", fore: "#160810", mist: "#ff9d4d",
    },
    night: {
      sky: ["#01030b", "#0a1634", "#1b2e5a"], sun: { x: 1230, y: 190, r: 44, c: "#eef3ff", g: "#7f9cff", moon: true },
      hills: ["#1a2b52", "#101d3a", "#091327"], field: ["#13264a", "#0b1832"], row: "#4f6fae", fore: "#03060e", mist: "#5470b8", stars: true,
    },
  };

  function buildScene(host, name, idx) {
    const s = SCENES[name], r = rng(100 + idx * 17), id = `sc-${name}`;
    const svg = el("svg", { viewBox: "0 0 1600 900", preserveAspectRatio: "xMidYMid slice", focusable: "false" });
    const defs = el("defs", {}, svg);

    const sky = el("linearGradient", { id: `${id}-sky`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    s.sky.forEach((c, i) => el("stop", { offset: [0, 0.55, 1][i], "stop-color": c }, sky));
    const glow = el("radialGradient", { id: `${id}-glow` }, defs);
    el("stop", { offset: 0, "stop-color": s.sun.g, "stop-opacity": 0.85 }, glow);
    el("stop", { offset: 0.35, "stop-color": s.sun.g, "stop-opacity": 0.25 }, glow);
    el("stop", { offset: 1, "stop-color": s.sun.g, "stop-opacity": 0 }, glow);
    const disc = el("radialGradient", { id: `${id}-disc`, cx: "40%", cy: "38%" }, defs);
    el("stop", { offset: 0, "stop-color": "#ffffff" }, disc);
    el("stop", { offset: 0.6, "stop-color": s.sun.c }, disc);
    el("stop", { offset: 1, "stop-color": mix(s.sun.c, s.sun.g, 0.5) }, disc);
    s.hills.forEach((c, i) => {
      const g = el("linearGradient", { id: `${id}-h${i}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el("stop", { offset: 0, "stop-color": mix(c, s.sun.c, 0.18 - i * 0.04) }, g);
      el("stop", { offset: 0.5, "stop-color": c }, g);
      el("stop", { offset: 1, "stop-color": mix(c, "#000000", 0.35) }, g);
    });
    const haze = el("linearGradient", { id: `${id}-haze`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": s.mist, "stop-opacity": 0 }, haze);
    el("stop", { offset: 0.6, "stop-color": s.mist, "stop-opacity": 0.45 }, haze);
    el("stop", { offset: 1, "stop-color": s.mist, "stop-opacity": 0 }, haze);
    const fhaze = el("linearGradient", { id: `${id}-fhaze`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": s.mist, "stop-opacity": 0.5 }, fhaze);
    el("stop", { offset: 1, "stop-color": s.mist, "stop-opacity": 0 }, fhaze);
    const cloud = el("radialGradient", { id: `${id}-cloud` }, defs);
    el("stop", { offset: 0, "stop-color": s.mist, "stop-opacity": 1 }, cloud);
    el("stop", { offset: 0.6, "stop-color": s.mist, "stop-opacity": 0.5 }, cloud);
    el("stop", { offset: 1, "stop-color": s.mist, "stop-opacity": 0 }, cloud);
    const fieldShade = el("linearGradient", { id: `${id}-fs`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#000", "stop-opacity": 0 }, fieldShade);
    el("stop", { offset: 1, "stop-color": "#000", "stop-opacity": 0.55 }, fieldShade);
    const clip = el("clipPath", { id: `${id}-clip` }, defs);
    el("rect", { x: -400, y: 640, width: 2400, height: 300 }, clip);

    el("rect", { x: -400, y: -100, width: 2400, height: 1100, fill: `url(#${id}-sky)` }, svg);

    const layer = (depth) => el("g", { class: "layer", "data-depth": depth }, svg);

    if (s.stars) {
      const g = layer(0.05);
      for (let i = 0; i < 160; i++) {
        el("circle", {
          cx: (r() * 2000 - 200).toFixed(0), cy: (r() * 560).toFixed(0),
          r: (0.6 + r() * r() * 2.2).toFixed(2), fill: "#e9f0ff",
          opacity: (0.3 + r() * 0.7).toFixed(2), class: r() < 0.3 ? "twinkle" : "",
        }, g);
      }
    }

    const sun = layer(0.12);
    el("circle", { cx: s.sun.x, cy: s.sun.y, r: s.sun.r * 5, fill: `url(#${id}-glow)` }, sun);
    el("circle", { cx: s.sun.x, cy: s.sun.y, r: s.sun.r, fill: `url(#${id}-disc)` }, sun);
    if (s.sun.moon) {
      el("circle", { cx: s.sun.x - 12, cy: s.sun.y + 8, r: 9, fill: "#c7d2ee", opacity: 0.5 }, sun);
      el("circle", { cx: s.sun.x + 14, cy: s.sun.y - 14, r: 6, fill: "#c7d2ee", opacity: 0.45 }, sun);
    }
    // a few drifting clouds / haze bands
    const clouds = layer(0.2);
    for (let i = 0; i < 4; i++) {
      el("ellipse", {
        cx: (r() * 1800 - 100).toFixed(0), cy: (220 + r() * 300).toFixed(0),
        rx: (180 + r() * 260).toFixed(0), ry: (10 + r() * 16).toFixed(0),
        fill: `url(#${id}-cloud)`, opacity: (name === "night" ? 0.1 : 0.3 + r() * 0.25).toFixed(2),
      }, clouds);
    }

    const bases = [560, 610, 650], amps = [70, 50, 34], depths = [0.3, 0.5, 0.7];
    s.hills.forEach((c, i) => {
      const g = layer(depths[i]);
      el("path", { d: hillPath(bases[i], amps[i], 0.0026 + i * 0.0011, r() * 6, r), fill: `url(#${id}-h${i})` }, g);
      if (i === 0) el("rect", { x: -400, y: 470, width: 2400, height: 190, fill: `url(#${id}-haze)` }, g);
    });

    // Crop field with perspective rows
    const field = layer(0.85);
    const fg = el("g", { "clip-path": `url(#${id}-clip)` }, field);
    el("rect", { x: -400, y: 640, width: 2400, height: 300, fill: s.field[1] }, fg);
    const vx = 800, vy = 560;
    for (let i = 0, x = -2400; x < 4000; x += 120, i++) {
      if (i % 2) continue;
      el("polygon", { points: `${vx},${vy} ${x},900 ${x + 70},900`, fill: s.field[0] }, fg);
      el("line", { x1: vx, y1: vy, x2: x + 70, y2: 900, stroke: s.row, "stroke-opacity": 0.25, "stroke-width": 1.4 }, fg);
    }
    el("rect", { x: -400, y: 640, width: 2400, height: 110, fill: `url(#${id}-fhaze)` }, fg);
    el("rect", { x: -400, y: 640, width: 2400, height: 260, fill: `url(#${id}-fs)` }, fg);
    if (name === "night" || name === "dawn") {
      for (let i = 0; i < 9; i++) {
        const t = 0.15 + r() * 0.85, x = vx + ((r() * 2 - 1) * 1300) * t, y = vy + (900 - vy) * t;
        if (y < 650) continue;
        el("circle", { cx: x.toFixed(0), cy: y.toFixed(0), r: (2 + t * 4).toFixed(1), fill: "#ffcf6a", class: "sensor", opacity: 0.9 }, fg);
      }
    }

    // Foreground stalks
    const fore = layer(1.2);
    let d = "";
    const f = (n) => n.toFixed(0);
    for (let x = -300; x < 1900; x += 10 + r() * 14) {
      const h = 60 + r() * 170, bend = (r() - 0.5) * 90, w = 4 + r() * 6;
      // tapered blade
      d += `M${f(x)} 910 Q${f(x + bend * 0.25)} ${f(910 - h * 0.6)} ${f(x + bend)} ${f(910 - h)} Q${f(x + bend * 0.25 + w)} ${f(910 - h * 0.55)} ${f(x + w * 1.6)} 910Z `;
      if (r() < 0.4) { // side leaf
        const ly = 910 - h * (0.3 + r() * 0.3), dir = r() < 0.5 ? -1 : 1, lx = x + bend * 0.12 + w * 0.6;
        d += `M${f(lx)} ${f(ly)} q${dir * 34} -26 ${dir * 70} -6 q${-dir * 36} -2 ${-dir * 70} 12Z `;
      }
    }
    el("path", { d, fill: s.fore }, fore);
    el("rect", { x: -400, y: 860, width: 2400, height: 60, fill: s.fore }, fore);

    host.appendChild(svg);
  }
  document.querySelectorAll("[data-scene]").forEach((h, i) => buildScene(h, h.dataset.scene, i));

  /* ------------------------------------------------------------------
     3. Corn illustration (generated kernels)
  ------------------------------------------------------------------ */
  const kernels = [];
  (() => {
    const svg = document.getElementById("corn");
    if (!svg) return;
    const top = 104, bot = 584, cx = 200;
    const rad = (y) => {
      const t = clamp((y - top) / (bot - top));
      return 88 * (0.3 + 0.7 * Math.sin(Math.min(t * 1.7, 1) * Math.PI / 2)) * (1 - 0.12 * t);
    };
    let left = "", right = "";
    for (let y = top; y <= bot; y += 10) {
      left += `${left ? " L" : "M"}${(cx - rad(y)).toFixed(1)} ${y}`;
      right = ` L${(cx + rad(y)).toFixed(1)} ${y}` + right;
    }
    const cob = `${left} Q${cx} ${bot + 30} ${(cx + rad(bot)).toFixed(1)} ${bot}${right} Q${cx} ${top - 22} ${(cx - rad(top)).toFixed(1)} ${top}Z`;
    svg.querySelector(".cn-cob").setAttribute("d", cob);
    svg.querySelector("#cn-cobpath").setAttribute("d", cob);
    svg.querySelector(".cn-shadeover").setAttribute("d", cob);

    const g = svg.querySelector(".cn-kernels");
    const cols = 11, step = 15;
    let row = 0;
    for (let y = top + 6; y < bot; y += step, row++) {
      const rr = rad(y);
      const off = row % 2 ? 0.5 : 0;
      for (let j = -1; j <= cols; j++) {
        const th = (-90 + ((j + off) / cols) * 180) * Math.PI / 180;
        if (Math.abs(th) > 1.52) continue;
        const kx = cx + rr * Math.sin(th);
        const w = Math.max(3, rr * (Math.PI / cols) * Math.cos(th) * 0.92);
        const h = step * 0.9;
        const k = el("rect", {
          x: (kx - w / 2).toFixed(1), y: (y - h / 2).toFixed(1), width: w.toFixed(1), height: h.toFixed(1),
          rx: (Math.min(w, h) * 0.45).toFixed(1), fill: "url(#cn-k)",
        }, g);
        kernels.push({ node: k, y });
      }
    }
    kernels.sort((a, b) => b.y - a.y);

    const silk = svg.querySelector(".cn-silk");
    const r = rng(3);
    for (let i = 0; i < 16; i++) {
      const sx = cx + (r() - 0.5) * 18, ex = cx + (r() - 0.5) * 170, ey = 10 + r() * 60;
      el("path", {
        d: `M${sx.toFixed(0)} ${top + 4} C ${(sx + (r() - 0.5) * 40).toFixed(0)} ${top - 40} ${(ex - (r() - 0.5) * 50).toFixed(0)} ${(ey + 40).toFixed(0)} ${ex.toFixed(0)} ${ey.toFixed(0)}`,
        "stroke-width": (0.6 + r() * 1.1).toFixed(2), opacity: (0.4 + r() * 0.6).toFixed(2),
      }, silk);
    }
  })();

  /* ------------------------------------------------------------------
     4. CTA (demo only)
  ------------------------------------------------------------------ */
  const cta = document.querySelector("[data-cta]");
  const note = document.querySelector("[data-cta-note]");
  if (cta && note) cta.addEventListener("click", () => {
    note.textContent = "Thanks for the interest — this is a portfolio demo, so no form is sent.";
  });

  /* ------------------------------------------------------------------
     5. Scroll choreography (GSAP)
  ------------------------------------------------------------------ */
  if (!hasGSAP) return;

  const steps = [...document.querySelectorAll(".step")];
  const setStep = (n) => steps.forEach((s, i) => s.classList.toggle("is-active", i === n));

  if (reduced) {
    // Everything visible in its final state; no pinning or scrubbing.
    gsap.set("[data-cap]", { opacity: 0 });
    steps.forEach((s) => s.classList.add("is-active"));
    gsap.set("#sprout-svg .seed-l", { rotation: -24, svgOrigin: "188 474" });
    gsap.set("#sprout-svg .seed-r", { rotation: 24, svgOrigin: "212 474" });
    gsap.set("#sprout-svg .sp-core", { opacity: 0.8 });
    return;
  }

  // Hero intro
  gsap.from(".hero__title .line > span", { yPercent: 110, duration: 1.3, ease: "expo.out", stagger: 0.12, delay: 0.15 });
  gsap.from(".hero .eyebrow, .hero__lead, .hero .hero__cta", { y: 24, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.1, delay: 0.5 });
  gsap.from(".nav", { y: -30, opacity: 0, duration: 1, ease: "power3.out", delay: 0.3 });

  // Genesis morph
  const gtl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".genesis", start: "top top", end: "bottom bottom", scrub: 1 },
  });
  gtl.to(".scroll-cue", { opacity: 0, duration: 0.04 }, 0)
    .to("[data-hero]", { opacity: 0, y: -60, duration: 0.12 }, 0.03)
    .to(state, { morph: 1, duration: 0.34 }, 0.08)
    .to("[data-cap='seed']", { opacity: 1, duration: 0.07 }, 0.36)
    .to("[data-cap='seed']", { opacity: 0, duration: 0.06 }, 0.55)
    .to(state, { morph: 2, duration: 0.3 }, 0.58)
    .to("[data-cap='stars']", { opacity: 1, duration: 0.07 }, 0.83)
    .to({}, { duration: 0.1 }, 0.9);

  // Sprout
  const sp = document.getElementById("sprout-svg");
  sp.querySelectorAll(".draw").forEach((p) => {
    const len = p.getTotalLength();
    gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
  });
  const leaves = [...sp.querySelectorAll(".leaf")];
  leaves.forEach((l) => gsap.set(l, { scale: 0, rotation: +l.dataset.r, svgOrigin: l.dataset.o }));
  gsap.set(sp.querySelector(".sp-halo"), { opacity: 0.3 });

  const stl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: {
      trigger: ".sprout", start: "top top", end: "+=240%", pin: true, scrub: 0.8,
      onUpdate: (self) => {
        const p = self.progress;
        setStep(p < 0.16 ? 0 : p < 0.36 ? 1 : p < 0.58 ? 2 : 3);
      },
    },
  });
  stl.to(sp.querySelector(".sp-core"), { opacity: 0.95, duration: 0.5 }, 0)
    .to([sp.querySelector(".seed-l"), sp.querySelector(".seed-r")], { y: -4, duration: 0.15, yoyo: true, repeat: 3, ease: "sine.inOut" }, 0.1)
    .to(sp.querySelector(".seed-l"), { rotation: -26, x: -6, svgOrigin: "188 474", duration: 0.6 }, 0.6)
    .to(sp.querySelector(".seed-r"), { rotation: 26, x: 6, svgOrigin: "212 474", duration: 0.6 }, 0.6)
    .to(sp.querySelectorAll(".sp-roots .draw"), { strokeDashoffset: 0, duration: 1, stagger: 0.08 }, 0.9)
    .to(sp.querySelector(".sp-stem"), { strokeDashoffset: 0, duration: 1.6, ease: "power1.inOut" }, 1.5)
    .to(sp.querySelector(".sp-halo"), { opacity: 1, duration: 1.6 }, 1.5)
    .to(leaves.slice(0, 2), { scale: 1, rotation: 0, duration: 0.8, stagger: 0.12, ease: "back.out(1.4)" }, 2.25)
    .to(leaves.slice(2, 4), { scale: 1, rotation: 0, duration: 0.7, stagger: 0.12, ease: "back.out(1.4)" }, 2.8)
    .to(leaves[4], { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2)" }, 3.15)
    .to(sp.querySelector(".sp-core"), { opacity: 0.35, duration: 0.6 }, 3)
    .to({}, { duration: 0.4 }, 3.65);

  // Stats count-up
  document.querySelectorAll("[data-count]").forEach((n) => {
    const to = parseFloat(n.dataset.count), dec = +n.dataset.decimals || 0, o = { v: 0 };
    n.textContent = (0).toFixed(dec);
    gsap.to(o, {
      v: to, duration: 2.2, ease: "power3.out",
      scrollTrigger: { trigger: n, start: "top 88%", once: true },
      onUpdate: () => { n.textContent = o.v.toFixed(dec); },
    });
  });
  gsap.from(".stat", { y: 40, opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: ".stats", start: "top 80%" } });

  // Trial fields horizontal scroll
  const track = document.querySelector("[data-track]");
  const dist = () => track.scrollWidth - window.innerWidth;
  const htween = gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: {
      trigger: ".trials__pin", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => gsap.set(".trials__progress i", { scaleX: self.progress }),
    },
  });
  document.querySelectorAll(".panel").forEach((panel, pi) => {
    panel.querySelectorAll(".layer").forEach((layer) => {
      const d = parseFloat(layer.dataset.depth) * 110;
      gsap.fromTo(layer, { x: d }, {
        x: -d, ease: "none",
        scrollTrigger: { trigger: panel, containerAnimation: htween, start: "left right", end: "right left", scrub: true },
      });
    });
    if (pi === 0) return; // first card is already in view when the pin starts
    gsap.from(panel.querySelector(".panel__card"), {
      y: 50, opacity: 0, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: panel, containerAnimation: htween, start: "left 65%", toggleActions: "play none none reverse" },
    });
  });

  // Finale: kernels pop in, bottom row first
  gsap.from(kernels.map((k) => k.node), {
    scale: 0, opacity: 0, transformOrigin: "50% 50%", ease: "back.out(3)", duration: 0.4,
    stagger: { each: 0.012 },
    scrollTrigger: { trigger: "#corn", start: "top 80%", end: "center 45%", scrub: 0.6 },
  });
  gsap.from("#corn .cn-front > path", {
    scaleX: 0.6, transformOrigin: "50% 100%", opacity: 0, duration: 1, stagger: 0.05,
    scrollTrigger: { trigger: "#corn", start: "top 85%", end: "top 40%", scrub: 0.6 },
  });
  gsap.from("#corn .cn-silk path", {
    scale: 0.2, transformOrigin: "50% 100%", opacity: 0, stagger: 0.02,
    scrollTrigger: { trigger: "#corn", start: "top 60%", end: "center 40%", scrub: 0.6 },
  });
  gsap.from(".finale__title, .finale__lead, .finale .hero__cta", {
    y: 60, opacity: 0, duration: 1.1, stagger: 0.12, ease: "power3.out",
    scrollTrigger: { trigger: ".finale", start: "top 65%" },
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
