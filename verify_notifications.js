require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/src/config/database');
const NotificationService = require('./backend/src/services/notification.service');

async function verify() {
    console.log("--- Verifying Ticket Notifications ---");

    try {
        // 1. Check if email notifications are enabled in env
        console.log("Email Enabled:", process.env.ENABLE_EMAIL_NOTIFICATIONS);
        console.log("EmailJS Configured:", !!(process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY));
        console.log("SMTP Configured:", !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD));

        // 2. Check recent audit logs for 'email_sent'
        const recentLogs = await db.query(
            "SELECT * FROM audit_logs WHERE action_type = 'email_sent' ORDER BY timestamp DESC LIMIT 5"
        );

        console.log("\n--- Recent Email Audit Logs ---");
        if (recentLogs.rows.length === 0) {
            console.log("No recent email audit logs found.");
        } else {
            recentLogs.rows.forEach(log => {
                const details = JSON.parse(log.new_value || '{}');
                console.log(`[${log.timestamp}] To: ${details.to} | Subject: ${details.subject}`);
            });
        }

        // 3. Test a dummy notification (dry-run if possible or just check log)
        // We'll just check if the service is correctly imported and has the methods
        const methods = Object.keys(NotificationService);
        console.log("\nNotification Service Methods:", methods.join(", "));

        const requiredMethods = [
            'sendNewTicketNotice',
            'sendTicketAssignedNotice',
            'sendTicketResolvedNotice',
            'sendTicketReopenedNotice',
            'sendCriticalTicketNotice'
        ];

        const missing = requiredMethods.filter(m => !methods.includes(m));
        if (missing.length > 0) {
            console.error("Missing methods:", missing.join(", "));
        } else {
            console.log("All required notification methods are present.");
        }

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        process.exit();
    }
}

verify();
