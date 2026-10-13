import dns from 'dns/promises';

async function main() {
  try {
    const srv = await dns.resolveSrv('_mongodb._tcp.cluster0.pli2nfw.mongodb.net');
    console.log('SRV records:', srv);

    for (const record of srv) {
      const ips = await dns.resolve4(record.name);
      console.log(`${record.name} -> ${ips}`);
    }
  } catch (err) {
    console.error('DNS error:', err);
  }
}

main();
