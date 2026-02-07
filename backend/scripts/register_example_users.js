// Script to register example users for ITSM
require('dotenv').config({ path: '../.env' });
const AuthService = require('../src/services/auth.service');
const db = require('../src/config/database');

async function main() {
  const users = [
    {
      email: 'adminmadison88@gmail.com',
      name: 'Admin User',
      password: 'admin123',
      role: 'admin',
      department: 'IT',
      location: 'Philippines',
      phone: '+63-900-000-0000',
    },
    {
      email: 'itmadison88@gmail.com',
      name: 'IT Agent',
      password: 'it123',
      role: 'IT Agent',
      department: 'IT',
      location: 'US',
      phone: '+1-555-000-0000',
    },
    {
      email: 'manager88@gmail.com',
      name: 'IT Manager',
      password: 'manager123',
      role: 'IT Manager',
      department: 'IT',
      location: 'Indonesia',
      phone: '+62-800-000-0000',
    },
    {
      email: 'usermadison88@gmail.com',
      name: 'End User',
      password: 'user123',
      role: 'End User',
      department: 'HR',
      location: 'Philippines',
      phone: '+63-900-111-1111',
    },
  ];
  for (const user of users) {
    try {
      await AuthService.register(user);
      console.log(`Registered: ${user.email}`);
    } catch (err) {
      if (err.message.includes('already registered')) {
        console.log(`Already exists: ${user.email}`);
      } else {
        console.error(`Error for ${user.email}:`, err.message);
      }
    }
  }
  await db.end();
}

main();
