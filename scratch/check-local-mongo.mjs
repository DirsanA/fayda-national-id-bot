import { MongoClient } from 'mongodb';

async function main() {
  try {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    await client.connect();
    const dbs = await client.db().admin().listDatabases();
    console.log('Local databases:', dbs.databases.map(d => d.name));

    // Check if national_id database exists locally
    const db = client.db('national_id');
    const cols = await db.listCollections().toArray();
    console.log('national_id collections:', cols.map(c => c.name));

    if (cols.some(c => c.name === 'customers')) {
      const col = db.collection('customers');
      const count = await col.countDocuments();
      const indexes = await col.indexes();
      console.log('customers count in local national_id:', count);
      console.log('customers indexes:', JSON.stringify(indexes, null, 2));
    }

    await client.close();
  } catch (err) {
    console.log('Local MongoDB error:', err.message);
  }
}

main();
