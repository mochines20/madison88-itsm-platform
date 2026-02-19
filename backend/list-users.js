require('dotenv').config();
const db = require('./src/config/database');

async function listSomeUsers() {
    try {
        const result = await db.query('SELECT email, role, full_name FROM users LIMIT 5');
        console.log('Users found:');
        result.rows.forEach(u => console.log(`- ${u.email} (${u.role}): ${u.full_name}`));
        process.exit(0);
    } catch (err) {
        console.error('Failed to list users:', err);
        process.exit(1);
    }
}

listSomeUsers();
