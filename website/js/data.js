// Shared browser/build contracts. These functions have no DOM dependencies.
export const folderPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const reservedFolders = new Set(['assets', 'css', 'js']);
const photoPattern = /^[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif|gif)$/i;
const fail = (field, message) => { throw new Error(`${field}: ${message}`); };
const object = (value, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, 'expected an object');
};
const nonblank = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) fail(field, 'expected a nonblank string');
};
export function validateFolder(value) {
  if (typeof value !== 'string' || !folderPattern.test(value) || reservedFolders.has(value)) fail('folder', 'invalid project folder name');
  return value;
}
export function validateDate(value, field = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(field, 'expected YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) fail(field, 'invalid calendar date');
  return value;
}
export function formatDate(value) {
  validateDate(value);
  const [year, month, day] = value.split('-').map(Number);
  return `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${year}`;
}
export function validateIndex(value) {
  object(value, 'index');
  if (!Array.isArray(value.projects)) fail('projects', 'expected an array');
  const seen = new Set();
  for (const folder of value.projects) {
    validateFolder(folder);
    if (seen.has(folder)) fail('projects', `duplicate folder ${folder}`);
    seen.add(folder);
  }
  return value;
}
export function validateProject(value) {
  object(value, 'project');
  nonblank(value.title, 'title');
  validateDate(value.publishedDate, 'publishedDate');
  nonblank(value.description, 'description');
  if (!Array.isArray(value.photos) || !value.photos.length) fail('photos', 'expected a nonempty array');
  const files = new Set();
  value.photos.forEach((photo, i) => {
    object(photo, `photos[${i}]`);
    if (typeof photo.file !== 'string' || !photoPattern.test(photo.file)) fail(`photos[${i}].file`, 'expected a simple image filename');
    nonblank(photo.alt, `photos[${i}].alt`);
    if (files.has(photo.file)) fail('photos', `duplicate filename ${photo.file}`);
    files.add(photo.file);
  });
  if (!Array.isArray(value.tilePhotos) || value.tilePhotos.length < 1 || value.tilePhotos.length > 4) fail('tilePhotos', 'expected 1–4 filenames');
  const selected = new Set();
  for (const file of value.tilePhotos) {
    if (!files.has(file) || selected.has(file)) fail('tilePhotos', 'filenames must be unique and selected from photos');
    selected.add(file);
  }
  const links = value.links === undefined ? [] : value.links;
  if (!Array.isArray(links)) fail('links', 'expected an array');
  links.forEach((link, i) => {
    object(link, `links[${i}]`);
    nonblank(link.label, `links[${i}].label`);
    nonblank(link.url, `links[${i}].url`);
    let url;
    try { url = new URL(link.url); } catch { fail(`links[${i}].url`, 'expected an absolute HTTPS URL'); }
    if (!/^https:\/\//i.test(link.url) || url.protocol !== 'https:' || !url.hostname || url.username || url.password) fail(`links[${i}].url`, 'expected an absolute HTTPS URL without credentials');
  });
  return { ...value, links };
}
export function validateQueueItem(value) {
  object(value, 'item');
  nonblank(value.id, 'id');
  validateDate(value.commissionedDate, 'commissionedDate');
  nonblank(value.title, 'title');
  nonblank(value.customer, 'customer');
  return value;
}
export function sortQueue(items) {
  return items.map((item, index) => ({ item, index })).sort((a, b) =>
    compareASCII(b.item.commissionedDate, a.item.commissionedDate) || a.index - b.index
  ).map(({ item }) => item);
}
export function compareASCII(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
export function sortProjects(projects) {
  return [...projects].sort((a, b) => compareASCII(b.publishedDate, a.publishedDate) || compareASCII(a.folder, b.folder));
}
export function validateQueue(value, { partial = false } = {}) {
  object(value, 'queue');
  if (!Array.isArray(value.items)) fail('items', 'expected an array');
  const items = [], errors = [], ids = new Set();
  value.items.forEach((item, index) => {
    try {
      validateQueueItem(item);
      if (ids.has(item.id)) fail('id', `duplicate job ID ${item.id}`);
      ids.add(item.id);
      items.push(item);
    } catch (error) {
      const message = `items[${index}].${error.message}`;
      if (!partial) throw new Error(message);
      errors.push(message);
    }
  });
  if (value.items.length && !items.length) fail('items', `all queue items are invalid (${errors.join('; ')})`);
  return { items: sortQueue(items), errors };
}

const cache = new Map();
const siteRoot = new URL('../', import.meta.url);
export const siteURL = path => new URL(path, siteRoot).href;
async function load(path, validate) {
  if (!cache.has(path)) {
    cache.set(path, (async () => {
      try {
        const response = await fetch(siteURL(path), { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return validate(await response.json());
      } catch (error) {
        console.error(`${path}: ${error.message}`);
        throw error;
      }
    })());
  }
  return cache.get(path);
}
export function clearCache(path) { if (path) cache.delete(path); else cache.clear(); }
export const loadIndex = () => load('projects.json', validateIndex);
export const loadQueue = () => load('queue.json', value => {
  const queue = validateQueue(value, { partial: true });
  queue.errors.forEach(error => console.error(`queue.json: ${error}`));
  return queue;
});
export async function loadProject(folder) {
  validateFolder(folder);
  const index = await loadIndex();
  if (!index.projects.includes(folder)) throw new Error(`Project not listed: ${folder}`);
  return load(`projects/${folder}/project.json`, validateProject);
}
