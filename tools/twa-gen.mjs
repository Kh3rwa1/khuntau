// node tools/twa-gen.mjs twa/twa-manifest.json <outdir>: writes the Android (TWA) project without Bubblewrap's prompts. Needs @bubblewrap/core.
import { TwaManifest, TwaGenerator, ConsoleLog } from '@bubblewrap/core';
const [manifest, out] = process.argv.slice(2);
const m = await TwaManifest.fromFile(manifest);
await new TwaGenerator().createTwaProject(out, m, new ConsoleLog('twa'));
console.log('generated', out);
