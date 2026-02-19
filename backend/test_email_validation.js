// Mocking the behavior of collectRecipientEmails from notification.service.js
function collectRecipientEmails(recipients = []) {
    const emails = recipients.map((r) => {
        if (typeof r === 'string') return r.trim();
        return r?.email?.trim();
    }).filter(Boolean);

    const validEmails = emails.filter((email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return false;

        const lowerEmail = email.toLowerCase();
        const dummyDomains = [
            'test.com',
            'example.com',
            'dummy.com',
            'localhost',
            'invalid.com'
        ];

        return !dummyDomains.some(domain => lowerEmail.endsWith(`@${domain}`) || lowerEmail.endsWith(`.${domain}`));
    });

    return Array.from(new Set(validEmails));
}

const testCases = [
    { name: "Valid personal email", input: ["john.doe@gmail.com"] },
    { name: "Valid outlook email", input: ["johnsedrick.madison88@outlook.com"] },
    { name: "Valid corporate email", input: ["o@madison88.com"] },
    { name: "Dummy test.com", input: ["user@test.com"] },
    { name: "Dummy example.com", input: ["someone@example.com"] },
    { name: "Dummy invalid.com", input: ["test@invalid.com"] },
    { name: "Invalid format (no @)", input: ["invalidemail"] },
    { name: "Invalid format (no domain)", input: ["test@"] },
    { name: "Mixed valid and invalid", input: ["real@madison88.com", "fake@test.com", "another@gmail.com"] },
    { name: "Object recipients", input: [{ email: "obj@real.com" }, { email: "obj@test.com" }] }
];

testCases.forEach(tc => {
    const result = collectRecipientEmails(tc.input);
    console.log(`Test: ${tc.name}`);
    console.log(`  Input:  ${JSON.stringify(tc.input)}`);
    console.log(`  Result: ${JSON.stringify(result)}`);
    console.log(`  Status: ${result.length > 0 && tc.name.startsWith("Valid") || result.length === 0 && tc.name.startsWith("Dummy") || result.length === 0 && tc.name.startsWith("Invalid") ? "PASS" : "CHECK"}`);
});
