require('dotenv').config();
const UsersService = require('../src/services/users.service');
const TicketsModel = require('../src/models/tickets.model');
const UserModel = require('../src/models/user.model');
const db = require('../src/config/database');

async function verifyAutoAssignment() {
    try {
        console.log('--- Verifying Team Auto-Assignment ---');

        // 1. Setup: Ensure a team exists for a test location (e.g., 'Indonesia')
        const location = 'Indonesia';
        const testTeamName = 'ID Verification Team';

        // Check if team exists
        let teams = await TicketsModel.listTeamsByLocation(location);
        let teamId;

        if (teams.length === 0) {
            console.log(`Creating test team for ${location}...`);
            const result = await db.query(
                "INSERT INTO teams (team_name, location, is_active) VALUES ($1, $2, true) RETURNING team_id",
                [testTeamName, location]
            );
            teamId = result.rows[0].team_id;
        } else {
            teamId = teams[0].team_id;
            console.log(`Using existing team: ${teams[0].team_name} (ID: ${teamId})`);
        }

        // 2. Test: Create a new IT Agent in Indonesia
        const timestamp = Date.now();
        const testEmail = `agent_${timestamp}@test.com`;
        console.log(`Creating test agent: ${testEmail}...`);

        const user = await UsersService.createUser({
            email: testEmail,
            first_name: 'Test',
            last_name: 'Agent',
            full_name: 'Test Agent',
            password: 'password123',
            role: 'it_agent',
            location: location
        });

        // 3. Verify: Check team membership
        const teamIds = await TicketsModel.listTeamIdsForUser(user.user_id);
        console.log(`Agent ${user.user_id} assigned to teams:`, teamIds);

        if (teamIds.includes(teamId)) {
            console.log('✅ PASS: Agent automatically assigned to regional team on creation.');
        } else {
            console.error('❌ FAIL: Agent NOT assigned to regional team on creation.');
        }

        // 4. Test: Update an existing end_user to IT Agent
        const endUserEmail = `enduser_${timestamp}@test.com`;
        console.log(`Creating test end user: ${endUserEmail}...`);
        const endUser = await UsersService.createUser({
            email: endUserEmail,
            first_name: 'Test',
            last_name: 'EndUser',
            full_name: 'Test EndUser',
            password: 'password123',
            role: 'end_user',
            location: location
        });

        console.log(`Updating end user to IT Agent...`);
        await UsersService.updateUser(endUser.user_id, { role: 'it_agent' });

        const newTeamIds = await TicketsModel.listTeamIdsForUser(endUser.user_id);
        console.log(`Updated Agent assigned to teams:`, newTeamIds);

        if (newTeamIds.includes(teamId)) {
            console.log('✅ PASS: User automatically assigned to regional team on role upgrade.');
        } else {
            console.error('❌ FAIL: User NOT assigned to regional team on role upgrade.');
        }

        // Cleanup (optional)
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

verifyAutoAssignment();
