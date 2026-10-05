import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDate, formatDate, validateProject, validateIndex, validateQueue, sortProjects, sortQueue, loadIndex, loadProject, loadQueue, clearCache } from '../website/js/data.js';
const project = () => ({ title: 'Test', publishedDate: '2026-10-05', description: '<b>Literal text</b>\n\nSecond paragraph', photos: [{ file: 'front.png', alt: 'Front view' }], tilePhotos: ['front.png'] });
const item = (id, date = '2026-10-05') => ({ id, commissionedDate: date, title: 'Job', customer: 'Customer' });
test('calendar dates and timezone-free formatting', () => {
  for (const date of ['2024-02-29', '2000-02-29', '2026-10-05', '0001-01-01']) assert.equal(validateDate(date), date);
  for (const date of [undefined, '', '2026-2-03', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '0000-01-01']) assert.throws(() => validateDate(date));
  assert.equal(formatDate('2026-10-05'), '5 Oct 2026');
});
test('project contracts reject invalid dates, blank content, traversal and selections', () => {
  assert.deepEqual(validateProject(project()).links, []);
  for (const change of [{ title: ' ' }, { description: '' }, { publishedDate: undefined }, { photos: [] }, { tilePhotos: [] }, { tilePhotos: ['missing.png'] }, { tilePhotos: ['front.png','front.png'] }, { links: null }, { links: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] }, { links: [{ label: 'Relative', url: '/page' }] }]) assert.throws(() => validateProject({ ...project(), ...change }));
  for (const file of ['../front.png', '/front.png', 'a\\front.png', 'front.png?x=1', 'front.png#x', '..png', 'https://example.com/front.png']) assert.throws(() => validateProject({ ...project(), photos: [{ file, alt: 'Test' }], tilePhotos: [file] }));
  assert.throws(() => validateProject({ ...project(), photos: [project().photos[0], project().photos[0]] }));
  assert.equal(validateProject(project()).description, project().description);
});
test('index requires unique safe nonreserved folders', () => {
  assert.deepEqual(validateIndex({ projects: [] }), { projects: [] });
  for (const projects of [['a','a'], ['../a'], ['assets'], ['Uppercase'], ['a/b'], ['a--b']]) assert.throws(() => validateIndex({ projects }));
  assert.throws(() => validateIndex({ projects: 'a' }));
});
test('queue is strict at build time and tolerant of individual runtime failures', () => {
  assert.deepEqual(validateQueue({ items: [] }), { items: [], errors: [] });
  assert.throws(() => validateQueue({ items: [item('a'), item('a')] }), /duplicate/);
  assert.throws(() => validateQueue({ items: [item('a', '2026-02-30')] }), /calendar/);
  assert.throws(() => validateQueue({ items: null }, { partial: true }));
  assert.throws(() => validateQueue({ items: [{}] }, { partial: true }), /all queue items/);
  const result = validateQueue({ items: [item('a'), {}, item('a'), item('b')] }, { partial: true });
  assert.deepEqual(result.items.map(i => i.id), ['a','b']); assert.equal(result.errors.length, 2);
});
test('sorts do not mutate input and ties follow their distinct rules', () => {
  const projects = [{ folder: 'z', publishedDate: '2026-10-05' }, { folder: 'a', publishedDate: '2026-10-05' }, { folder: 'b', publishedDate: '2026-10-06' }];
  assert.deepEqual(sortProjects(projects).map(p => p.folder), ['b','a','z']); assert.equal(projects[0].folder, 'z');
  assert.deepEqual(sortQueue([item('z'), item('a'), item('b','2026-10-06')]).map(i => i.id), ['b','z','a']);
});
test('loader checks HTTP, caches results/failures, retries and protects detail fetches', async t => {
  clearCache(); const calls = []; let broken = true;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('projects.json')) return { ok: true, json: async () => ({ projects: ['test'] }) };
    if (url.endsWith('queue.json')) return { ok: false, status: 404 };
    if (broken) return { ok: true, json: async () => { throw new SyntaxError('Malformed JSON'); } };
    return { ok: true, json: async () => project() };
  });
  await loadIndex(); await loadIndex(); assert.equal(calls.length, 1);
  await assert.rejects(loadProject('unlisted')); assert.equal(calls.length, 1);
  await assert.rejects(loadProject('test')); await assert.rejects(loadProject('test')); assert.equal(calls.length, 2);
  broken = false; clearCache('test/project.json'); assert.equal((await loadProject('test')).title, 'Test');
  await assert.rejects(loadQueue(), /HTTP 404/);
  assert.ok(calls.every(call => call.options.cache === 'no-cache')); clearCache();
});
