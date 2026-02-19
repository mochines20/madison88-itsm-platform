const db = require('../src/config/database');

async function syncLeads() {
    try {
        console.log('Syncing IT Managers with regional teams...');

        // 1. Get all IT Managers
        const managersResult = await db.query(
            "SELECT user_id, full_name, location FROM users WHERE role = 'it_manager' AND is_active = true"
        );
        const managers = managersResult.rows;
        console.log(`Found ${managers.length} active IT Managers.`);

        for (const manager of managers) {
            if (!manager.location) {
                console.log(`Skipping manager ${manager.full_name} (no location assigned).`);
                continue;
            }

            // 2. Find a team in the same location that either has no lead or is already led by this manager
            const teamResult = await db.query(
                "SELECT team_id, team_name, team_lead_id FROM teams WHERE location = $1",
                [manager.location]
            );

            const teams = teamResult.rows;
            if (teams.length === 0) {
                console.log(`No team found for location ${manager.location}.`);
                continue;
            }

            // Check if manager is already a lead of any team in their location
            const isAlreadyLead = teams.some(t => t.team_lead_id === manager.user_id);
            if (isAlreadyLead) {
                console.log(`Manager ${manager.full_name} is already a lead for a team in ${manager.location}.`);
                continue;
            }

            // Find first team with no lead
            const unledTeam = teams.find(t => !t.team_lead_id);
            if (unledTeam) {
                await db.query(
                    "UPDATE teams SET team_lead_id = $1 WHERE team_id = $2",
                    [manager.user_id, unledTeam.team_id]
                );
                console.log(`Assigned manager ${manager.full_name} as lead for team ${unledTeam.team_name}.`);
            } else {
                console.log(`No available unled teams for manager ${manager.full_name} in ${manager.location}. All teams in this region have leads.`);
            }
        }

        console.log('Sync complete.');
        process.exit(0);
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
}

syncLeads();
