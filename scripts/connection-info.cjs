require('dotenv/config');

const names = [
  'DATABASE_URL_MIGRATION',
  'DATABASE_URL',
  'DATABASE_URL_PRIVILEGED',
];

for (const name of names) {
  const value = process.env[name];
  if (!value) {
    console.log(`${name} username=<missing> host=<missing> port=<missing> database=<missing>`);
    continue;
  }

  try {
    const url = new URL(value);
    const port = url.port || '5432';
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    console.log(
      `${name} username=${decodeURIComponent(url.username)} host=${url.hostname} port=${port} database=${database}`,
    );
  } catch {
    console.log(`${name} username=<invalid> host=<invalid> port=<invalid> database=<invalid>`);
    process.exitCode = 1;
  }
}
