require('dotenv').config();
const db = require('./src/config/database');
const NotificationService = require('./src/services/notification.service');

async function test() {
    console.log("--- Triggering Test Email ---");
    try {
        const result = await NotificationService.sendEmail({
            to: 'test@example.com',
            subject: 'Manual Test Email',
            text: 'This is a test to verify notifications are working.'
        });
        console.log("Send result:", result);

        // Check if log appeared
        const check = await db.query(
            "SELECT * FROM audit_logs WHERE action_type = 'email_sent' ORDER BY timestamp DESC LIMIT 1"
        );
        if (check.rows.length > 0) {
            console.log("Success! Log found:", check.rows[0].description);
        } else {
            console.log("Failure: No audit log found after send attempt.");
        }
    } catch (err) {
        console.error("Test failed with error:", err);
    } finally {
        process.exit();
    }
}

test();
