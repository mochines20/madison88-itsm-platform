require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';
let token;

async function login(email, password) {
    try {
        const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
        return res.data.token;
    } catch (err) {
        console.error('Login failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

async function testUpdateMe() {
    console.log('--- Testing PATCH /users/me ---');

    // 1. Login
    const email = 'manager88@gmail.com';
    const originalPassword = 'manager123';
    token = await login(email, originalPassword);
    const headers = { Authorization: `Bearer ${token}` };

    try {
        // 2. Initial state
        const meResult = await axios.get(`${API_BASE}/users/me`, { headers });
        const user = meResult.data.user;
        console.log('Current User:', user.full_name, user.email);

        const originalName = user.full_name;

        // 3. Update Name
        console.log('Updating Full Name...');
        const updateRes = await axios.patch(`${API_BASE}/users/me`, {
            full_name: `${originalName} Updated`
        }, { headers });
        console.log('Update Success:', updateRes.data.data.user.full_name);

        // 4. Update Password (and test it)
        console.log('Updating Password...');
        const newPassword = 'newmanager123';
        await axios.patch(`${API_BASE}/users/me`, {
            password: newPassword
        }, { headers });
        console.log('Password updated successfully.');

        // 5. Verify Logout/Relogin with new password
        console.log('Attempting login with new password...');
        const newToken = await login(email, newPassword);
        if (newToken) {
            console.log('Login with new password SUCCESSFUL.');
        }

        // 6. Reset back for future runs
        console.log('Resetting name and password...');
        const finalHeaders = { Authorization: `Bearer ${newToken}` };
        await axios.patch(`${API_BASE}/users/me`, {
            full_name: originalName,
            password: originalPassword
        }, { headers: finalHeaders });
        console.log('Cleanup complete.');

    } catch (err) {
        console.error('UpdateMe test failed:', err.response?.data || err.message);
    }
}

testUpdateMe();
