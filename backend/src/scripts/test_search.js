require('dotenv').config(); // Load .env from backend root
const UserModel = require('../models/user.model');

async function test() {
    console.log("Listing all users...");
    const allUsers = await UserModel.listUsers({});
    console.log(`Found ${allUsers.length} users.`);
    if (allUsers.length > 0) {
        const sample = allUsers[0];
        console.log("Sample user:", sample.full_name, sample.email);

        const searchTerm = sample.full_name.substring(0, 3);
        console.log(`\nSearching for '${searchTerm}'...`);
        const searchResults = await UserModel.listUsers({ search: searchTerm });
        console.log(`Found ${searchResults.length} results.`);
        searchResults.forEach(u => console.log(` - ${u.full_name} (${u.email})`));

        const emailTerm = sample.email.split('@')[0];
        console.log(`\nSearching for email '${emailTerm}'...`);
        const emailResults = await UserModel.listUsers({ search: emailTerm });
        console.log(`Found ${emailResults.length} results.`);
        emailResults.forEach(u => console.log(` - ${u.full_name} (${u.email})`));
    } else {
        console.log("No users found in database to test with.");
    }
}

test().catch(console.error).finally(() => {
    // We don't have a clean way to close the pool from here if it's not exported, 
    // but process.exit() handles it.
    process.exit();
});
