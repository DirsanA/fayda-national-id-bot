import tls from 'tls';

const host = 'ac-fabhsdn-shard-00-00.pli2nfw.mongodb.net';
const port = 27017;

console.log(`Connecting to ${host}:${port}...`);
const socket = tls.connect(port, host, {
  servername: host,
  rejectUnauthorized: false
}, () => {
  console.log('TLS Handshake successful!');
  socket.end();
});

socket.on('error', (err) => {
  console.error('TLS Handshake failed:', err);
});
