// The index: every demo as a card with its thumbnail, title, role, decision,
// kinds, and badges, with filters by role, by kind, and by origin (a
// standalone demo or a flow-* mirror of a graph). Reads public/index.json,
// which scripts/index.mjs writes; `thumb` is present when a thumbnail exists.

import type { DemoManifest, ViewKind } from './manifest';
import { usesSyntheticData } from './manifest';
import { tokens } from './theme';

type IndexEntry = DemoManifest & { readonly thumb?: string };
type Origin = 'all' | 'standalone' | 'flow';

const KINDS: readonly ViewKind[] = ['chart', 'drawing', 'scene3d', 'map', 'table'];
const KIND_LABEL: Record<ViewKind, string> = { chart: 'Chart', drawing: 'Drawing', scene3d: '3D', map: 'Map', table: 'Table' };

const css = `
  body { margin: 0; background: ${tokens.background}; color: ${tokens.text}; font-family: ${tokens.font}; }
  .index { max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }
  .index h1 { font-size: 26px; margin: 0 0 4px; }
  .index h1 span { color: ${tokens.dim}; font-weight: 600; }
  .index p.lead { color: ${tokens.dim}; margin: 0 0 20px; max-width: 70ch; }
  .filters { display: grid; gap: 8px 16px; grid-template-columns: max-content 1fr; align-items: baseline; margin-bottom: 20px; }
  .filters .label { font-size: 12px; font-weight: 600; color: ${tokens.dim}; text-transform: uppercase; letter-spacing: 0.04em; }
  .filters .row { display: flex; flex-wrap: wrap; gap: 6px; }
  .filters button { font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1px solid ${tokens.border}; background: ${tokens.surface}; color: ${tokens.dim}; cursor: pointer; }
  .filters button.on { border-color: ${tokens.accent}; color: ${tokens.accent}; background: ${tokens.accentSoft}; }
  .count { font-size: 13px; color: ${tokens.dim}; margin: 0 0 12px; }
  .cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .card { display: flex; flex-direction: column; background: ${tokens.surface}; border: 1px solid ${tokens.border}; border-radius: 10px; overflow: hidden; color: inherit; text-decoration: none; }
  .card:hover { border-color: ${tokens.accent}; }
  .card .thumb { aspect-ratio: 16 / 10; background: ${tokens.background}; border-bottom: 1px solid ${tokens.border}; display: grid; place-items: center; overflow: hidden; }
  .card .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .card .thumb .none { font-size: 12px; color: ${tokens.dim}; }
  .card .body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
  .card h2 { font-size: 16px; margin: 0; }
  .card .role { font-size: 12px; color: ${tokens.accent}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .card .decision { font-size: 14px; margin: 0; color: ${tokens.text}; }
  .card .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .card .meta span { font-size: 11px; padding: 2px 7px; border-radius: 999px; border: 1px solid ${tokens.border}; color: ${tokens.dim}; }
  .card .meta span.synthetic { border-color: ${tokens.changed}; color: ${tokens.changed}; }
  .card .meta span.flow { border-color: #2f66ce; color: #2f66ce; }
  .empty { color: ${tokens.dim}; padding: 24px 0; }
`;

const isFlow = (d: IndexEntry) => d.slug.startsWith('flow-');

const main = async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const app = document.getElementById('app')!;
  app.className = 'index';
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}index.json`);
  const demos = (res.ok ? ((await res.json()) as IndexEntry[]) : []).slice();

  app.innerHTML = `<h1><span>BIM Open</span> Plot · demos</h1>
    <p class="lead">Figures for the people and decisions of a construction project, drawn from public building models. Each demo is one folder with its data, its spec, and a test that renders it; a demo marked "from the graph" shows the result of a BIM Open Flow graph.</p>
    <div class="filters"></div><p class="count"></p><div class="cards"></div>`;
  const filters = app.querySelector('.filters')!;
  const count = app.querySelector('.count')!;
  const cards = app.querySelector('.cards')!;

  const roles = [...new Set(demos.map((d) => d.role))].sort();
  const state: { role: string | null; kind: ViewKind | null; origin: Origin } = { role: null, kind: null, origin: 'all' };

  const matches = (d: IndexEntry) =>
    (state.role === null || d.role === state.role) &&
    (state.kind === null || d.kinds.includes(state.kind)) &&
    (state.origin === 'all' || (state.origin === 'flow') === isFlow(d));

  const draw = () => {
    const shown = demos.filter(matches);
    count.textContent = `${shown.length} of ${demos.length} demos`;
    cards.replaceChildren(...shown.map(card));
    if (shown.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = demos.length === 0 ? 'No demos indexed yet: run `npm run demos:index`.' : 'No demo matches these filters.';
      cards.appendChild(p);
    }
    for (const b of filters.querySelectorAll('button')) {
      const { group, value } = b.dataset;
      const current = group === 'role' ? state.role : group === 'kind' ? state.kind : state.origin;
      b.classList.toggle('on', String(current) === value);
    }
  };

  const card = (d: IndexEntry) => {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = `demos/${d.slug}/`;
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (d.thumb) {
      const img = document.createElement('img');
      img.src = `${base}${d.thumb}`;
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
    } else {
      const none = document.createElement('span');
      none.className = 'none';
      none.textContent = d.kinds.map((k) => KIND_LABEL[k]).join(' · ');
      thumb.appendChild(none);
    }
    const body = document.createElement('div');
    body.className = 'body';
    body.innerHTML = `<div class="role"></div><h2></h2><p class="decision"></p><div class="meta"></div>`;
    body.querySelector('.role')!.textContent = d.role;
    body.querySelector('h2')!.textContent = d.title;
    body.querySelector('.decision')!.textContent = d.decision;
    const meta = body.querySelector('.meta')!;
    for (const k of d.kinds) meta.appendChild(pill(KIND_LABEL[k]));
    if (d.model !== 'none') meta.appendChild(pill(d.model));
    if (usesSyntheticData(d)) meta.appendChild(pill('synthetic data', 'synthetic'));
    if (isFlow(d)) meta.appendChild(pill('from the graph', 'flow'));
    a.append(thumb, body);
    return a;
  };

  const pill = (text: string, cls = '') => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  };

  const button = (group: 'role' | 'kind' | 'origin', label: string, value: string | null) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.group = group;
    b.dataset.value = String(value);
    b.onclick = () => {
      if (group === 'role') state.role = value;
      else if (group === 'kind') state.kind = value as ViewKind | null;
      else state.origin = value as Origin;
      draw();
    };
    return b;
  };

  const row = (label: string, buttons: HTMLButtonElement[]) => {
    const l = document.createElement('span');
    l.className = 'label';
    l.textContent = label;
    const r = document.createElement('div');
    r.className = 'row';
    r.append(...buttons);
    filters.append(l, r);
  };

  row('Who', [button('role', `Everyone (${demos.length})`, null), ...roles.map((r) => button('role', `${r} (${demos.filter((d) => d.role === r).length})`, r))]);
  row('Figure', [button('kind', 'Any', null), ...KINDS.filter((k) => demos.some((d) => d.kinds.includes(k))).map((k) => button('kind', KIND_LABEL[k], k))]);
  row('Origin', [button('origin', 'All', 'all'), button('origin', 'Standalone', 'standalone'), button('origin', 'From the graph', 'flow')]);
  draw();
};

void main();
