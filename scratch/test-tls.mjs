import { MongoClient } from 'mongodb';
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

async function test(options, desc) {
  console.log(`Testing: ${desc}`);
  const client = new MongoClient(env.db_url, options);
  try {
    await client.connect();
    console.log(`SUCCESS: ${desc}`);
    const ping = await client.db('national_id').command({ ping: 1 });
    console.log(`Ping result:`, ping);
    await client.close();
    return true;
  } catch (err) {
    console.log(`FAILED (${desc}):`, err.message || err);
    await client.close().catch(() => {});
    return false;
  }
}

async function run() {
  await test({}, 'Default options');
  await test({ family: 4 }, 'IPv4 only (family: 4)');
  await test({ tls: true, tlsAllowInvalidCertificates: true }, 'tlsAllowInvalidCertificates');
  await test({ tls: true, tlsInsecure: true }, 'tlsInsecure');
}

run();
