const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.json');
const raw = fs.readFileSync(schemaPath, 'utf8');
const schema = JSON.parse(raw);

const targetTables = [
    'financial_entries',
    'daily_sales_tracking',
    'leads',
    'requests',
    'tasks',
    'staff_presence',
    'profiles',
    'conversions'
];

console.log("TABLE FIELDS DETAIL:\n");
for (const table of targetTables) {
    const def = schema.definitions[table];
    if (!def) {
        console.log(`Table '${table}' not found in schema.json`);
        continue;
    }
    console.log(`=== ${table.toUpperCase()} ===`);
    if (def.properties) {
        for (const [col, colDef] of Object.entries(def.properties)) {
            console.log(` - ${col}: ${colDef.type} (${colDef.format || ''}) - ${colDef.description || ''}`);
        }
    }
    console.log();
}
