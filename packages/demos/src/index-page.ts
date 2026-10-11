// The index: every demo as a card (title, role, decision, kinds, tags), with
// a tag filter. Reads public/index.json, which scripts/index.mjs writes.

import type { DemoManifest } from './manifest';
import { usesSyntheticData } from './manifest';
import { tokens } from './theme';

const css = `
  body { margin: 0; background: ${tokens.background}; color: ${tokens.text}; font-family: ${tokens.font}; }
  .index { max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }
  .index h1 { font-size: 26px; margin: 0 0 4px; }
  .index h1 span { color: ${tokens.dim}; font-weight: 600; }
  .index p.lead { color: ${tokens.dim}; margin: 0 0 20px; max-width: 70ch; }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .filters button { font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1px solid ${tokens.border}; background: ${tokens.surface}; color: ${tokens.dim}; cursor: pointer; }
  .filters button.on { border-color: ${tokens.accent}; color: ${tokens.accent}; background: ${tokens.accentSoft}; }
  .cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .card { display: block; background: ${tokens.surface}; border: 1px solid ${tokens.border}; border-radius: 10px; padding: 16px; color: inherit; text-decoration: none; }
  .card:hover { border-color: ${tokens.accent}; }
  .card h2 { font-size: 16px; margin: 0 0 6px; }
  .card .role { font-size: 12px; color: ${tokens.accent}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .card .decision { font-size: 14px; margin: 6px 0 10px; }
  .card .meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .card .meta span { font-size: 11px; padding: 2px 7px; border-radius: 999px; border: 1px solid ${tokens.border}; color: ${tokens.dim}; }
  .card .meta span.synthetic { border-color: ${tokens.changed}; color: ${tokens.changed}; }
`;

const main = async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const app = document.getElementById('app')!;
  app.className = 'index';
  const res = await fetch(`${import.meta.env.BASE_URL}index.json`);
  const demos = (res.ok ? ((await res.json()) as DemoManifest[]) : []).slice();

  app.innerHTML = `<h1><span>BIM Open</span> Plot · demos</h1>
    <p class="lead">Figures for the people and decisions of a construction project, drawn from public building models. Each demo is one folder with its data, its spec, and a test that renders it.</p>
    <div class="filters"></div><div class="cards"></div>`;
  const filters = app.querySelector('.filters')!;
  const cards = app.querySelector('.cards')!;
  const tags = [...new Set(demos.flatMap((d) => d.tags))].sort();
  let active: string | null = null;

  const draw = () => {
    cards.replaceChildren(
      ...demos
        .filter((d) => active === null || d.tags.includes(active))
        .map((d) => {
          const a = document.createElement('a');
          a.className = 'card';
          a.href = `demos/${d.slug}/`;
          a.innerHTML = `<div class="role"></div><h2></h2><p class="decision"></p><div class="meta"></div>`;
          a.querySelector('.role')!.textContent = d.role;
          a.querySelector('h2')!.textContent = d.title;
          a.querySelector('.decision')!.textContent = d.decision;
          const meta = a.querySelector('.meta')!;
          for (const k of d.kinds) meta.appendChild(pill(k));
          if (d.model !== 'none') meta.appendChild(pill(d.model));
          if (usesSyntheticData(d)) meta.appendChild(pill('synthetic data', 'synthetic'));
          return a;
        }),
    );
    if (demos.length === 0) cards.textContent = 'No demos indexed yet: run `npm run demos:index`.';
  };
  const pill = (text: string, cls = '') => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  };
  const button = (label: string, tag: string | null) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => {
      active = tag;
      for (const el of filters.children) el.classList.toggle('on', (el as HTMLButtonElement).dataset.tag === String(tag));
      draw();
    };
    b.dataset.tag = String(tag);
    if (tag === null) b.classList.add('on');
    return b;
  };
  filters.append(button(`All (${demos.length})`, null), ...tags.map((t) => button(t, t)));
  draw();
};

void main();
