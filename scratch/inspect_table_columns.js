const fs = require('fs');
const path = require('path');

try {
    const raw = fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8');
    const schema = JSON.parse(raw);
    
    const tables = ['monthly_targets', 'daily_sales_tracking', 'conversions', 'daily_reports', 'ideas', 'follow_ups', 'notifications'];
    
    for (const t of tables) {
        console.log(`\n--- TABLE: ${t} ---`);
        const properties = schema.definitions[t]?.properties;
        if (properties) {
            console.log(Object.keys(properties));
            // Print columns containing 'date', 'month', 'amount', 'notes'
            for (const [k, v] of Object.entries(properties)) {
                if (k.includes('date') || k.includes('month') || k.includes('amount') || k.includes('notes') || k.includes('status') || k.includes('val')) {
                    console.log(`  ${k}: type=${v.type}, format=${v.format}, desc=${v.description || ''}`);
                }
            }
        } else {
            console.log("No properties found");
        }
    }
} catch (err) {
    console.error("Error:", err.message);
}
