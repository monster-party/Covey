import express from 'express';
import { createDAVClient } from 'tsdav';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildICS, parseEvents, isoDate } from './ics.js';
import {
  CALENDAR_COLORS,
  CALENDAR_ICONS,
  loadCalendarStore,
  saveCalendarStore,
} from './calendar-store.js';
import { isValidPersonImage, loadPeopleStore, savePeopleStore } from './people-store.js';
import { resolveRuntimeOptions } from './runtime-config.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export function createCoveyRuntime({
  credentials,
  dataDirectory,
  assetsDirectory = moduleDirectory,
  legacyCalendars = {},
  davClientFactory = createDAVClient,
  version = null,
  logger = console,
  statusOutput = process.stdout,
} = {}) {
if (!credentials?.username || !credentials?.password) {
  throw new Error('Covey runtime requires iCloud credentials.');
}
if (!dataDirectory) throw new Error('Covey runtime requires a data directory.');

const ICLOUD_EMAIL = credentials.username;
const ICLOUD_APP_PASSWORD = credentials.password;
const here = path.resolve(assetsDirectory);
const dataDir = path.resolve(dataDirectory);
const indexPath = path.join(here, 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error(`Covey web assets are missing index.html at ${indexPath}.`);
}
const calendarStorePath = path.join(dataDir, 'calendars.json');
const peopleStorePath = path.join(dataDir, 'people.json');
let calendars;
let people;

try {
  calendars = loadCalendarStore(calendarStorePath, {
    CALENDAR_NAME: legacyCalendars.CALENDAR_NAME,
    REMINDERS_CALENDAR: legacyCalendars.REMINDERS_CALENDAR,
    DINNER_CALENDAR: legacyCalendars.DINNER_CALENDAR,
  });
} catch (error) {
  throw new Error(`Unable to load calendar configuration: ${error.message}`);
}
try {
  people = loadPeopleStore(peopleStorePath);
} catch (error) {
  throw new Error(`Unable to load people configuration: ${error.message}`);
}
let KINDS = [...new Set(calendars.map((calendar) => calendar.type))];

let ctx = null; // cached iCloud connection
async function connect() {
  if (ctx) return ctx;
  const client = await davClientFactory({
    serverUrl: 'https://caldav.icloud.com',
    credentials: { username: ICLOUD_EMAIL, password: ICLOUD_APP_PASSWORD },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  const all = await client.fetchCalendars();
  const cals = Object.create(null);
  for (const configured of calendars) {
    const name = configured.name.toLowerCase();
    const calendar = all.find(c => String(c.displayName || '').toLowerCase() === name);
    if (!calendar) throw new Error(`No calendar named "${configured.name}". Found: ${all.map(c => c.displayName).join(', ')}`);
    cals[configured.id] = { ...configured, calendar };
  }
  return (ctx = { client, cals });
}

const wrap = fn => async (req, res) => {
  try { await fn(req, res); } catch (e) { ctx = null; logger.error?.(e); res.status(500).json({ error: e.message }); }
};

// Live status line so a long-running server doesn't look hung in an
// interactive terminal - a static one-liner with no further output can look
// identical to a frozen process. Falls back to a single static log line when
// stdout isn't a TTY (piped to a file, process manager, etc.) so logs stay clean.
let reqCount = 0;
function startStatusLine(url) {
  if (!statusOutput?.isTTY) {
    logger.info?.(`Covey is running on ${url}`);
    return () => {};
  }
  const frames = ['\u280b', '\u2819', '\u2839', '\u2838', '\u283c', '\u2834', '\u2826', '\u2827', '\u2807', '\u280f'];
  const started = Date.now();
  let frame = 0;
  const render = () => {
    const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    const spinner = frames[frame = (frame + 1) % frames.length];
    const requests = `${reqCount} request${reqCount === 1 ? '' : 's'} served`;
    statusOutput.write(`\r\x1b[2K\x1b[36m${spinner}\x1b[0m Covey is running on \x1b[1m${url}\x1b[0m  \u00b7  up ${mins}:${secs}  \u00b7  ${requests}`);
  };
  render();
  const timer = setInterval(render, 120);
  timer.unref();
  return () => {
    clearInterval(timer);
    statusOutput.write('\r\x1b[2K');
  };
}

const app = express();
const startedAt = new Date();
app.use((_req, _res, next) => { reqCount++; next(); });
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  service: 'covey-server',
  version,
  startedAt: startedAt.toISOString(),
  uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
}));
app.get('/api/status', (_req, res) => res.json({
  status: ctx ? 'connected' : 'ready',
  service: 'covey-server',
  version,
  calendars: calendars.length,
  people: people.length,
  iCloudConnected: !!ctx,
}));
app.get('/', (_req, res) => {
  const page = fs.readFileSync(indexPath, 'utf8');
  res.type('html').send(page.replace('<!--SERVER-->', '<script>window.GAGGLE_SERVER = true</script>'));
});

app.use(express.static(here, { index: false }));

const publicCalendars = () => calendars.map(({ id, name, type, color, icon }) => ({
  id,
  name,
  type,
  ...(color ? { color } : {}),
  ...(icon ? { icon } : {}),
}));
const publicPeople = () => people;
const validPersonCalendarIds = (calendarIds) =>
  Array.isArray(calendarIds) &&
  calendarIds.length <= calendars.length &&
  new Set(calendarIds).size === calendarIds.length &&
  calendarIds.every((id) =>
    typeof id === 'string' && calendars.some((calendar) => calendar.id === id && calendar.type === 'event'),
  );

app.get('/api/config', (_req, res) => res.json({
  kinds: KINDS,
  calendars: publicCalendars(),
  people: publicPeople(),
}));
app.get('/api/config/people', (_req, res) => res.json({ people: publicPeople() }));

app.post('/api/config/people', (req, res) => {
  const { name, avatar = 'person', image = null, calendarIds = [] } = req.body || {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > 60) {
    return res.status(400).json({ error: 'Person name must be 1-60 characters.' });
  }
  if (trimmedName.toLocaleLowerCase() === 'family') {
    return res.status(400).json({ error: '“Family” is reserved for shared family events.' });
  }
  if (people.some((person) => person.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
    return res.status(409).json({ error: `A person named “${trimmedName}” already exists.` });
  }
  if (!['person', 'child', 'baby', 'bird'].includes(avatar)) {
    return res.status(400).json({ error: 'Choose one of the available basic avatars.' });
  }
  if (!isValidPersonImage(image)) {
    return res.status(400).json({ error: 'Choose a valid PNG, JPEG, WebP, or built-in bird avatar image.' });
  }
  if (!validPersonCalendarIds(calendarIds)) {
    return res.status(400).json({ error: 'Choose valid event calendars for this person.' });
  }

  const baseId = trimmedName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'person';
  let id = baseId;
  let suffix = 2;
  while (people.some((person) => person.id === id)) {
    id = `${baseId}-${suffix++}`;
  }
  try {
    people = savePeopleStore(peopleStorePath, [...people, { id, name: trimmedName, avatar, image, calendarIds }]);
    res.status(201).json({ people: publicPeople(), person: people.find((person) => person.id === id) });
  } catch (error) {
    logger.error?.('Unable to save person:', error);
    res.status(500).json({ error: `Could not save person: ${error.message}` });
  }
});

app.put('/api/config/people/:id', (req, res) => {
  const person = people.find((entry) => entry.id === req.params.id);
  if (!person) {
    return res.status(404).json({ error: 'Person not found.' });
  }

  const {
    name,
    avatar = person.avatar,
    image = person.image,
    calendarIds = person.calendarIds,
  } = req.body || {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > 60) {
    return res.status(400).json({ error: 'Person name must be 1-60 characters.' });
  }
  if (trimmedName.toLocaleLowerCase() === 'family') {
    return res.status(400).json({ error: '“Family” is reserved for shared family events.' });
  }
  if (people.some((entry) => entry.id !== person.id && entry.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
    return res.status(409).json({ error: `A person named “${trimmedName}” already exists.` });
  }
  if (!['person', 'child', 'baby', 'bird'].includes(avatar)) {
    return res.status(400).json({ error: 'Choose one of the available basic avatars.' });
  }
  if (!isValidPersonImage(image)) {
    return res.status(400).json({ error: 'Choose a valid PNG, JPEG, WebP, or built-in bird avatar image.' });
  }
  if (!validPersonCalendarIds(calendarIds)) {
    return res.status(400).json({ error: 'Choose valid event calendars for this person.' });
  }

  try {
    people = savePeopleStore(peopleStorePath, people.map((entry) =>
      entry.id === person.id ? { ...entry, name: trimmedName, avatar, image, calendarIds } : entry,
    ));
    res.json({ people: publicPeople(), person: people.find((entry) => entry.id === person.id) });
  } catch (error) {
    logger.error?.('Unable to update person:', error);
    res.status(500).json({ error: `Could not update person: ${error.message}` });
  }
});

app.delete('/api/config/people/:id', (req, res) => {
  const { id } = req.params;
  if (!people.some((person) => person.id === id)) {
    return res.status(404).json({ error: 'Person not found.' });
  }
  try {
    people = savePeopleStore(peopleStorePath, people.filter((person) => person.id !== id));
    res.json({ people: publicPeople() });
  } catch (error) {
    res.status(500).json({ error: `Could not remove person: ${error.message}` });
  }
});

app.post('/api/config/calendars', async (req, res) => {
  const { name, color, icon, confirmedExisting } = req.body || {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (confirmedExisting !== true) {
    return res.status(400).json({ error: 'Confirm that this calendar already exists in iCloud.' });
  }
  if (!trimmedName || trimmedName.length > 100) {
    return res.status(400).json({ error: 'Calendar name must be 1-100 characters.' });
  }
  if (!CALENDAR_COLORS.has(color)) {
    return res.status(400).json({ error: 'Choose one of the available calendar colors.' });
  }
  if (!CALENDAR_ICONS.has(icon)) {
    return res.status(400).json({ error: 'Choose one of the available calendar icons.' });
  }
  if (calendars.some((calendar) => calendar.name.toLowerCase() === trimmedName.toLowerCase())) {
    return res.status(409).json({ error: `A calendar named "${trimmedName}" is already configured.` });
  }

  try {
    const client = ctx?.client || await davClientFactory({
      serverUrl: 'https://caldav.icloud.com',
      credentials: { username: ICLOUD_EMAIL, password: ICLOUD_APP_PASSWORD },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });
    const available = await client.fetchCalendars();
    const remote = available.find((calendar) =>
      String(calendar.displayName || '').toLowerCase() === trimmedName.toLowerCase(),
    );
    if (!remote) {
      return res.status(400).json({
        error: `No iCloud calendar named "${trimmedName}" was found. Add it to iCloud first, then try again.`,
      });
    }

    const baseId = trimmedName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'calendar';
    let id = baseId;
    let suffix = 2;
    while (calendars.some((calendar) => calendar.id === id)) {
      id = `${baseId}-${suffix++}`;
    }
    const created = { id, name: remote.displayName, type: 'event', color, icon };
    calendars = saveCalendarStore(calendarStorePath, [...calendars, created]);
    KINDS = [...new Set(calendars.map((calendar) => calendar.type))];
    ctx = null;
    res.status(201).json({ kinds: KINDS, calendars: publicCalendars(), calendar: created });
  } catch (error) {
    logger.error?.('Unable to add iCloud calendar:', error);
    res.status(502).json({ error: `Could not verify this calendar with iCloud: ${error.message}` });
  }
});

app.delete('/api/config/calendars/:id', (req, res) => {
  const { id } = req.params;
  if (['event', 'reminder', 'dinner'].includes(id)) {
    return res.status(400).json({ error: 'Built-in calendars cannot be removed here.' });
  }
  if (!calendars.some((calendar) => calendar.id === id)) {
    return res.status(404).json({ error: 'Calendar not found.' });
  }

  try {
    const previousPeople = people;
    const previousCalendars = calendars;
    try {
      people = savePeopleStore(
        peopleStorePath,
        people.map((person) => ({
          ...person,
          calendarIds: person.calendarIds.filter((calendarId) => calendarId !== id),
        })),
      );
      calendars = saveCalendarStore(
        calendarStorePath,
        calendars.filter((calendar) => calendar.id !== id),
      );
    } catch (error) {
      if (people !== previousPeople) {
        try {
          people = savePeopleStore(peopleStorePath, previousPeople);
        } catch (rollbackError) {
          logger.error?.('Unable to restore people after calendar removal failed:', rollbackError);
        }
      }
      if (calendars !== previousCalendars) {
        try {
          calendars = saveCalendarStore(calendarStorePath, previousCalendars);
        } catch (rollbackError) {
          logger.error?.('Unable to restore calendars after removal failed:', rollbackError);
        }
      }
      throw error;
    }
    KINDS = [...new Set(calendars.map((calendar) => calendar.type))];
    ctx = null;
    res.json({ kinds: KINDS, calendars: publicCalendars(), people: publicPeople() });
  } catch (error) {
    logger.error?.('Unable to remove calendar:', error);
    res.status(500).json({ error: `Could not remove calendar: ${error.message}` });
  }
});

app.put('/api/config/calendars', (req, res) => {
  try {
    calendars = saveCalendarStore(calendarStorePath, req.body?.calendars);
    KINDS = [...new Set(calendars.map((calendar) => calendar.type))];
    ctx = null;
    res.json({ kinds: KINDS, calendars: publicCalendars() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/events', wrap(async (req, res) => {
  const m = /^(\d{4})-(\d{2})$/.exec(req.query.month || '');
  if (!m) return res.status(400).json({ error: 'month=YYYY-MM required' });
  const y = +m[1], mo = +m[2];
  const from = isoDate(new Date(y, mo - 1, 1)), to = isoDate(new Date(y, mo, 0));
  const timeRange = { start: new Date(y, mo - 1, -1).toISOString(), end: new Date(y, mo, 2).toISOString() }; // padded for timezone edges
  const { client, cals } = await connect();
  const lists = await Promise.all(Object.values(cals).map(async ({ id, name, type, calendar }) => {
    const objs = await client.fetchCalendarObjects({ calendar, timeRange });
    return objs.flatMap(o => parseEvents(o, from, to)).map(e => ({
      ...e,
      kind: type,
      calendarId: id,
      calendarName: name,
      calendarColor: cals[id].color || null,
      calendarIcon: cals[id].icon || null,
    }));
  }));
  res.json(lists.flat());
}));

app.post('/api/events', wrap(async (req, res) => {
  const { t, d, tm = '', te = '', m = 'Family', kind = 'event', calendarId, personId, personIds } = req.body || {};
  const validTime = value => /^(\d{2}:\d{2})?$/.test(value);
  if (typeof t !== 'string' || !t.trim() || t.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !validTime(tm) || !validTime(te) || (te && (!tm || te <= tm)) ||
      typeof m !== 'string' || m.length > 60 || typeof kind !== 'string' ||
      (calendarId !== undefined && typeof calendarId !== 'string') ||
      (personId !== undefined && typeof personId !== 'string') ||
      (personIds !== undefined && (!Array.isArray(personIds) || personIds.length > 100 || personIds.some((id) => typeof id !== 'string')))) {
    return res.status(400).json({ error: 'Invalid event' });
  }
  const requestedPersonIds = personIds ?? (personId ? [personId] : []);
  if (new Set(requestedPersonIds).size !== requestedPersonIds.length) {
    return res.status(400).json({ error: 'Choose each person only once.' });
  }
  const assignedPeople = requestedPersonIds.map((id) => people.find((candidate) => candidate.id === id));
  if (assignedPeople.some((person) => !person) || (assignedPeople.length && kind !== 'event')) {
    return res.status(400).json({ error: 'Choose valid people for this event.' });
  }
  const { client, cals } = await connect();
  const target = calendarId
    ? cals[calendarId]
    : Object.values(cals).find((configured) => configured.type === kind);
  if (!target || target.type !== kind) return res.status(400).json({ error: `No ${kind} calendar is configured` });
  const uid = crypto.randomUUID();
  const r = await client.createCalendarObject({
    calendar: target.calendar,
    filename: `${uid}.ics`,
    iCalString: buildICS({
      uid, title: t.trim(), date: d,
      time: kind === 'event' ? tm : '',        // reminders and dinner are all-day entries
      endTime: kind === 'event' ? te : '',     // optional; defaults to one hour after start
      member: kind === 'event' ? (assignedPeople[0]?.name || m) : '',
      members: kind === 'event'
        ? (assignedPeople.length ? assignedPeople.map((person) => person.name) : [m])
        : [],
      personId: kind === 'event' ? assignedPeople[0]?.id : '',
      personIds: kind === 'event' ? assignedPeople.map((person) => person.id) : [],
      alarm: kind === 'reminder',               // reminders alert on the phone
    }),
  });
  if (!r.ok) throw new Error(`iCloud rejected the event (HTTP ${r.status})`);
  res.status(201).json({ ok: true });
}));

app.delete('/api/events', wrap(async (req, res) => {
  const { url, etag } = req.query;
  const { client, cals } = await connect();
  if (typeof url !== 'string' || !Object.values(cals).some(c => url.startsWith(c.calendar.url))) return res.status(400).json({ error: 'Bad event url' });
  const r = await client.deleteCalendarObject({ calendarObject: { url, etag: etag || undefined } });
  if (!r.ok) throw new Error(`iCloud could not delete the event (HTTP ${r.status})`);
  res.json({ ok: true });
}));

let httpServer = null;
let stopStatusLine = null;
return {
  app,
  get address() { return httpServer?.address() || null; },
  async start({ port = 3000, host } = {}) {
    if (httpServer) throw new Error('Covey server is already running.');
    await new Promise((resolve, reject) => {
      const server = app.listen(port, host, (error) => {
        if (error) {
          reject(error);
          return;
        }
        httpServer = server;
        const address = server.address();
        if (!address) {
          reject(new Error('Covey server did not receive a listening address.'));
          return;
        }
        const displayHost = !host || host === '0.0.0.0' || host === '::' ? 'localhost' : host;
        stopStatusLine = startStatusLine(`http://${displayHost}:${address.port}`);
        resolve();
      });
    });
    return this.address;
  },
  async stop() {
    if (!httpServer) return;
    const server = httpServer;
    httpServer = null;
    stopStatusLine?.();
    stopStatusLine = null;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  },
};
}

export async function startCoveyFromEnvironment(env = process.env, runtimeOverrides = {}) {
  const options = resolveRuntimeOptions({ env, rootDirectory: moduleDirectory });
  const packageVersion = JSON.parse(fs.readFileSync(path.join(moduleDirectory, 'package.json'), 'utf8')).version;
  const runtime = createCoveyRuntime({ ...options, version: packageVersion, ...runtimeOverrides });
  await runtime.start({ port: options.port, host: options.host });
  return runtime;
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  startCoveyFromEnvironment().then((runtime) => {
    const stop = async () => {
      await runtime.stop();
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }).catch((error) => {
    console.error(`Unable to start Covey: ${error.message}`);
    process.exitCode = 1;
  });
}
