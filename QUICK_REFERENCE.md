# Madison88 ITSM - Quick Reference Guide

## 🎯 At a Glance

**Project:** Madison88 IT Service Management Platform
**Status:** Phase 1 - Complete Setup ✅
**Timeline:** 16 weeks (Feb 7 - May 31, 2026)
**Go-Live:** June 1, 2026

---

## 📂 Important Files

| File                         | Purpose               |
| ---------------------------- | --------------------- |
| `README.md`                  | Main project README   |
| `PROJECT_OVERVIEW.md`        | Executive summary     |
| `DEVELOPMENT_STARTER_KIT.md` | Getting started guide |
| `/documentation/`            | All detailed guides   |
| `/backend/`                  | Node.js backend       |
| `/frontend/`                 | React frontend        |
| `/database/`                 | SQL schemas           |
| `/docker/`                   | Container configs     |

---

## 🚀 Start Here

### 1. First Time Setup (10 minutes)

```powershell
# Go to project directory
cd c:\Users\john carlo manalo\Desktop\madison88-itsm

# Start everything
docker-compose -f docker/docker-compose.yml up -d

# Wait 2-3 minutes for services to start
# Open in browser: http://localhost:3000
```

### 2. Read Documentation (30 minutes)

1. `PROJECT_OVERVIEW.md` - Understand what you're building
2. `SYSTEM_ARCHITECTURE.md` - Understand how it works
3. `API_DOCUMENTATION.md` - Know the endpoints

### 3. Verify Setup (5 minutes)

```bash
# Test backend
curl http://localhost:3001/health

# Test frontend
Open http://localhost:3000

# Test database
docker-compose exec postgres psql -U itsmuser -d madison88_itsm -c "SELECT * FROM sla_rules;"
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────┐
│   Frontend (React)                  │
│   - User Portal                     │
│   - Agent Dashboard                 │
│   - Manager Dashboard               │
│   - Admin Panel                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Backend API (Express.js)          │
│   - Authentication                  │
│   - Ticket Management               │
│   - Routing & Classification        │
│   - SLA Tracking                    │
│   - Notifications                   │
└──────────────┬──────────────────────┘
               │
      ┌────────┼────────┐
      ▼        ▼        ▼
   PostgreSQL Redis  S3
   (Database) (Cache) (Files)
```

---

## 💾 Database Quick Reference

### Main Tables

- `users` - All users
- `tickets` - Support tickets
- `ticket_comments` - Messages
- `ticket_attachments` - Files
- `teams` - Support teams
- `sla_rules` - SLA config
- `routing_rules` - Auto-routing config
- `knowledge_base_articles` - KB
- `change_requests` - Changes
- `it_assets` - Asset tracking
- `audit_logs` - Action history

### Quick Queries

```sql
-- Count tickets by status
SELECT status, COUNT(*) FROM tickets GROUP BY status;

-- Find overdue tickets
SELECT ticket_number, sla_due_date FROM tickets
WHERE sla_due_date < NOW() AND status != 'Closed';

-- Team workload
SELECT assigned_team, COUNT(*) FROM tickets
WHERE status != 'Closed' GROUP BY assigned_team;
```

---

## 🔗 API Endpoints (Key)

### Authentication

```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh-token
```

### Tickets

```
POST   /api/tickets                 # Create
GET    /api/tickets                 # List
GET    /api/tickets/:id             # Details
PATCH  /api/tickets/:id             # Update
POST   /api/tickets/:id/comments    # Comment
POST   /api/tickets/:id/attachments # Upload
```

### Dashboard

```
GET    /api/dashboard/sla-performance
GET    /api/dashboard/ticket-volume
GET    /api/dashboard/team-performance
GET    /api/dashboard/aging-report
GET    /api/dashboard/export
```

### Admin

```
GET    /api/admin/users
GET    /api/admin/sla-rules
GET    /api/admin/routing-rules
```

---

## 🔑 Configuration

### Backend `.env` (Create from `.env.example`)

```env
DATABASE_URL=postgresql://itsmuser:secure_password@postgres:5432/madison88_itsm
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key-here
PORT=3001
NODE_ENV=development
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-password
```

### Frontend `.env` (Create from `.env.example`)

```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_ENV=development
```

---

## 🛠️ Development Commands

### Start Services

```bash
# All services (Docker)
docker-compose -f docker/docker-compose.yml up -d

# Just backend
cd backend && npm run dev

# Just frontend
cd frontend && npm start
```

### Stop Services

```bash
docker-compose -f docker/docker-compose.yml down
```

### View Logs

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Database Operations

```bash
# Connect to database
docker-compose exec postgres psql -U itsmuser -d madison88_itsm

# Run migrations
npm run migrate

# Seed data
npm run seed
```

---

## 📋 Priority Order

### Week 1

1. ✅ Project setup (DONE)
2. ⏳ User authentication
3. ⏳ Login form and JWT

### Week 2

1. ⏳ Ticket CRUD operations
2. ⏳ Ticket form (frontend)
3. ⏳ Ticket list view

### Week 3

1. ⏳ Email notifications
2. ⏳ Audit logging
3. ⏳ File uploads

### Week 4

1. ⏳ Testing
2. ⏳ Bug fixes
3. ⏳ Performance optimization

---

## 🧪 Testing

### Run Tests

```bash
# Backend unit tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Coverage report
npm test -- --coverage
```

### Test Database

```bash
# Connect and verify
docker-compose exec postgres psql -U itsmuser -d madison88_itsm -c "SELECT count(*) FROM tickets;"
```

### API Testing

```bash
# Using curl
curl http://localhost:3001/health

# Using Postman
# Import endpoints from API_DOCUMENTATION.md
```

---

## 🔒 Security Reminders

- ✅ Use parameterized queries (prevent SQL injection)
- ✅ Hash passwords with bcrypt
- ✅ Validate all user input
- ✅ Use HTTPS in production
- ✅ Keep JWT secrets secure
- ✅ Don't commit .env files
- ✅ Use environment variables for secrets

---

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

### Database Status

```sql
-- Check connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Check table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size DESC;
```

### Application Logs

```bash
# View recent errors
grep ERROR logs/app.log | tail -20

# Follow real-time logs
tail -f logs/app.log
```

---

## 🆘 Common Issues

### "Port Already in Use"

```bash
# Find and kill process
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### "Database Connection Failed"

```bash
# Verify PostgreSQL is running
docker-compose exec postgres psql -U itsmuser -c "SELECT 1"

# Check .env DATABASE_URL
```

### "Cannot find module"

```bash
# Reinstall dependencies
rm -r node_modules package-lock.json
npm install
```

### "CORS Error"

```bash
# Check REACT_APP_API_URL in frontend .env
# Check CORS settings in backend/src/app.js
```

---

## 📚 Documentation Map

```
docs/
├── PROJECT_OVERVIEW.md         ← Start here
├── DEVELOPMENT_STARTER_KIT.md  ← Setup guide
├── IMPLEMENTATION_GUIDE.md     ← Development roadmap
├── API_DOCUMENTATION.md        ← Endpoint reference
├── SYSTEM_ARCHITECTURE.md      ← Design docs
├── DATABASE_ERD.md             ← Schema details
├── USER_MANUAL.md              ← User guides
├── ADMIN_GUIDE.md              ← Admin manual
└── TROUBLESHOOTING.md          ← Problem solving
```

---

## 🎯 Success Metrics

By Phase 1 Completion:

- ✅ Users can create tickets
- ✅ Tickets show in list with status
- ✅ Agents can update tickets
- ✅ Emails send notifications
- ✅ Audit logs record all actions
- ✅ Tests cover core functionality
- ✅ Database performs well

---

## 🔄 Typical Development Cycle

1. **Read requirements** from IMPLEMENTATION_GUIDE.md
2. **Design** the feature (database schema, API endpoints)
3. **Implement** backend service
4. **Test** with API client (Postman/curl)
5. **Implement** frontend component
6. **Test** end-to-end
7. **Commit** code with clear message
8. **Review** with team

---

## 📞 Quick Contacts

- **Documentation**: See `/documentation/` folder
- **Technical Issues**: See `TROUBLESHOOTING.md`
- **API Help**: See `API_DOCUMENTATION.md`
- **Architecture Questions**: See `SYSTEM_ARCHITECTURE.md`
- **Setup Issues**: See `DEVELOPMENT_STARTER_KIT.md`

---

## ✅ Pre-Development Checklist

- [ ] Docker installed
- [ ] Node.js v16+ installed
- [ ] PostgreSQL running (or via Docker)
- [ ] Redis running (or via Docker)
- [ ] All services started
- [ ] Backend health check passing
- [ ] Frontend loading in browser
- [ ] Database migrations completed
- [ ] Documentation reviewed
- [ ] .env files created

---

## 🚀 Ready to Build!

You have everything you need. Start with:

1. **Quick Start** → Use Docker to start services
2. **Read Docs** → Understand the architecture
3. **Follow Roadmap** → See IMPLEMENTATION_GUIDE.md
4. **Start Coding** → Begin Phase 1

**Questions?** Check the relevant documentation file first.

---

**Project Started:** February 7, 2026  
**Target Launch:** June 1, 2026  
**Duration:** 16 weeks

**Let's build Madison88 ITSM! 🚀**
