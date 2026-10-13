import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// Load .env
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      value = value.trim().replace(/^['"](.*)['"]$/, '$1');
      process.env[match[1]] = value;
    }
  });
}

const uri = process.env.db_url || process.env.MONGODB_URI;

async function verify() {
  console.log('Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to Atlas successfully!');
  
  const db = client.db('national_id');
  const col = db.collection('customers');

  const count = await col.countDocuments();
  console.log(`Current customer count: ${count}`);

  const indexes = await col.indexes();
  console.log('\nCurrent Customer Collection Indexes:');
  indexes.forEach(idx => {
    console.log(` - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${Boolean(idx.unique)})`);
  });

  await client.close();
  console.log('\nVerification completed cleanly.');
}

verify().catch(console.error);
