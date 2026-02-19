const syncIdentity = (updates) => {
    // Exact logic from users.service.js
    if (updates.full_name && !updates.full_name.includes('@')) {
        if (!updates.first_name || !updates.last_name) {
            const parts = updates.full_name.trim().split(/\s+/);
            updates.first_name = parts[0] || "";
            updates.last_name = parts.slice(1).join(" ") || "";
        }
    }

    if ((updates.first_name || updates.last_name) && !updates.full_name) {
        const first = updates.first_name || "";
        const last = updates.last_name || "";
        updates.full_name = `${first} ${last}`.trim();
    }
    return updates;
};

const testCases = [
    { full_name: "John Doe" },
    { full_name: "John Sedrick Madison88" },
    { full_name: "johnsedrick.madison88@outlook.com" },
    { first_name: "John", last_name: "Smith" },
    { full_name: "Already Set", first_name: "Override", last_name: "Me" },
    { email: "new@email.com", full_name: "o@madison88.com" }
];

testCases.forEach(tc => {
    console.log(`Input: ${JSON.stringify(tc)} -> Result:`, syncIdentity({ ...tc }));
});
