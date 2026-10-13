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

async function test() {
  console.log('Testing Fayda balance with FAYDA_API_KEY:', apiKey);
  const res = await fetch('https://otp.affiliate.pro.et/api/v1/balance', {
    headers: { 'x-api-key': apiKey }
  });
  console.log('Status:', res.status);
  const data = await res.json().catch(() => null);
  console.log('Response body:', JSON.stringify(data, null, 2));
}

test().catch(console.error);
