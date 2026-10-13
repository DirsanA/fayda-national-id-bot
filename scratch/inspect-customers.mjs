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

async function main() {
  const uri = env.db_url;
  if (!uri) {
    console.error('No db_url found in .env');
    return;
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('national_id');
  
  const col = db.collection('customers');
  const indexes = await col.indexes();
  console.log('Existing indexes:', JSON.stringify(indexes, null, 2));

  const total = await col.countDocuments();
  console.log('Customer total count:', total);

  // Check for duplicates on telegramUserId
  const duplicates = await col.aggregate([
    { $group: { _id: '$telegramUserId', count: { $sum: 1 }, docs: { $push: '$$ROOT' } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  console.log('Duplicate groups count:', duplicates.length);
  if (duplicates.length > 0) {
    console.log('Duplicates:', JSON.stringify(duplicates, null, 2));
  }

  // Check for null or missing telegramUserId
  const nullOrMissing = await col.countDocuments({
    $or: [{ telegramUserId: { $exists: false } }, { telegramUserId: null }]
  });
  console.log('Null or missing telegramUserId count:', nullOrMissing);

  await client.close();
}

main().catch(console.error);
