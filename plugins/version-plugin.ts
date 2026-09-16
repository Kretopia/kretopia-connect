/**
 * Vite plugin: writes a version.json into the build output directory
 * with the same hash that is injected via define.__BUILD_VERSION__.
 */
import { Plugin } from 'vite';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';

export function versionPlugin(): { hash: string; plugin: Plugin } {
  const hash = crypto.randomBytes(8).toString('hex');

  const plugin: Plugin = {
    name: 'version-json',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      writeFileSync(
        resolve(outDir, 'version.json'),
        JSON.stringify({ version: hash }),
      );
      console.log(`[version-plugin] Wrote version.json  →  ${hash}`);
    },
  };

  return { hash, plugin };
}
