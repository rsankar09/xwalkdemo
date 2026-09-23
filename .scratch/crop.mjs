/* crop.mjs <src.png> <y> <h> <out.png>  — offset crop, since sips centre-crops */
import { chromium } from 'playwright';
import fs from 'node:fs';
const [file, y, h, out] = process.argv.slice(2);
const b64 = fs.readFileSync(file).toString('base64');
const br = await chromium.launch();
const p = await br.newPage({ viewport: { width: 1440, height: Math.min(+h, 2000) } });
await p.setContent(`<body style="margin:0"><img id="i" src="data:image/png;base64,${b64}" style="display:block;margin-top:-${y}px"></body>`);
await p.waitForFunction(() => document.getElementById('i').complete);
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1440, height: Math.min(+h, 2000) } });
await br.close();
console.log('wrote', out);
