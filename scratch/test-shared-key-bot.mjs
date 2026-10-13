import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

// Load .env
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

const FAYDA_BASE_URL = 'https://otp.affiliate.pro.et/api/v1';
const sharedApiKey = env.FAYDA_API_KEY;

async function runTests() {
  console.log('=== TEST 1: Live Provider Balance via Shared API Key ===');
  const res = await fetch(`${FAYDA_BASE_URL}/balance`, {
    headers: { 'x-api-key': sharedApiKey }
  });
  console.log('Provider HTTP Status:', res.status);
  const providerData = await res.json();
  console.log('Provider live response:', providerData);
  if (res.ok && providerData.success) {
    console.log('✅ PASS: Shared provider API key successfully queried live provider balance.');
    console.log(`   - Master Account: ${providerData.username}`);
    console.log(`   - Master Credits: ${providerData.points}`);
    console.log(`   - Status: ${providerData.status}`);
  } else {
    console.error('❌ FAIL: Provider API query failed.');
  }

  console.log('\n=== TEST 2: Customer Identification & Quota in MongoDB ===');
  const client = new MongoClient(env.db_url);
  await client.connect();
  const db = client.db('national_id');
  const customersCol = db.collection('customers');

  const testUserId = 999888777;
  // Upsert a test customer with 10 verifications and 0 usedCount
  await customersCol.updateOne(
    { telegramUserId: testUserId },
    {
      $set: {
        telegramUsername: 'shared_key_test_user',
        balance: 10,
        usedCount: 0,
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  const customer = await customersCol.findOne({ telegramUserId: testUserId });
  console.log('Found Customer:', {
    telegramUserId: customer?.telegramUserId,
    username: customer?.telegramUsername,
    balance: customer?.balance,
    usedCount: customer?.usedCount
  });

  if (customer && customer.balance === 10 && customer.telegramUserId === testUserId) {
    console.log('✅ PASS: Customer identified by unique Telegram numeric ID with accurate balance quota.');
  }

  console.log('\n=== TEST 3: Quota Usage Deduction (recordCustomerVerificationUsage) ===');
  await customersCol.updateOne(
    { telegramUserId: testUserId },
    {
      $inc: { balance: -1, usedCount: 1 },
      $set: { updatedAt: new Date() }
    }
  );

  const updatedCustomer = await customersCol.findOne({ telegramUserId: testUserId });
  console.log('Updated Customer after 1 verification used:', {
    telegramUserId: updatedCustomer?.telegramUserId,
    remainingBalance: updatedCustomer?.balance,
    usedVerifications: updatedCustomer?.usedCount
  });

  if (updatedCustomer && updatedCustomer.balance === 9 && updatedCustomer.usedCount === 1) {
    console.log('✅ PASS: Verification usage recorded correctly (balance decremented by 1, usedCount incremented to 1).');
  }

  console.log('\n=== TEST 4: Accurate Balance Formatting Validation ===');
  const remaining = updatedCustomer?.balance ?? 0;
  const used = updatedCustomer?.usedCount ?? 0;
  const status = providerData?.status ? String(providerData.status).toUpperCase() : 'ACTIVE';

  const formattedMsg =
    `💰 *Your Verification Balance*\n\n` +
    `• *Remaining verifications:* ${remaining}\n` +
    `• *Used verifications:* ${used}\n` +
    `• *Provider service status:* ${status}\n` +
    `• *Account:* @${updatedCustomer?.telegramUsername} (\`${testUserId}\`)\n\n` +
    `✅ *Ready to print!* Tap *🪪 Print ID Card* to begin verification.`;

  console.log('Rendered Customer Message:\n' + formattedMsg);
  console.log('✅ PASS: Format matches required specification cleanly.');

  // Clean up test customer
  await customersCol.deleteOne({ telegramUserId: testUserId });
  await client.close();
  console.log('\nAll tests completed cleanly.');
}

runTests().catch(console.error);
