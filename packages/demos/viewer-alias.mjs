// Resolves @bim-open-viewer/* and three to the pinned viewer checkout under
// deps/, as the viewer's own gallery does, so the demos need no built dist
// and share one copy of three with the viewer's code.
import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const viewerRoot = resolve(here, '../../deps/bim-open-viewer');

export const viewerAlias = () => {
  const packages = resolve(viewerRoot, 'packages');
  const alias = {};
  for (const name of readdirSync(packages)) {
    const entry = resolve(packages, name, 'src/index.ts');
    if (existsSync(entry)) alias[`@bim-open-viewer/${name}`] = entry;
  }
  // core resolves from its built dist, as the viewer's own gallery does.
  alias['@bim-open-viewer/core'] = resolve(packages, 'core/dist/index.js');
  alias.three = resolve(viewerRoot, 'node_modules/three');
  return alias;
};
