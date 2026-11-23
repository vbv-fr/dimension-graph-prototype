/* Shared sample data + shared state for the Dimension Graph prototype (reports.html, index.html). */
(function (g) {
  'use strict';
  const KEY = 'dimension-graph-proto';
  const EMBED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  const DAY = 86400000, SLOT = 120000;

  // ---------- Sample instances (sample names only) ----------
  // Dimensions belong to a variant (deployment-backend dimensioning_config.variant_id); units as Edge stores them.
  const INSTANCES = [
    { name: 'Bracket Line', salt: 11, variants: [
      { name: 'Bracket 120', share: 0.62, dims: [
        { id: 'Distance_1', unit: 'mm', base: 12.40, tol: 0.05 },
        { id: 'Distance_2', unit: 'mm', base: 25.10, tol: 0.08 },
        { id: 'Angle_1', unit: '°', base: 89.8, tol: 0.3 },
        { id: 'Distance_3', unit: 'mm', base: 140.2, tol: 0.4, cross: true },
        // Shape Features type: auto-name prefix 'ShapeFeatures_' (deployment-frontend dimensionConstants.js dimensionNamePrefix)
        { id: 'ShapeFeatures_1', unit: 'mm²', base: 482.0, tol: 1.5 },
      ] },
      { name: 'Bracket 150', dims: [
        { id: 'Distance_1', unit: 'mm', base: 12.62, tol: 0.05 },
        { id: 'Angle_1', unit: '°', base: 90.15, tol: 0.3 },
      ] },
    ] },
    { name: 'Label Check', salt: 23, variants: [
      { name: 'Label 200', share: 0.55, dims: [] },
      { name: 'Label 300', dims: [] },
    ] },
  ];
  const instance = (name) => INSTANCES.find((i) => i.name === name) || null;
  const hasDims = (name) => { const i = instance(name); return !!i && i.variants.some((v) => v.dims.length > 0); };
  const dimOf = (instName, variant, id) => {
    const i = instance(instName), v = i && i.variants.find((x) => x.name === variant);
    return (v && v.dims.find((d) => d.id === id)) || null;
  };

  // ---------- Deterministic sample cycles ----------
  // One cycle about every 2 minutes, around the clock, from 1 Oct 2026 06:00 up to now. Every value is a pure
  // function of the cycle's slot, so any time range always shows the same cycles.
  const DATA_START = new Date(2026, 9, 1, 6, 0, 0, 0).getTime();
  function rnd(k, salt) {
    let x = (Math.imul(k | 0, 374761393) + Math.imul(salt | 0, 668265263)) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  function gauss(k, salt) {
    const u = Math.max(1e-9, rnd(k, salt)), v = rnd(k, salt + 7919);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const P1 = 26 * 3600000, P2 = 4.7 * 3600000;
  function valueAt(d, t, k, salt) {
    const ph1 = rnd(salt, 101) * 6.283, ph2 = rnd(salt, 202) * 6.283;
    let v = d.base + d.tol * (0.42 * Math.sin((2 * Math.PI * t) / P1 + ph1) + 0.22 * Math.sin((2 * Math.PI * t) / P2 + ph2))
      + d.tol * 0.16 * gauss(k, salt + 303);
    v = Math.min(d.base + d.tol, Math.max(d.base - d.tol, v));
    return Math.round(v * 1000) / 1000;
  }
  function dimSalt(inst, vi, di) { return inst.salt * 1000 + vi * 100 + di * 10; }

  function cycleAt(inst, k) {
    const t = DATA_START + k * SLOT + Math.floor(rnd(k, inst.salt) * 40000);
    const vi = rnd(k, inst.salt + 1) < (inst.variants[0].share || 0.5) ? 0 : 1;
    const v = inst.variants[vi], vals = {};
    let failed = false;
    v.dims.forEach((d, di) => {
      const s = dimSalt(inst, vi, di);
      if (rnd(k, s + 1) < 0.02) { vals[d.id] = null; failed = true; return; }   // failed measurement: no value
      vals[d.id] = valueAt(d, t, k, s);
    });
    const pass = !failed && rnd(k, inst.salt + 50) > 0.01;
    return { k, t, variant: v.name, vals, pass };
  }
  // Cycles of one instance with from <= time <= to (never in the future), oldest first.
  function cycles(instName, from, to) {
    const inst = instance(instName);
    if (!inst || !(to >= from)) return [];
    const end = Math.min(to, Date.now());
    if (end < DATA_START) return [];
    const k0 = Math.max(0, Math.floor((from - DATA_START) / SLOT) - 1), k1 = Math.floor((end - DATA_START) / SLOT);
    const out = [];
    for (let k = k0; k <= k1; k++) {
      const c = cycleAt(inst, k);
      if (c.t >= from && c.t <= end) out.push(c);
    }
    return out;
  }

  // ---------- Dates ----------
  const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dayEnd = (ms) => { const d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime(); };
  const todayRange = () => ({ from: dayStart(Date.now()), to: dayEnd(Date.now()) });
  // TimeRangeDropdown chip format: en-GB, 24 h, comma removed -> "23/11/2026 00:00"
  const fmtChip = (ms) => (ms == null ? null : new Date(ms).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ''));
  const rangeText = (r) => `${fmtChip(r.from)} → ${fmtChip(r.to)}`;
  const p2 = (n) => String(n).padStart(2, '0');
  const fmtTick = (ms) => { const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const fmtFull = (ms) => { const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
  // Reports Timestamp column = stopped_at formatted by the report backend: toLocaleString('en-in')
  const fmtStopped = (ms) => new Date(ms).toLocaleString('en-IN');

  // ---------- Shared state (one localStorage key) ----------
  const DEFAULTS = () => ({ instance: 'Bracket Line', variants: ['Bracket 120', 'Bracket 150'], range: todayRange(), dims: [] });
  function normalize(o) {
    const d = DEFAULTS();
    if (!o || typeof o !== 'object') return d;
    const out = {};
    out.instance = o.instance === '' ? '' : (instance(o.instance) ? o.instance : d.instance);
    const inst = instance(out.instance);
    out.variants = inst && Array.isArray(o.variants) ? o.variants.filter((v) => inst.variants.some((x) => x.name === v)) : (inst ? d.variants : []);
    const r = o.range;
    out.range = r && Number.isFinite(r.from) && Number.isFinite(r.to) && r.to > r.from ? { from: r.from, to: r.to } : d.range;
    out.dims = inst && Array.isArray(o.dims)
      ? o.dims.filter((x, i, a) => x && dimOf(out.instance, x.variant, x.id) && a.findIndex((y) => y.variant === x.variant && y.id === x.id) === i).slice(0, 6)
      : [];
    return out;
  }
  function load() {
    try { const raw = window.localStorage.getItem(KEY); return normalize(raw ? JSON.parse(raw) : null); } catch (e) { return DEFAULTS(); }
  }
  function save(s) { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ } }
  function postNav(to, extra) {
    if (!EMBED) return false;
    try { window.parent.postMessage(Object.assign({ type: 'dimension-graph-nav', to }, extra || {}), '*'); return true; } catch (e) { return false; }
  }

  g.DG = { KEY, EMBED, DAY, INSTANCES, instance, hasDims, dimOf, cycles, DATA_START, dayStart, dayEnd, todayRange,
    fmtChip, rangeText, fmtTick, fmtFull, fmtStopped, DEFAULTS, normalize, load, save, postNav };
})(window);
