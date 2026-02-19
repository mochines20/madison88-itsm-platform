const TicketsModel = require('./backend/src/models/tickets.model');
const db = require('./backend/src/config/database');

async function testRouting() {
    console.log("Starting Global Routing Verification...");

    try {
        // 1. Mock ticket data for different locations
        const locations = ['Philippines', 'US', 'Indonesia', 'China'];

        for (const loc of locations) {
            console.log(`\nTesting routing for location: ${loc}`);

            // Get routing rule for location
            const rule = await TicketsModel.getRoutingRule({
                category: 'Hardware',
                location: loc
            });

            if (rule) {
                console.log(`✅ Found routing rule. Assigned Team ID: ${rule.assigned_team}`);

                // Test least loaded agent assignment
                const agentId = await TicketsModel.getLeastLoadedAgent(rule.assigned_team, loc);
                if (agentId) {
                    console.log(`✅ Auto-assigned to Agent ID: ${agentId}`);
                } else {
                    console.log(`⚠️ No agent found for team ${rule.assigned_team} in ${loc} (this is expected if team is empty)`);
                }
            } else {
                console.log(`❌ No routing rule found for ${loc}`);
            }
        }

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        process.exit();
    }
}

testRouting();
