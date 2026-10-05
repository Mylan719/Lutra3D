import { lstat, readdir, readFile, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateFolder, validateProject, validateQueue, sortProjects } from '../website/js/data.js';

const repository = fileURLToPath(new URL('../', import.meta.url));
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
async function safeEntry(root, relative, directory = false) {
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw new Error(`${relative}: path escapes source root`);
  // Inspect every ancestor too, so links to directories cannot bypass file checks.
  const parts = path.relative(root, target).split(path.sep).filter(Boolean);
  let current = root;
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`${root}: expected a real directory`);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = await lstat(current); } catch { throw new Error(`${relative}: required file or directory is missing`); }
    if (stat.isSymbolicLink()) throw new Error(`${relative}: symbolic links are not permitted`);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(`${relative}: invalid parent directory`);
    if (i === parts.length - 1 && (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error(`${relative}: expected a ${directory ? 'directory' : 'file'}`);
  }
  return target;
}
async function json(root, relative, validate) {
  const file = await safeEntry(root, relative);
  try { return validate(JSON.parse(await readFile(file, 'utf8'))); }
  catch (error) { throw new Error(`${relative}: ${error.message}`); }
}
async function resourceFiles(root, directory) {
  await safeEntry(root, directory, true);
  const result = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${relative}: symbolic links are not permitted`);
    if (entry.isDirectory()) result.push(...await resourceFiles(root, relative));
    else { await safeEntry(root, relative); result.push(relative); }
  }
  return result.sort();
}
export async function buildSite({ source = path.join(repository, 'website'), output = path.join(repository, 'dist') } = {}) {
  source = path.resolve(source); output = path.resolve(output);
  // Only an adjacent, generated dist folder can ever be cleaned.
  if (output !== path.join(path.dirname(source), 'dist')) throw new Error('Output must be the dist directory adjacent to website source');
  const parentStat = await lstat(path.dirname(source));
  if (parentStat.isSymbolicLink()) throw new Error('Source parent must not be a symbolic link');
  const files = ['index.html', 'queue.json'];
  for (const file of ['index.html', 'assets/logo.png', 'css/styles.css', 'js/app.js', 'js/data.js']) await safeEntry(source, file);
  for (const icon of ['github', 'thingiverse', 'printables', 'link']) await safeEntry(source, `assets/icons/${icon}.svg`);
  await json(source, 'queue.json', validateQueue);
  for (const folder of ['assets', 'css', 'js']) files.push(...await resourceFiles(source, folder));
  const projects = [];
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`${entry.name}: symbolic links are not permitted`);
  }
  await safeEntry(source, 'projects', true);
  for (const entry of await readdir(path.join(source, 'projects'), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`projects/${entry.name}: symbolic links are not permitted`);
    if (!entry.isDirectory()) continue;
    const projectDirectory = path.join('projects', entry.name);
    const relative = path.join(projectDirectory, 'project.json');
    try { await lstat(path.join(source, relative)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    try { validateFolder(entry.name); } catch (error) { throw new Error(`${relative}: ${error.message}`); }
    const project = await json(source, relative, validateProject);
    projects.push({ folder: entry.name, publishedDate: project.publishedDate });
    files.push(relative);
    // Reject symlinks even in unreferenced project content; only selected files are copied.
    await resourceFiles(source, projectDirectory);
    for (const photo of project.photos) {
      const relativePhoto = path.join(projectDirectory, photo.file);
      await safeEntry(source, relativePhoto); files.push(relativePhoto);
    }
  }
  const index = { projects: sortProjects(projects).map(project => project.folder) };
  const indexJSON = `${JSON.stringify(index, null, 2)}\n`;
  // The source-root index is generated too; do not follow links or overwrite directories.
  try { await safeEntry(source, 'projects.json'); }
  catch (error) {
    if (!(await readdir(source)).includes('projects.json')) {
      // A first build has no generated index yet.
    } else throw error;
  }
  // All validation completes before replacing the previously built artifact.
  try {
    const stat = await lstat(output);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('dist must be a real directory');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await mkdir(path.join(output, 'projects'));
  for (const relative of files) {
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(source, relative), destination);
  }
  await writeFile(path.join(output, 'projects.json'), indexJSON);
  // Version all JS module URLs together so imported modules cannot remain stale.
  const hash = createHash('sha256');
  for (const file of files.filter(file => /\.(?:css|js)$/.test(file)).sort()) hash.update(file).update(await readFile(path.join(source, file)));
  const version = hash.digest('hex').slice(0, 12);
  const htmlFile = path.join(output, 'index.html');
  const html = await readFile(htmlFile, 'utf8');
  await writeFile(htmlFile, html.replaceAll('css/styles.css', `css/styles.css?v=${version}`).replaceAll('js/app.js', `js/app.js?v=${version}`));
  for (const file of files.filter(file => file.endsWith('.js'))) {
    const target = path.join(output, file);
    const js = await readFile(target, 'utf8');
    await writeFile(target, js.replace(/(from\s+['"])(\.[^'"]+\.js)(['"])/g, `$1$2?v=${version}$3`));
  }
  await writeFile(path.join(source, 'projects.json'), indexJSON);
  return index;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildSite().then(index => console.log(`Built dist/ with ${index.projects.length} projects.`)).catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
}
