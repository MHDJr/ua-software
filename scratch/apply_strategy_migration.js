const fs = require("fs");
const path = require("path");

const migrationPath1 = path.join(__dirname, "../supabase/migrations/20260628010000_create_strategy_office_schema.sql");
const migrationPath2 = path.join(__dirname, "../supabase/migrations/20260628010100_add_is_locked_to_monthly_plans.sql");
const migrationPath3 = path.join(__dirname, "../supabase/migrations/20260628010200_restrict_strategy_to_ceo.sql");

if (!fs.existsSync(migrationPath1)) {
    console.error("Migration file 1 not found.");
    process.exit(1);
}

const sql1 = fs.readFileSync(migrationPath1, "utf8");
const sql2 = fs.existsSync(migrationPath2) ? fs.readFileSync(migrationPath2, "utf8") : "";
const sql3 = fs.existsSync(migrationPath3) ? fs.readFileSync(migrationPath3, "utf8") : "";

console.log("====================================================");
console.log("📋 SUPABASE STRATEGY OFFICE SCHEMA COPY-PASTE");
console.log("====================================================");
console.log("Follow these steps to initialize the Strategy Office tables & columns:\n");
console.log("1. Open your Supabase Dashboard: https://supabase.com");
console.log("2. Navigate to your project, click 'SQL Editor' in the left menu.");
console.log("3. Create a 'New Query', paste the SQL code below, and click 'Run':\n");
console.log("----------------------------------------------------");
console.log(sql1);
console.log("\n-- 8. Add locking mechanism features");
console.log(sql2);
console.log("\n-- 9. Restrict access strictly to CEO");
console.log(sql3);
console.log("----------------------------------------------------");
console.log("4. Click 'Run' to apply the schema updates.");
console.log("====================================================\n");
