const fs = require('fs');
const path = require('path');

// Manually read .env
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

const secret = env.TELEGRAM_WEBHOOK_SECRET;
const validKeyA = env.FAYDA_API_KEY;

async function runTests() {
  console.log('=== TEST 1: Admin Customer Registration with Valid Key (Customer A) ===');
  const regResA = await fetch('http://localhost:3000/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUserId: 111111111,
      telegramUsername: 'customer_alpha',
      faydaApiKey: validKeyA
    })
  });
  const regDataA = await regResA.json();
  console.log('Customer A Registration result:', regDataA);

  console.log('\n=== TEST 2: Admin Registration with Invalid Key ===');
  const regResInvalid = await fetch('http://localhost:3000/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUserId: 222222222,
      telegramUsername: 'customer_beta',
      faydaApiKey: 'fayda_invalid_sample_key_999'
    })
  });
  const regDataInvalid = await regResInvalid.json();
  console.log('Invalid Key Registration result (Should fail):', regDataInvalid);

  console.log('\n=== TEST 3: Admin Customers List (GET /api/admin/customers) ===');
  const listRes = await fetch('http://localhost:3000/api/admin/customers');
  const listData = await listRes.json();
  const foundA = listData.customers?.find(c => c.telegramUserId === 111111111);
  console.log('Customer A in list:', {
    telegramUserId: foundA?.telegramUserId,
    maskedApiKey: foundA?.maskedApiKey,
    balance: foundA?.balance,
    providerLimit: foundA?.providerLimit
  });

  console.log('\n=== TEST 4: Customer A Live Balance Check via Bot (/balance) ===');
  const updateA = {
    update_id: 10001,
    message: {
      message_id: 501,
      from: { id: 111111111, is_bot: false, first_name: 'Customer A', username: 'customer_alpha' },
      chat: { id: 111111111, type: 'private' },
      text: '/balance',
      date: Math.floor(Date.now() / 1000)
    }
  };
  const botResA = await fetch('http://localhost:3000/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret
    },
    body: JSON.stringify(updateA)
  });
  console.log('Customer A /balance webhook status:', botResA.status, await botResA.json());

  console.log('\n=== TEST 5: Unregistered Customer C Balance Request (/balance) ===');
  const updateC = {
    update_id: 10002,
    message: {
      message_id: 502,
      from: { id: 333333333, is_bot: false, first_name: 'Unregistered User', username: 'unregistered' },
      chat: { id: 333333333, type: 'private' },
      text: '/balance',
      date: Math.floor(Date.now() / 1000)
    }
  };
  const botResC = await fetch('http://localhost:3000/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret
    },
    body: JSON.stringify(updateC)
  });
  console.log('Unregistered Customer C webhook status:', botResC.status, await botResC.json());

  console.log('\n=== TEST 6: Customer A Taps 🪪 Print ID Card ===');
  const printUpdateA = {
    update_id: 10003,
    message: {
      message_id: 503,
      from: { id: 111111111, is_bot: false, first_name: 'Customer A', username: 'customer_alpha' },
      chat: { id: 111111111, type: 'private' },
      text: '🪪 Print ID Card',
      date: Math.floor(Date.now() / 1000)
    }
  };
  const printResA = await fetch('http://localhost:3000/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret
    },
    body: JSON.stringify(printUpdateA)
  });
  console.log('Customer A Print ID Card webhook status:', printResA.status, await printResA.json());

  console.log('\n=== TEST 7: Unregistered Customer C Taps 🪪 Print ID Card ===');
  const printUpdateC = {
    update_id: 10004,
    message: {
      message_id: 504,
      from: { id: 333333333, is_bot: false, first_name: 'Unregistered User', username: 'unregistered' },
      chat: { id: 333333333, type: 'private' },
      text: '🪪 Print ID Card',
      date: Math.floor(Date.now() / 1000)
    }
  };
  const printResC = await fetch('http://localhost:3000/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret
    },
    body: JSON.stringify(printUpdateC)
  });
  console.log('Customer C Print ID Card webhook status:', printResC.status, await printResC.json());

  console.log('\n=== TEST 8: Admin Balance Allocation Adjustment (PATCH) ===');
  const patchRes = await fetch('http://localhost:3000/api/admin/customers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramUserId: 111111111,
      adjustment: 10
    })
  });
  const patchData = await patchRes.json();
  console.log('Customer A Balance adjustment result:', patchData);

  // Allow background processing to finish
  await new Promise(r => setTimeout(r, 3000));
  console.log('\nAll dynamic API tests completed successfully.');
}

runTests().catch(err => console.error('Test error:', err));
