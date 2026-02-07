# Madison88 ITSM - Troubleshooting Guide

## Common Issues & Solutions

### Backend Issues

#### Issue: Database Connection Failed

**Error Message:**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causes & Solutions:**

1. PostgreSQL not running

   ```powershell
   # Start PostgreSQL service
   docker-compose -f docker/docker-compose.yml up postgres -d
   ```

2. Wrong connection string in .env

   ```
   # Check DATABASE_URL format:
   postgresql://user:password@host:port/database
   ```

3. Database doesn't exist
   ```bash
   # Create database
   createdb -U itsmuser madison88_itsm
   ```

#### Issue: Redis Connection Failed

**Error Message:**

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions:**

1. Start Redis service

   ```powershell
   docker-compose -f docker/docker-compose.yml up redis -d
   ```

2. Check Redis password in .env
   ```
   REDIS_URL=redis://:password@localhost:6379
   ```

#### Issue: Port Already in Use

**Error Message:**

```
EADDRINUSE: address already in use :::3001
```

**Solutions:**

1. Kill process on port

   ```powershell
   # Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F

   # Or change port in .env
   PORT=3002
   ```

#### Issue: Module Not Found

**Error Message:**

```
Cannot find module 'express'
```

**Solutions:**

1. Install dependencies

   ```bash
   npm install
   ```

2. Clear node_modules and reinstall
   ```bash
   rm -r node_modules package-lock.json
   npm install
   ```

### Frontend Issues

#### Issue: React App Won't Start

**Error Message:**

```
The application failed to compile.
Module not found: Can't resolve '@mui/material'
```

**Solutions:**

1. Install dependencies

   ```bash
   npm install
   ```

2. Clear cache and restart
   ```bash
   rm -r node_modules
   npm install
   npm start
   ```

#### Issue: API Calls Failing (CORS Error)

**Error Message:**

```
Access to XMLHttpRequest blocked by CORS policy
```

**Solutions:**

1. Check API_URL in .env

   ```
   REACT_APP_API_URL=http://localhost:3001
   ```

2. Verify backend CORS configuration

   ```javascript
   // In backend/src/app.js
   const corsOptions = {
     origin: "http://localhost:3000",
     credentials: true,
   };
   ```

3. Ensure backend is running
   ```bash
   npm run dev
   ```

#### Issue: Page Not Loading or Blank

**Solutions:**

1. Check browser console (F12 → Console)
2. Check network tab for failed requests
3. Clear browser cache

   ```
   Ctrl+Shift+Delete → Clear all
   ```

4. Restart development server
   ```bash
   npm start
   ```

### Database Issues

#### Issue: Migration Failed

**Error:**

```
Error: relation "users" does not exist
```

**Solutions:**

1. Run migrations manually

   ```bash
   npm run migrate
   ```

2. Check migration file syntax

   ```bash
   psql -U itsmuser -d madison88_itsm -f database/schema.sql
   ```

3. Reset database (development only)
   ```bash
   # Drop and recreate
   dropdb -U itsmuser madison88_itsm
   createdb -U itsmuser madison88_itsm
   psql -U itsmuser -d madison88_itsm -f database/schema.sql
   ```

#### Issue: Slow Queries

**Symptoms:**

- API responses taking >2 seconds
- CPU spiking on database server

**Solutions:**

1. Check query performance

   ```sql
   EXPLAIN ANALYZE SELECT * FROM tickets WHERE status='In Progress';
   ```

2. Add missing indexes

   ```sql
   CREATE INDEX idx_tickets_status ON tickets(status);
   CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
   ```

3. Optimize query
   - Avoid SELECT \* (specify columns)
   - Use LIMIT for list queries
   - Use proper WHERE clauses

### Authentication Issues

#### Issue: Login Failed - "Invalid Credentials"

**Causes:**

1. Wrong email/password
   - Verify correct email and password
   - Check for extra spaces

2. User doesn't exist
   - Create test user first
   - Check database for user

3. Password hashing issue
   ```sql
   -- Check if user exists
   SELECT * FROM users WHERE email='test@madison88.com';
   ```

#### Issue: JWT Token Expired

**Error:**

```
401 Unauthorized: Token expired
```

**Solutions:**

1. Logout and login again
2. Check token expiry in .env

   ```
   JWT_EXPIRY=24h
   ```

3. Implement auto-refresh in frontend
   ```javascript
   // Check if token expires in next 5 minutes
   if (remainingTime < 5 * 60) {
     refreshToken();
   }
   ```

### Email & Notification Issues

#### Issue: Emails Not Sending

**Symptoms:**

- Ticket created but no email received
- Email service error in logs

**Check Email Configuration:**

1. Verify SMTP settings in .env

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=app_password_not_regular_password
   ```

2. Check email service logs

   ```bash
   tail -f logs/app.log | grep email
   ```

3. Test email service manually

   ```bash
   npm run test:email
   ```

4. Check email queue
   ```javascript
   // In Redis, check Bull queue
   redis-cli LLEN bull:notifications:jobs
   ```

### SLA & Automation Issues

#### Issue: SLA Not Calculated Correctly

**Solutions:**

1. Check SLA rules in database

   ```sql
   SELECT * FROM sla_rules WHERE is_active=true;
   ```

2. Verify ticket priority is set

   ```sql
   SELECT ticket_number, priority, sla_due_date FROM tickets LIMIT 5;
   ```

3. Check SLA job is running

   ```bash
   # In logs
   grep "SLA check" logs/app.log
   ```

4. Manual SLA calculation
   ```javascript
   const slaService = require("./services/sla.service");
   slaService.calculateSLA(ticket);
   ```

#### Issue: Tickets Not Auto-Routing

**Causes:**

1. Routing rules not configured

   ```sql
   SELECT * FROM routing_rules WHERE is_active=true;
   ```

2. Team not assigned to rule

   ```sql
   INSERT INTO routing_rules (category, assigned_team, is_active)
   VALUES ('Hardware', 'team-uuid', true);
   ```

3. Auto-routing service not running

**Solutions:**

1. Verify routing service

   ```bash
   grep "Routing" logs/app.log
   ```

2. Check if team exists
   ```sql
   SELECT * FROM teams;
   ```

### Performance Issues

#### Issue: Application Running Slow

**Diagnostics:**

1. Check API response times

   ```bash
   # In browser DevTools → Network tab
   # Look for requests taking >2 seconds
   ```

2. Monitor server resources

   ```powershell
   # Windows
   Get-Process node | Select CPU, Memory
   ```

3. Check database query performance
   ```sql
   SELECT query, mean_time FROM pg_stat_statements
   ORDER BY mean_time DESC LIMIT 10;
   ```

**Solutions:**

1. Add indexes

   ```sql
   CREATE INDEX idx_tickets_status_created ON tickets(status, created_at DESC);
   ```

2. Optimize queries (use LIMIT, pagination)
3. Enable caching

   ```javascript
   // Cache frequently accessed data
   const cachedData = await redis.get("key");
   ```

4. Increase resource allocation
   ```yaml
   # In docker-compose.yml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: "2.0"
             memory: 2G
   ```

### Deployment Issues

#### Issue: Docker Build Fails

**Error:**

```
Step 5/10 : npm install
ERROR: npm ERR! code EACCES
```

**Solutions:**

1. Clear npm cache

   ```bash
   npm cache clean --force
   ```

2. Check package.json for errors
3. Build with no cache
   ```powershell
   docker-compose build --no-cache
   ```

#### Issue: Service Won't Start in Docker

**Solutions:**

1. Check logs

   ```bash
   docker-compose logs backend
   ```

2. Verify environment variables

   ```bash
   docker-compose config
   ```

3. Check port bindings
   ```bash
   docker ps
   ```

### Security Issues

#### Issue: HTTPS Certificate Error

**Error:**

```
SSL_ERROR_UNSUPPORTED_PROTOCOL
```

**Solutions:**

1. Ensure HTTPS is enabled in production
2. Install valid SSL certificate
3. Configure reverse proxy (Nginx)

#### Issue: SQL Injection Attempt Detected

**Prevention:**

1. Always use parameterized queries

   ```javascript
   // WRONG
   query("SELECT * FROM users WHERE email=" + email);

   // RIGHT
   query("SELECT * FROM users WHERE email=$1", [email]);
   ```

2. Validate user input
3. Use ORM/query builder if possible

---

## Debugging Tips

### Enable Debug Logging

```bash
# In .env
LOG_LEVEL=debug

# In code
logger.debug('Debug message', { variable });
```

### Check Logs

```bash
# Real-time logs
tail -f logs/app.log

# Filter logs
grep "error" logs/app.log
grep "ticket" logs/app.log

# Search with timestamp
grep "2026-02-07" logs/app.log
```

### Database Debugging

```sql
-- Check active queries
SELECT * FROM pg_stat_activity;

-- Kill slow queries
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE query LIKE '%SELECT%' AND state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Browser DevTools Debugging

1. **Console Tab**: Check for JavaScript errors
2. **Network Tab**: Monitor API requests
3. **Application Tab**: Check LocalStorage and cookies
4. **Performance Tab**: Check page load performance

### Node.js Debugging

```javascript
// Add debugger statement
debugger;

// Or use Node inspect
// node --inspect-brk src/server.js
// Then open chrome://inspect
```

---

## Getting Help

### Check Documentation

1. User Manual: `/documentation/USER_MANUAL.md`
2. API Documentation: `/documentation/API_DOCUMENTATION.md`
3. System Architecture: `/documentation/SYSTEM_ARCHITECTURE.md`

### Common Commands

```bash
# View running services
docker-compose ps

# View logs
docker-compose logs -f backend

# Restart services
docker-compose restart

# Stop and remove
docker-compose down

# Remove all data
docker-compose down -v
```

### Contact Support

- **Email**: it-support@madison88.com
- **Issues**: Create GitHub issue with:
  - Error message
  - Steps to reproduce
  - Environment (dev/staging/prod)
  - Logs if available

---

## Performance Baseline

Expected response times:

- Login: <200ms
- List tickets: <500ms
- Get ticket details: <300ms
- Create ticket: <300ms
- Search KB: <400ms

If experiencing slower performance, check:

1. Database connection
2. Network latency
3. Server resources
4. Query performance

---

**Last Updated:** February 7, 2026
**Version:** 1.0
