const fs = require('fs');
const path = require('path');

try {
    const raw = fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8');
    const schema = JSON.parse(raw);
    
    console.log("All tables in schema:");
    const tables = Object.keys(schema.definitions);
    console.log(tables);
    
    console.log("\nSearching for references to profile / user ID:");
    for (const [tableName, definition] of Object.entries(schema.definitions)) {
        if (!definition.properties) continue;
        for (const [colName, colDef] of Object.entries(definition.properties)) {
            // If the column name looks like a user/profile ID or references it
            const desc = colDef.description || '';
            if (colName.includes('user') || colName.includes('profile') || colName === 'assigned_to' || colName === 'submitted_by' || colName === 'knocked_by' || desc.includes('profile') || desc.includes('users')) {
                console.log(`Table: ${tableName}, Column: ${colName}, Type: ${colDef.type}, Description: ${desc}`);
            }
        }
    }
} catch (err) {
    console.error("Error:", err.message);
}
