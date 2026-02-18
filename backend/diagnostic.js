require('dotenv').config();
const db = require('./src/config/database');
const logger = require('./src/utils/logger');

async function checkColumns() {
    try {
        const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sla_rules'");
        console.log('Columns in sla_rules:');
        res.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));

        const rules = await db.query("SELECT * FROM sla_rules LIMIT 1");
        console.log('Sample rule:', JSON.stringify(rules.rows[0], null, 2));
    } catch (err) {
        console.error('Diagnostic failed:', err);
    } finally {
        process.exit();
    }
}

checkColumns();
