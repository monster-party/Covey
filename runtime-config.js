import path from 'node:path';

const validPort = (value) => {
  const port = Number(value);
  return Number.isInteger(port) && port >= 0 && port <= 65535;
};

export function resolveRuntimeOptions({ env = process.env, rootDirectory } = {}) {
  if (!rootDirectory) throw new Error('Covey runtime requires a root directory.');

  const username = String(env.ICLOUD_EMAIL || '').trim();
  const password = String(env.ICLOUD_APP_PASSWORD || '').trim();
  if (!username || !password) {
    throw new Error('Missing ICLOUD_EMAIL or ICLOUD_APP_PASSWORD.');
  }
  if (!validPort(env.PORT ?? 3000)) {
    throw new Error('PORT must be an integer between 0 and 65535.');
  }

  return {
    credentials: { username, password },
    dataDirectory: env.COVEY_DATA_DIR
      ? path.resolve(env.COVEY_DATA_DIR)
      : path.join(rootDirectory, 'data'),
    assetsDirectory: env.COVEY_ASSETS_DIR
      ? path.resolve(env.COVEY_ASSETS_DIR)
      : rootDirectory,
    host: env.COVEY_HOST || undefined,
    port: Number(env.PORT ?? 3000),
    legacyCalendars: {
      CALENDAR_NAME: env.CALENDAR_NAME,
      REMINDERS_CALENDAR: env.REMINDERS_CALENDAR,
      DINNER_CALENDAR: env.DINNER_CALENDAR,
    },
  };
}
