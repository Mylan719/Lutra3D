// Optional generator for clearly labeled demonstration artwork; overwrites samples.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../website/', import.meta.url));
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(body.length); crc.writeUInt32BE(crc32(Buffer.concat([name, body])));
  return Buffer.concat([length, name, body, crc]);
}
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = pixel(x / width, y / height);
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    color.forEach((value, i) => { raw[offset + i] = value; }); raw[offset + 3] = color[3] ?? 255;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const polygon = (x, y, points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
await mkdir(`${root}/assets`, { recursive: true });
await writeFile(`${root}/assets/logo.png`, png(192, 160, (x, y) => {
  if (polygon(x,y,[[.5,.05],[.92,.3],[.5,.55],[.08,.3]])) return [83,136,117];
  if (polygon(x,y,[[.08,.35],[.47,.59],[.47,.94],[.08,.7]])) return [52,105,94];
  if (polygon(x,y,[[.53,.59],[.92,.35],[.92,.7],[.53,.94]])) return [36,78,65];
  return [255,255,255,0];
}));
const samples = [
  { folder: 'desk-organizer', title: 'Sample — modular desk organizer', date: '2026-10-05', count: 2, total: 3, color: [78,126,112], shape: 'box' },
  { folder: 'lamp-shade', title: 'Sample — ribbed lamp shade', date: '2026-10-04', count: 1, total: 1, color: [177,145,105], shape: 'lamp' },
  { folder: 'planter', title: 'Sample — geometric planter', date: '2026-10-03', count: 3, total: 3, color: [173,117,99], shape: 'pot' },
  { folder: 'tool-holder', title: 'Sample — workshop tool holder', date: '2026-10-03', count: 4, total: 4, color: [113,133,155], shape: 'box' }
];
for (const sample of samples) {
  await mkdir(`${root}/${sample.folder}`, { recursive: true });
  const photos = [];
  for (let i = 0; i < sample.total; i++) {
    const file = `view-${i + 1}.png`;
    photos.push({ file, alt: `Illustrative ${sample.shape === 'box' ? 'modular holder' : sample.shape === 'lamp' ? 'ribbed lamp shade' : 'geometric planter'} study, view ${i + 1}` });
    await writeFile(`${root}/${sample.folder}/${file}`, png(640, i === 2 ? 640 : 480, (x, y) => {
      const xx = x - (i - 1) * .025, shade = Math.round(12 * y);
      let color = [244-shade,242-shade,235-shade];
      if (((xx-.5)/.32)**2 + ((y-.79)/.06)**2 < 1) color = [211,211,202];
      let shape;
      if (sample.shape === 'lamp') shape = polygon(xx,y,[[.35,.25],[.65,.25],[.78,.73],[.22,.73]]);
      else if (sample.shape === 'pot') shape = polygon(xx,y,[[.24,.34],[.76,.34],[.67,.76],[.33,.76]]);
      else shape = polygon(xx,y,[[.22,.35],[.65,.25],[.8,.4],[.8,.72],[.37,.82],[.22,.67]]);
      if (shape) { const stripe = Math.floor(y * 180) % 3 === 0 ? -6 : 0; color = sample.color.map(c => Math.max(0,c + stripe + Math.round((xx-.5)*30))); }
      if (sample.shape === 'box' && polygon(xx,y,[[.25,.36],[.64,.28],[.75,.4],[.37,.48]])) color = sample.color.map(c => c-28);
      if (sample.shape === 'pot' && ((xx-.5)/.26)**2 + ((y-.34)/.055)**2 < 1) color = [85,73,61];
      if (sample.shape === 'lamp' && ((xx-.5)/.15)**2 + ((y-.25)/.035)**2 < 1) color = [122,105,84];
      return color;
    }));
  }
  await writeFile(`${root}/${sample.folder}/project.json`, `${JSON.stringify({
    title: sample.title, publishedDate: sample.date,
    description: 'Demonstration content for Lutra Design. The images are illustrative studies, not photographs of completed work.\n\nReplace this project with your own description and local photos, or remove its folder to unpublish it.',
    photos, tilePhotos: photos.slice(0, sample.count).map(p => p.file),
    ...(sample.folder === 'desk-organizer' ? { links: [{ label: 'Lutra3D source repository', url: 'https://github.com/mylan719/lutra3d' }] } : {})
  }, null, 2)}\n`);
}
console.log('Generated demonstration artwork and sample JSON.');
