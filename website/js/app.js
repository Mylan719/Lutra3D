import { loadIndex, loadProject, loadQueue, clearCache, siteURL, validateFolder, formatDate } from './data.js';

const main = document.querySelector('main');
const announcement = document.querySelector('#announcement');
let navigationToken = 0;
const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
const say = message => { announcement.textContent = message; };
function show(view, title, token) {
  if (token !== navigationToken) return;
  main.replaceChildren(view);
  document.title = `${title} · Lutra Design`;
  window.scrollTo(0, 0);
  view.querySelector('h1').focus({ preventScroll: true });
}
function message(title, text, { retry, back = false } = {}) {
  const view = clone('message-view');
  view.querySelector('h1').textContent = title;
  view.querySelector('[data-message]').textContent = text;
  const button = view.querySelector('button');
  if (retry) { button.hidden = false; button.addEventListener('click', retry); }
  view.querySelector('a').hidden = !back;
  return view;
}
function photo(folder, entry, eager) {
  const frame = clone('photo');
  const img = frame.querySelector('img');
  img.alt = entry.alt;
  img.loading = eager ? 'eager' : 'lazy';
  img.addEventListener('error', () => {
    frame.classList.add('unavailable');
    frame.querySelector('figcaption').hidden = false;
    frame.querySelector('figcaption').textContent = `Photo unavailable: ${entry.alt}`;
  }, { once: true });
  img.src = siteURL(`${folder}/${entry.file}`);
  return frame;
}
function warning(view, text, retry) {
  const notice = view.querySelector('[data-notice]');
  notice.hidden = false;
  notice.textContent = text;
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Retry'; button.addEventListener('click', retry);
    notice.append(button);
  }
}
function resourceLinks(view, project) {
  const list = view.querySelector('.resource-links');
  list.hidden = !project.links.length;
  list.setAttribute('aria-label', `Resources for ${project.title}`);
  for (const link of project.links) {
    const hostname = new URL(link.url).hostname.toLowerCase();
    const service = ['github', 'thingiverse', 'printables'].find(name =>
      hostname === `${name}.com` || hostname.endsWith(`.${name}.com`)
    ) || 'link';
    const item = clone('resource-link');
    const anchor = item.querySelector('a');
    anchor.href = link.url;
    anchor.querySelector('span').textContent = link.label;
    anchor.querySelector('img').src = siteURL(`assets/icons/${service}.svg`);
    list.append(item);
  }
}
function parseRoute() {
  const hash = location.hash;
  if (!hash || hash === '#/gallery' || hash === '#main-content') return { name: 'gallery' };
  if (hash === '#/queue') return { name: 'queue' };
  const match = /^#\/project\/([^/]+)$/.exec(hash);
  if (match) {
    try { return { name: 'project', folder: validateFolder(match[1]) }; }
    catch { return { name: 'missing-project' }; }
  }
  return { name: 'not-found' };
}
async function gallery(token) {
  const index = await loadIndex();
  const results = await Promise.allSettled(index.projects.map(loadProject));
  if (token !== navigationToken) return;
  const failed = index.projects.filter((_, i) => results[i].status === 'rejected');
  const retry = () => { failed.forEach(folder => clearCache(`${folder}/project.json`)); route(); };
  if (index.projects.length && failed.length === index.projects.length) {
    show(message('Gallery', 'The projects could not be loaded. Please try again.', { retry }), 'Gallery', token);
    say('The projects could not be loaded.'); return;
  }
  const view = clone('gallery-view');
  const list = view.querySelector('[data-list]');
  let visible = 0;
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const project = result.value, folder = index.projects[i];
    const card = clone('project-card');
    card.querySelector('.project-link').href = `#/project/${folder}`;
    card.querySelector('h2').textContent = project.title;
    const collage = card.querySelector('.collage');
    collage.classList.add(`photos-${project.tilePhotos.length}`);
    project.tilePhotos.forEach(file => collage.append(photo(folder, project.photos.find(p => p.file === file), visible === 0)));
    resourceLinks(card, project);
    list.append(card); visible++;
  });
  if (!index.projects.length) view.querySelector('[data-empty]').textContent = 'No projects yet.';
  if (failed.length) warning(view, 'Some projects could not be loaded.', retry);
  show(view, 'Gallery', token);
  say(failed.length ? 'Gallery loaded. Some projects could not be loaded.' : `${visible} projects loaded.`);
}
async function detail(folder, token) {
  const index = await loadIndex();
  if (token !== navigationToken) return;
  if (!index.projects.includes(folder)) {
    show(message('Project not found.', 'Choose a project from the gallery.', { back: true }), 'Project not found', token);
    say('Project not found.'); return;
  }
  let project;
  try { project = await loadProject(folder); }
  catch {
    if (token !== navigationToken) return;
    show(message('This project could not be loaded', 'Please try again.', {
      retry: () => { clearCache(`${folder}/project.json`); route(); }, back: true
    }), 'Project unavailable', token);
    say('This project could not be loaded.'); return;
  }
  if (token !== navigationToken) return;
  const view = clone('project-view');
  view.querySelector('h1').textContent = project.title;
  view.querySelector('.description').textContent = project.description;
  resourceLinks(view, project);
  project.photos.forEach((entry, i) => view.querySelector('.detail-photos').append(photo(folder, entry, i === 0)));
  show(view, project.title, token); say(`${project.title} loaded.`);
}
async function queue(token) {
  const data = await loadQueue();
  if (token !== navigationToken) return;
  const view = clone('queue-view');
  for (const item of data.items) {
    const card = clone('queue-card');
    card.querySelector('h2').textContent = item.title;
    card.querySelector('[data-customer]').textContent = item.customer;
    const time = card.querySelector('time');
    time.dateTime = item.commissionedDate; time.textContent = formatDate(item.commissionedDate);
    view.querySelector('[data-list]').append(card);
  }
  if (!data.items.length) view.querySelector('[data-empty]').textContent = 'No upcoming jobs.';
  if (data.errors.length) warning(view, 'Some upcoming jobs could not be loaded.', () => { clearCache('queue.json'); route(); });
  show(view, 'Queue', token);
  say(data.errors.length ? 'Queue loaded. Some upcoming jobs could not be loaded.' : `${data.items.length} upcoming jobs loaded.`);
}
async function route() {
  const token = ++navigationToken, current = parseRoute();
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = current.name === 'queue' ? 'queue' : ['gallery', 'project', 'missing-project'].includes(current.name) ? 'gallery' : '';
    if (link.dataset.nav === active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (current.name === 'missing-project' || current.name === 'not-found') {
    const title = current.name === 'missing-project' ? 'Project not found.' : 'Page not found.';
    show(message(title, 'Return to the gallery to explore our projects.', { back: true }), title, token); say(title); return;
  }
  const title = current.name === 'queue' ? 'Queue' : current.name === 'project' ? 'Project' : 'Gallery';
  show(message(title, 'Loading…'), title, token); say(`Loading ${title.toLowerCase()}…`);
  try {
    if (current.name === 'gallery') await gallery(token);
    else if (current.name === 'queue') await queue(token);
    else await detail(current.folder, token);
  } catch {
    if (token !== navigationToken) return;
    const text = current.name === 'queue' ? 'The queue could not be loaded.' : current.name === 'project' ? 'This project could not be loaded' : 'The gallery could not be loaded.';
    show(message(title, `${text} Please try again.`, { retry: () => { clearCache(current.name === 'queue' ? 'queue.json' : 'projects.json'); route(); }, back: current.name === 'project' }), title, token);
    say(text);
  }
}
document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); main.focus(); main.scrollIntoView(); });
window.addEventListener('hashchange', route);
route();
