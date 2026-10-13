import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"](.*)['"]$/, '$1');
    env[match[1]] = value;
  }
});

const apiKey = env.FAYDA_API_KEY;

async function check(url) {
  try {
    const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
    const text = await res.text();
    console.log(`${url} -> Status ${res.status}: ${text.slice(0, 150)}`);
  } catch (e) {
    console.log(`${url} -> Error: ${e.message}`);
  }
}

async function run() {
  await check('https://otp.affiliate.pro.et/api-docs');
  await check('https://otp.affiliate.pro.et/docs');
  await check('https://otp.affiliate.pro.et/api/v1');
  await check('https://otp.affiliate.pro.et/api/v1/usage');
  await check('https://otp.affiliate.pro.et/api/v1/users');
}

run();
