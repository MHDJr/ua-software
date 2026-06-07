const fs = require('fs');

try {
    const raw = fs.readFileSync('scratch/schema.json', 'utf8');
    const schema = JSON.parse(raw);
    
    console.log("academy_sales_targets definition:");
    console.log(JSON.stringify(schema.definitions.academy_sales_targets, null, 2));
    
    console.log("\nacademy_financial_targets definition:");
    console.log(JSON.stringify(schema.definitions.academy_financial_targets, null, 2));
} catch (err) {
    console.error("Error:", err.message);
}
