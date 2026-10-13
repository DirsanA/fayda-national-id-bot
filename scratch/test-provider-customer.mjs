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

async function check(url, method = 'GET', body = null) {
  console.log(`Checking ${method} ${url}...`);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'x-api-key': apiKey,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log(`Response: ${data.slice(0, 300)}`);
  } catch (e) {
    console.error(`Error:`, e.message);
  }
}

async function run() {
  await check('https://otp.affiliate.pro.et/api/v1/balance?telegramUserId=123456');
  await check('https://otp.affiliate.pro.et/api/v1/balance?userId=123456');
  await check('https://otp.affiliate.pro.et/api/v1/customer/123456');
  await check('https://otp.affiliate.pro.et/api/v1/user/123456');
}

run();
