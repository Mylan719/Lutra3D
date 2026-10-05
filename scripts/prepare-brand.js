// Prepare font-independent website assets from the supplied, unmodified logo sources.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const square = await readFile(new URL('LutraLogo2paths.svg', root), 'utf8');
const long = await readFile(new URL('LutraLogoLong.svg', root), 'utf8');
function pathData(svg, id) {
  const tag = [...svg.matchAll(/<path\b[\s\S]*?\/>/g)].map(match => match[0]).find(tag => tag.includes(`id="${id}"`));
  if (!tag) throw new Error(`Logo path missing: ${id}`);
  return /\bd="([^"]+)"/.exec(tag)[1];
}
const shape = ['path4485', 'path4487'].map(id => `<path fill="#76518f" d="${pathData(square, id)}"/>`).join('\n');
const letters = ['path4509', 'path4511', 'path4513', 'path4515', 'path4517'].map(id => `<path d="${pathData(square, id)}"/>`).join('\n');
const suffix = ['path4519', 'path4521'].map(id => `<path d="${pathData(square, id)}"/>`).join('\n');
const assets = new URL('website/assets/brand/', root);
await mkdir(assets, { recursive: true });
await writeFile(new URL('logo.svg', assets), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 380"><g transform="translate(-5.0621085 69.155472)">${shape}<g fill="#76518f">${letters}${suffix}</g></g></svg>\n`);
await writeFile(new URL('symbol.svg', assets), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="70 -48 312 300">${shape}</svg>\n`);
await writeFile(new URL('logo-horizontal.svg', assets), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 323"><g transform="translate(-35.722686 64.630079)"><path d="${pathData(long, 'path4485')}" fill="none" stroke="#76518f" stroke-width="20"/><circle cx="255.20193" cy="33.79882" r="18.877573" fill="none" stroke="#76518f" stroke-width="15"/></g><g fill="#76518f" transform="translate(320 -267.3) scale(3.1)">${letters}</g><g fill="#76518f" transform="translate(697 -587) scale(3.1)">${suffix}</g></svg>\n`);
console.log(`Prepared outlined logo assets in ${fileURLToPath(assets)}`);
