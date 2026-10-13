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

if (!uri) {
  console.error('Error: db_url / MONGODB_URI is not defined in .env');
  process.exit(1);
}

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected successfully.');

    const db = client.db('national_id');
    const col = db.collection('customers');

    // 1. Inspect existing indexes
    console.log('\n--- 1. Inspecting Existing Indexes ---');
    const indexes = await col.indexes();
    console.log('Found indexes:');
    indexes.forEach((idx) => {
      console.log(` - Name: ${idx.name}, Key: ${JSON.stringify(idx.key)}, Unique: ${Boolean(idx.unique)}`);
    });

    const hasEquivalentIndex = indexes.some(
      (idx) =>
        idx.key &&
        Boolean(idx.key.telegramUserId) &&
        idx.unique === true
    );

    if (hasEquivalentIndex) {
      console.log('\n✅ An equivalent unique index on "telegramUserId" ALREADY exists. No duplicate index needed.');
      return;
    }

    // 2. Check document count and duplicate IDs
    console.log('\n--- 2. Inspecting Customer Documents & Checking for Duplicates ---');
    const totalDocs = await col.countDocuments();
    console.log(`Total documents in customers collection: ${totalDocs}`);

    const duplicates = await col
      .aggregate([
        { $match: { telegramUserId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$telegramUserId',
            count: { $sum: 1 },
            docIds: { $push: '$_id' },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (duplicates.length > 0) {
      console.warn(`⚠️ Found ${duplicates.length} duplicate telegramUserId groups:`);
      for (const group of duplicates) {
        console.warn(`  - telegramUserId: ${group._id} (${group.count} occurrences)`);
        
        // Safely resolve duplicate entries: preserve the newest record, clean stale duplicates
        const docs = await col
          .find({ telegramUserId: group._id })
          .sort({ updatedAt: -1, _id: -1 })
          .toArray();

        const staleDocIds = docs.slice(1).map((d) => d._id);
        if (staleDocIds.length > 0) {
          const deleteRes = await col.deleteMany({ _id: { $in: staleDocIds } });
          console.log(`    Safely cleaned ${deleteRes.deletedCount} older duplicate records for ID ${group._id}. Kept primary doc: ${docs[0]._id}`);
        }
      }
    } else {
      console.log('✅ No duplicate telegramUserId entries found.');
    }

    // 3. Create the unique index
    console.log('\n--- 3. Creating Unique Index on telegramUserId ---');
    const indexName = await col.createIndex(
      { telegramUserId: 1 },
      { unique: true, sparse: true }
    );
    console.log(`✅ Unique index created successfully: "${indexName}"`);
  } catch (err) {
    console.error('Operation failed:', err);
  } finally {
    await client.close();
  }
}

main();
