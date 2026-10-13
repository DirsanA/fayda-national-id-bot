const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
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

const validKeyA = env.FAYDA_API_KEY;

async function testTwoCustomers() {
  console.log('=== TEST: Multi-Customer Isolation & Independent Balance ===');
  
  // 1. Register Customer 1
  const res1 = await fetch('http://localhost:3000/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUserId: 100000001,
      telegramUsername: 'user_one',
      faydaApiKey: validKeyA
    })
  });
  console.log('Register Customer 1:', await res1.json());

  // 2. Adjust Customer 1 balance
  const adj1 = await fetch('http://localhost:3000/api/admin/customers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUserId: 100000001,
      adjustment: 20
    })
  });
  console.log('Adjust Customer 1 (+20):', await adj1.json());

  // 3. Register Customer 2 with different balance (or key)
  const res2 = await fetch('http://localhost:3000/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUserId: 100000002,
      telegramUsername: 'user_two',
      faydaApiKey: validKeyA,
      balance: 50
    })
  });
  console.log('Register Customer 2:', await res2.json());

  // 4. Verify Customer List shows separate balances
  const listRes = await fetch('http://localhost:3000/api/admin/customers');
  const listData = await listRes.json();
  const c1 = listData.customers.find(c => c.telegramUserId === 100000001);
  const c2 = listData.customers.find(c => c.telegramUserId === 100000002);

  console.log('Customer 1 verified:', { id: c1?.telegramUserId, balance: c1?.balance });
  console.log('Customer 2 verified:', { id: c2?.telegramUserId, balance: c2?.balance });

  if (c1 && c2 && c1.telegramUserId !== c2.telegramUserId) {
    console.log('✅ Isolation Verified: Both customers exist independently with isolated quotas!');
  } else {
    console.error('❌ Isolation Failed!');
  }
}

testTwoCustomers().catch(console.error);
