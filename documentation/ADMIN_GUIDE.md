# Madison88 ITSM - Admin Guide

## Table of Contents

1. [System Configuration](#system-configuration)
2. [User Management](#user-management)
3. [Team Management](#team-management)
4. [SLA Configuration](#sla-configuration)
5. [Routing Rules](#routing-rules)
6. [System Maintenance](#system-maintenance)
7. [Security Management](#security-management)
8. [Backup & Recovery](#backup--recovery)

---

## System Configuration

### Initial Setup

After deployment, complete these steps:

1. **Create Admin User**

   ```bash
   npm run seed:admin
   # Email: admin@madison88.com
   # Password: (provided in setup guide)
   ```

2. **Configure Email Service**
   - Update SMTP settings in `.env`
   - Test email delivery
   - Configure email templates

3. **Set Up Database Backups**
   - Configure automated backups
   - Test backup restoration

### Environment Variables

**Production Settings:**

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@prod-db:5432/madison88_itsm
REDIS_URL=redis://prod-redis:6379
JWT_SECRET=<secure-random-key-32-chars>
FRONTEND_PROD_URL=https://itsm.madison88.com
LOG_LEVEL=warn
```

**Logging Configuration:**

- `LOG_LEVEL`: error, warn, info, debug
- `LOG_FILE`: Path to log file
- Logs rotate daily and retain 30 days

### System Health Check

```bash
# Check all services
curl https://itsm.madison88.com/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-07T10:00:00Z",
  "environment": "production"
}
```

---

## User Management

### Creating New Users

**Via Admin Panel:**

1. Click **Admin** → **Users** → **Add User**
2. Fill in details:
   - Email (must be unique)
   - First & Last Name
   - Role (End User, IT Agent, IT Manager, System Admin)
   - Department
   - Location
3. Click **Create User**
4. System sends welcome email with temporary password

**Via Command Line:**

```bash
npm run add:user -- --email user@madison88.com --role it_agent --name "John Doe"
```

### User Roles

**End User**

- Submit tickets
- View own tickets
- Comment on own tickets
- Access knowledge base
- Cannot: View other tickets, manage system

**IT Agent**

- All End User permissions
- View assigned tickets
- Update ticket status
- Add comments (internal & public)
- Cannot: Reassign across teams, override priority, access admin

**IT Manager**

- All IT Agent permissions
- View all tickets
- Reassign across teams
- Override priority/SLA with justification
- Approve service requests
- View all dashboards
- Access team management
- Cannot: Create users, system configuration

**System Administrator**

- All permissions
- Create/edit users
- Configure system settings
- Manage SLA rules
- Manage routing rules
- Access audit logs
- Database maintenance

### Editing User Permissions

1. Click **Admin** → **Users**
2. Find user and click **Edit**
3. Change role or status
4. Click **Save Changes**

### Disabling/Enabling Users

1. Open user profile
2. Toggle **Active Status**
3. Click **Save**

Disabled users cannot login but their tickets remain visible.

### Password Reset

**User Self-Service:**

1. Click "Forgot Password" on login page
2. Enter email
3. Click password reset link in email
4. Set new password

**Admin Reset:**

1. Admin panel → Users
2. Click user → **Reset Password**
3. System generates temporary password
4. User receives email with temp password
5. User must change on first login

### Viewing User Activity

```sql
SELECT user_id, email, last_login, COUNT(ticket_id) as tickets_created
FROM users u
LEFT JOIN tickets t ON u.user_id = t.user_id
GROUP BY u.user_id
ORDER BY last_login DESC;
```

---

## Team Management

### Creating Teams

**Via Admin Panel:**

1. Click **Admin** → **Teams** → **Add Team**
2. Fill in:
   - Team Name (unique)
   - Team Lead (select from users)
   - Category Assigned (Hardware, Software, etc.)
   - Location (if location-specific)
3. Click **Create Team**

### Adding Team Members

1. Open team → **Members** tab
2. Click **Add Member**
3. Select user and role (member or lead)
4. Click **Add**

### Team Performance Dashboard

**View Team Metrics:**

1. Click **Dashboard** → **Team Performance**
2. View:
   - Tickets assigned to team
   - Average resolution time
   - SLA compliance rate
   - Agent workload distribution
   - First contact resolution rate

### Team Workload Balancing

The system automatically distributes tickets to agents with:

- Fewest open tickets
- Lowest workload score
- Matching skill set

**Manual Adjustment:**

1. In **Admin** → **Teams**, edit team members
2. Adjust workload weights if needed
3. Save changes

---

## SLA Configuration

### Viewing Current SLAs

1. Click **Admin** → **SLA Rules**
2. View P1-P4 timelines:

| Priority      | Response Time | Resolution Time |
| ------------- | ------------- | --------------- |
| P1 (Critical) | 1 hour        | 4 hours         |
| P2 (High)     | 4 hours       | 24 hours        |
| P3 (Medium)   | 8 hours       | 72 hours        |
| P4 (Low)      | 24 hours      | 5 days          |

### Editing SLA Rules

**Important:** Changing SLA rules affects future tickets, not existing ones.

1. Click **Admin** → **SLA Rules**
2. Click **Edit** on a priority level
3. Change response/resolution hours
4. Adjust escalation threshold (default: 80%)
5. Click **Save**

**Example:** Make P2 response time 2 hours instead of 4

1. Edit P2 rule
2. Change Response Time Hours: 4 → 2
3. Save
4. New P2 tickets will have 2-hour response SLA

### SLA Escalation Process

**Timeline:**

- 0-79%: Normal processing
- 80%: Escalation triggered
  - Agent receives warning email
  - Manager receives escalation notification
  - Ticket highlighted in yellow
- 100%: SLA breached
  - Manager receives breach notification
  - Ticket shown in red
  - Added to aging report

### SLA Reporting

```sql
-- SLA compliance by priority
SELECT priority,
  COUNT(*) as total_tickets,
  SUM(CASE WHEN sla_breached=false THEN 1 ELSE 0 END) as met,
  ROUND(100.0 * SUM(CASE WHEN sla_breached=false THEN 1 ELSE 0 END) / COUNT(*), 2) as compliance_percent
FROM tickets
WHERE status IN ('Resolved', 'Closed')
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY priority;
```

---

## Routing Rules

### Viewing Routing Rules

1. Click **Admin** → **Routing Rules**
2. View all category-to-team mappings

### Creating Routing Rule

1. Click **Add Routing Rule**
2. Fill in:
   - **Category**: Hardware, Software, Access Request, etc.
   - **Assigned Team**: Select team
   - **Location** (optional): Restrict to location
   - **Priority Override** (optional): Force specific priority
3. Click **Create**

**Example Rules:**

```
Category: Hardware → Hardware Support Team (Philippines)
Category: Software → Application Support Team
Category: Access Request → IT Security Team
Category: Account Creation → IT Admin Team
Category: Network → Network Team
```

### Load Balancing Settings

The routing engine uses round-robin within teams:

```javascript
// Assignment algorithm:
function assignTicket(category) {
  const rule = findRoutingRule(category);
  const team = rule.assigned_team;
  const agents = getActiveAgents(team);
  const agent = selectAgentWithLowestWorkload(agents);
  return agent;
}
```

### Modifying Routing Rules

1. Click **Edit** on a rule
2. Change team or location
3. Click **Save**

**Note:** Changes apply to new tickets, not existing ones.

---

## Classification Rules

### Auto-Classification Rules

The system auto-classifies ticket priority using keyword matching:

**View Rules:**

1. Click **Admin** → **Classification Rules**
2. See keywords for each priority level

**Edit Rules:**

P1 (Critical) Keywords:

- outage, down, offline, critical, security breach, data loss

P2 (High) Keywords:

- slow, degraded, unavailable, urgent, vip, mission-critical

P3 (Medium) Keywords:

- issue, problem, request, help, error

P4 (Low) Keywords:

- info, question, documentation, feature request

### Adding Custom Classification Rules

1. Click **Add Rule**
2. Fill in:
   - **Rule Name**: Descriptive name
   - **Keywords**: Comma-separated list
   - **Matching Type**: Any keyword match or all keywords
   - **Assigned Priority**: P1-P4
3. Set **Order Priority** (lower number = higher precedence)
4. Click **Create**

**Example:**

- Rule Name: "System Outage"
- Keywords: "entire system down, all users affected, complete outage"
- Matching Type: Any
- Priority: P1

---

## System Maintenance

### Database Maintenance

**Daily Tasks:**

- Monitor database size
- Check slow query log
- Verify backup completion

**Weekly Tasks:**

```sql
-- Vacuum analyze (optimize database)
VACUUM ANALYZE;

-- Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Reindex if needed
REINDEX TABLE tickets;
```

**Monthly Tasks:**

- Review indexes
- Archive closed tickets
- Update statistics

### Cleaning Up Old Data

**Archive Closed Tickets (older than 1 year):**

```sql
-- Create archive table
CREATE TABLE tickets_archive AS
SELECT * FROM tickets WHERE closed_at < NOW() - INTERVAL '1 year';

-- Delete archived
DELETE FROM tickets WHERE closed_at < NOW() - INTERVAL '1 year';
```

### Performance Tuning

**Monitor Query Performance:**

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- log queries > 1 second
SELECT pg_reload_conf();

-- Find slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

**Add Missing Indexes:**

```sql
CREATE INDEX idx_tickets_created_assigned ON tickets(created_at DESC, assigned_to);
```

---

## Security Management

### Access Control

**IP Whitelisting (Optional):**
Configure in load balancer or firewall:

```
Allow: Internal company IPs
Allow: VPN IPs
```

### API Rate Limiting

Current limits per 15-minute window:

- Standard endpoints: 100 requests/IP
- Login endpoint: 5 requests/IP
- File upload: 10 requests/user

**Adjust in .env if needed:**

```env
RATE_LIMIT_WINDOW=900000 # 15 minutes in ms
RATE_LIMIT_MAX_REQUESTS=100
```

### Password Policy

**Requirements:**

- Minimum 12 characters
- Must include uppercase, lowercase, number, special character
- Cannot reuse last 5 passwords
- Expiry: 90 days (optional, configure in .env)

### Audit Logging

**View Audit Logs:**

1. Click **Admin** → **Audit Logs**
2. Filter by:
   - User
   - Action (created, updated, deleted, assigned, etc.)
   - Date range
   - Entity (Ticket, User, Team, etc.)

**Export Audit Trail:**

```bash
# Export as CSV for compliance
curl -X GET "https://itsm.madison88.com/api/admin/audit-logs?format=csv" \
  -H "Authorization: Bearer $TOKEN" > audit_trail.csv
```

### Security Scanning

**Automated Scans:**

- File upload virus scanning (enabled)
- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization)

**Manual Security Audit:**

```bash
# Run security check
npm run audit

# Update vulnerable packages
npm audit fix
```

---

## Backup & Recovery

### Automated Backups

**Configuration:**

```bash
# Daily automated backup at 2 AM
# Retention: 30 days
# Location: AWS S3
```

**Verify Backups:**

```bash
# List backups
aws s3 ls s3://madison88-itsm-backups/

# Check latest backup
aws s3 ls s3://madison88-itsm-backups/ --recursive | tail -1
```

### Manual Backup

**Database Backup:**

```bash
# Backup to file
pg_dump -U itsmuser madison88_itsm > backup_$(date +%Y%m%d).sql

# Backup to remote
pg_dump -U itsmuser madison88_itsm | gzip > backup_$(date +%Y%m%d).sql.gz
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://madison88-itsm-backups/
```

**File Storage Backup (S3):**

```bash
# Sync S3 to local
aws s3 sync s3://madison88-itsm-uploads ./uploads_backup/

# Or create snapshot
aws ec2 create-snapshot --volume-id vol-xxxx --description "Madison88 ITSM backup"
```

### Restore from Backup

**Restore Database:**

```bash
# From backup file
psql -U itsmuser madison88_itsm < backup_20260207.sql

# From compressed backup
gunzip < backup_20260207.sql.gz | psql -U itsmuser madison88_itsm
```

**Verify Restore:**

```sql
-- Check row counts
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL SELECT 'comments', COUNT(*) FROM ticket_comments;
```

### Disaster Recovery Plan

**RTO (Recovery Time Objective):** < 5 minutes
**RPO (Recovery Point Objective):** < 1 hour

**Process:**

1. Identify failure (database down, corrupted, etc.)
2. Restore latest backup to new database
3. Update database connection string
4. Restart application services
5. Verify data integrity
6. Test critical functions
7. Notify users

---

## Monitoring & Alerts

### System Monitoring

**Metrics to Monitor:**

- CPU usage > 80%
- Memory usage > 85%
- Disk space < 10% free
- Database connections > 80% of max
- API error rate > 1%
- API response time > 2 seconds

**Configure Alerts:**

```bash
# In monitoring system (CloudWatch, Datadog, etc.)
AlertOnHighCPU: threshold=80%, duration=5min
AlertOnHighMemory: threshold=85%, duration=5min
AlertOnHighErrorRate: threshold=1%, duration=5min
```

### Scheduled Jobs Monitoring

**Critical Jobs:**

- SLA check (every 5 minutes)
- Escalation notifications (every 15 minutes)
- Email queue processing (continuous)

**Verify Jobs Running:**

```bash
# Check for job execution in logs
grep "SLA check" logs/app.log | tail -20
grep "Escalation" logs/app.log | tail -20
```

---

## Support & Contact

For issues or questions:

- **Technical Support**: it-admin@madison88.com
- **Emergency On-Call**: +63-2-XXXX-XXXX (24/7)
- **Documentation**: See `/documentation` folder

---

**Last Updated:** February 7, 2026
**Version:** 1.0
