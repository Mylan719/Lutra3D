import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, writeFile, readFile, readdir, mkdir, unlink, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../scripts/build-site.js';
const website = fileURLToPath(new URL('../website/', import.meta.url));
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lutra-build-'));
  const source = path.join(root, 'website'), output = path.join(root, 'dist');
  await cp(website, source, { recursive: true });
  t.after(async () => {
    assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('lutra-build-'));
    await rm(root, { recursive: true, force: true });
  });
  return { root, source, output };
}
async function editProject(source, edit) {
  const file = path.join(source, 'desk-organizer/project.json');
  const json = JSON.parse(await readFile(file, 'utf8')); edit(json); await writeFile(file, JSON.stringify(json));
}
async function inventory(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await inventory(root, relative)); else files.push(relative);
  }
  return files.sort();
}
test('build discovers projects, excludes unreferenced files, versions modules and is deterministic', async t => {
  const paths = await fixture(t);
  await writeFile(path.join(paths.source, 'desk-organizer/unused.png'), 'unused');
  await mkdir(path.join(paths.source, 'notes')); await writeFile(path.join(paths.source, 'notes/private.txt'), 'private');
  const index = await buildSite(paths);
  assert.deepEqual(index.projects, ['desk-organizer','lamp-shade','planter','tool-holder']);
  const files = await inventory(paths.output);
  assert.ok(!files.some(file => /unused|private|scripts|README|workflow/.test(file)));
  assert.match(await readFile(path.join(paths.output, 'index.html'), 'utf8'), /css\/styles\.css\?v=[a-f0-9]{12}/);
  assert.match(await readFile(path.join(paths.output, 'js/app.js'), 'utf8'), /\.\/data\.js\?v=[a-f0-9]{12}/);
  const first = await readFile(path.join(paths.output, 'projects.json'), 'utf8');
  await buildSite(paths); assert.equal(await readFile(path.join(paths.output, 'projects.json'), 'utf8'), first);
});
test('invalid content fails without replacing the previous artifact', async t => {
  const paths = await fixture(t); await buildSite(paths);
  const before = await readFile(path.join(paths.output, 'projects.json'), 'utf8');
  await editProject(paths.source, project => { project.publishedDate = '2026-02-30'; });
  await assert.rejects(buildSite(paths), /desk-organizer.*publishedDate/);
  assert.equal(await readFile(path.join(paths.output, 'projects.json'), 'utf8'), before);
});
test('missing photos and required assets fail with file-specific errors', async t => {
  const paths = await fixture(t);
  await unlink(path.join(paths.source, 'desk-organizer/view-1.png'));
  await assert.rejects(buildSite(paths), /desk-organizer.*view-1.png/);
  await unlink(path.join(paths.source, 'assets/logo.png'));
  await assert.rejects(buildSite(paths), /assets.*logo.png/);
});
test('invalid selections, path escapes, missing dates, duplicate IDs and malformed JSON fail', async t => {
  const paths = await fixture(t);
  for (const change of [p => { delete p.publishedDate; }, p => { p.tilePhotos = ['missing.png']; }, p => { p.photos[0].file = '../outside.png'; }]) {
    await cp(path.join(website, 'desk-organizer/project.json'), path.join(paths.source, 'desk-organizer/project.json'));
    await editProject(paths.source, change); await assert.rejects(buildSite(paths));
  }
  await cp(path.join(website, 'desk-organizer/project.json'), path.join(paths.source, 'desk-organizer/project.json'));
  const job = { id: 'duplicate', commissionedDate: '2026-10-05', title: 'Test', customer: 'Test' };
  await writeFile(path.join(paths.source, 'queue.json'), JSON.stringify({ items: [job,job] }));
  await assert.rejects(buildSite(paths), /queue.json.*duplicate/);
  await writeFile(path.join(paths.source, 'queue.json'), '{broken'); await assert.rejects(buildSite(paths), /queue.json/);
});
test('empty content builds successfully and invalid discovered folder names fail', async t => {
  const paths = await fixture(t);
  for (const folder of ['desk-organizer','lamp-shade','planter','tool-holder']) await unlink(path.join(paths.source, folder, 'project.json'));
  await writeFile(path.join(paths.source, 'queue.json'), '{"items":[]}');
  assert.deepEqual(await buildSite(paths), { projects: [] });
  await mkdir(path.join(paths.source, 'Invalid'));
  await cp(path.join(website, 'desk-organizer/project.json'), path.join(paths.source, 'Invalid/project.json'));
  await assert.rejects(buildSite(paths), /Invalid.*folder/);
});
test('source symlinks and unsafe output paths are rejected', async t => {
  const paths = await fixture(t);
  await assert.rejects(buildSite({ ...paths, output: paths.root }), /Output must/);
  try { await symlink(paths.root, path.join(paths.source, 'escape'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('Symlink creation unavailable on this host'); return; } throw error; }
  await assert.rejects(buildSite(paths), /escape.*symbolic links/);
});
