const db = require('../config/database');

async function testKbSearch() {
    try {
        const search = "booting";

        // First check total count
        const countRes = await db.query('SELECT COUNT(*) FROM knowledge_base_articles');
        console.log("Total KB Articles:", countRes.rows[0].count);

        if (countRes.rows[0].count > 0) {
            const allRes = await db.query('SELECT article_id, title FROM knowledge_base_articles LIMIT 5');
            console.log("Sample Articles:", allRes.rows);

            const result = await db.query(
                `SELECT article_id, title FROM knowledge_base_articles 
               WHERE (title ILIKE $1 OR content ILIKE $1)` ,
                [`%${search}%`]
            );
            console.log(`Search Results for '${search}':`, result.rows);
        }

        process.exit(0);
    } catch (err) {
        console.error("Test failed", err);
        process.exit(1);
    }
}

testKbSearch();
