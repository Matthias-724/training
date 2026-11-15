// Einfaches Liniendiagramm über die Zeit, als SVG ohne Bibliothek.
//
// Gestaltung nach festen Regeln: 2px Linie, Punkte mit Ring in Flächenfarbe,
// Hilfslinien als Haarlinie, Beschriftung in Textfarben statt Datenfarben.
// Antippen zeigt den nächstgelegenen Messpunkt. Die Liste unter dem Diagramm
// in der jeweiligen Ansicht enthält dieselben Werte als Tabelle.

import { h, s, fill } from './dom.js';
import { parseDateKey, formatNum } from '../logic.js';
import { fmtDayMonth, fmtDate } from '../format.js';

const PAD = { top: 12, right: 14, bottom: 26, left: 38 };

function niceStep(range, count) {
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function niceDomain(min, max, count = 4) {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, count);
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}

/**
 * @param points [{ date, value, status?, detail? }], älteste zuerst
 * @param opts   { label, unit, yMin, yMax, step, bands: [{ from, to, status, label }], height }
 */
export function lineChart(points, opts = {}) {
  const plot = h('div', { class: 'chart-plot', tabindex: '0', role: 'img', 'aria-label': opts.label ?? 'Diagramm' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const root = h('div', { class: 'chart' }, plot, tip);
  const height = opts.height ?? 180;
  const unit = opts.unit ? ` ${opts.unit}` : '';
  let width = 0;
  let selected = null;
  let geometry = null;

  const values = points.map((p) => p.value);
  const dom = opts.yMin != null && opts.yMax != null
    ? { lo: opts.yMin, hi: opts.yMax, step: opts.step ?? niceStep(opts.yMax - opts.yMin, 4) }
    : niceDomain(Math.min(...values), Math.max(...values));

  const times = points.map((p) => parseDateKey(p.date).getTime());
  let t0 = Math.min(...times);
  let t1 = Math.max(...times);
  if (t0 === t1) {
    t0 -= 86_400_000;
    t1 += 86_400_000;
  }

  function render() {
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const x = (t) => PAD.left + ((t - t0) / (t1 - t0)) * innerW;
    const y = (v) => PAD.top + (1 - (v - dom.lo) / (dom.hi - dom.lo)) * innerH;
    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart-svg' });

    for (const b of opts.bands ?? []) {
      const top = y(Math.min(b.to, dom.hi));
      const bottom = y(Math.max(b.from, dom.lo));
      svg.append(s('rect', { x: PAD.left, y: top, width: innerW, height: Math.max(0, bottom - top), class: `band band-${b.status}` }));
      svg.append(s('text', { x: PAD.left + innerW - 4, y: top + 11, 'text-anchor': 'end', class: 'chart-band-label' }, b.label));
    }

    for (let v = dom.lo; v <= dom.hi + dom.step / 2; v += dom.step) {
      const yy = Math.round(y(v)) + 0.5;
      svg.append(s('line', { x1: PAD.left, x2: PAD.left + innerW, y1: yy, y2: yy, class: v === dom.lo ? 'chart-axis' : 'chart-grid' }));
      svg.append(s('text', { x: PAD.left - 6, y: yy + 4, 'text-anchor': 'end', class: 'chart-tick' }, formatNum(v)));
    }

    const coords = points.map((p, i) => ({ px: x(times[i]), py: y(p.value), p }));
    if (coords.length > 1) {
      const d = coords.map((c, i) => `${i ? 'L' : 'M'}${c.px.toFixed(1)},${c.py.toFixed(1)}`).join('');
      svg.append(s('path', { d, class: 'chart-line' }));
    }

    const cross = s('line', { y1: PAD.top, y2: PAD.top + innerH, class: 'chart-cross', visibility: 'hidden' });
    svg.append(cross);

    const dots = coords.map((c) => s('circle', { cx: c.px, cy: c.py, r: 4.5, class: `chart-dot ${c.p.status ? `dot-${c.p.status}` : ''}` }));
    svg.append(...dots);

    const first = points[0].date;
    const last = points.at(-1).date;
    svg.append(s('text', { x: PAD.left, y: height - 6, 'text-anchor': 'start', class: 'chart-tick' }, fmtDayMonth(first)));
    if (last !== first) svg.append(s('text', { x: PAD.left + innerW, y: height - 6, 'text-anchor': 'end', class: 'chart-tick' }, fmtDayMonth(last)));

    // Die Trefferfläche ist das ganze Diagramm: Der Finger sucht einen Tag, keinen 2px-Strich.
    const hit = s('rect', { x: PAD.left, y: 0, width: innerW, height, class: 'chart-hit' });
    svg.append(hit);
    geometry = { coords, cross, dots };

    plot.replaceChildren(svg);
    if (selected != null) select(selected);
  }

  function nearest(clientX) {
    const rect = plot.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geometry.coords.length; i++) {
      if (Math.abs(geometry.coords[i].px - px) < Math.abs(geometry.coords[best].px - px)) best = i;
    }
    return best;
  }

  function select(i) {
    if (!geometry) return;
    selected = i;
    const c = geometry.coords[i];
    geometry.cross.setAttribute('x1', c.px);
    geometry.cross.setAttribute('x2', c.px);
    geometry.cross.setAttribute('visibility', 'visible');
    geometry.dots.forEach((d, j) => d.classList.toggle('active', j === i));
    fill(tip,
      h('strong', null, `${formatNum(c.p.value)}${unit}`),
      h('span', null, fmtDate(c.p.date)),
      c.p.detail ? h('span', null, c.p.detail) : null);
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(0, c.px - tw / 2), width - tw)}px`;
  }

  function deselect() {
    selected = null;
    tip.hidden = true;
    if (!geometry) return;
    geometry.cross.setAttribute('visibility', 'hidden');
    geometry.dots.forEach((d) => d.classList.remove('active'));
  }

  plot.addEventListener('pointerdown', (e) => select(nearest(e.clientX)));
  plot.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) select(nearest(e.clientX));
  });
  plot.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') deselect();
  });
  plot.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const n = points.length;
    const cur = selected ?? (e.key === 'ArrowLeft' ? n : -1);
    select(Math.min(n - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1))));
  });
  plot.addEventListener('blur', deselect);

  new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (w > 0 && w !== width) {
      width = w;
      render();
    }
  }).observe(plot);

  return root;
}
