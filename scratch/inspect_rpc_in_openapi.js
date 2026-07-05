const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.json');
const raw = fs.readFileSync(schemaPath, 'utf8');
const schema = JSON.parse(raw);

console.log("Registered RPC functions in schema.json:");
const rpcs = Object.keys(schema.paths).filter(p => p.startsWith('/rpc/'));
console.log(rpcs);
