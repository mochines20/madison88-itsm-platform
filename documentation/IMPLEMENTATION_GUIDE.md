# Madison88 ITSM - Implementation Roadmap & Getting Started Guide

## Quick Start (5 Minutes)

### Prerequisites

- Node.js v16+
- PostgreSQL 12+
- Redis 6+
- Docker & Docker Compose (optional)

### Installation Options

#### Option 1: Using Docker (Recommended)

```powershell
# Navigate to project directory
cd c:\Users\john carlo manalo\Desktop\madison88-itsm

# Start all services
docker-compose -f docker/docker-compose.yml up -d

# Wait for services to be ready (2-3 minutes)
# Access the application:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:3001
# - Database Admin: http://localhost:5050
```

#### Option 2: Manual Installation

**Backend Setup:**

```powershell
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run migrate
npm run dev
```

**Frontend Setup (New Terminal):**

```powershell
cd frontend
npm install
cp .env.example .env
npm start
```

### Verify Installation

1. Backend: `curl http://localhost:3001/health`
2. Frontend: Open `http://localhost:3000` in browser
3. Database: `psql -U itsmuser -d madison88_itsm`

---

## Implementation Phases

### Phase 1: Core Ticketing (Weeks 1-4)

**Goals:**

- ✅ User authentication & authorization
- ✅ Ticket creation form with validation
- ✅ Basic ticket management
- ✅ Email notifications
- ✅ Audit logging

**Deliverables:**

1. User login/logout functionality
2. Ticket submission form (frontend)
3. Ticket CRUD endpoints (backend)
4. Email notification system
5. Audit trail logging

**Key Files to Implement:**

- `backend/src/controllers/auth.controller.js`
- `backend/src/controllers/tickets.controller.js`
- `backend/src/services/ticket.service.js`
- `backend/src/services/email.service.js`
- `frontend/src/pages/TicketForm.jsx`
- `frontend/src/pages/TicketDetail.jsx`

**Testing:**

- Unit tests for service layer
- Integration tests for API endpoints
- Manual UAT with sample users

---

### Phase 2: Automation & Routing (Weeks 5-8)

**Goals:**

- ✅ Auto-classification engine
- ✅ SLA timer implementation
- ✅ Workflow routing
- ✅ Dashboard endpoints

**Deliverables:**

1. Classification rules engine
2. SLA calculation & tracking
3. Ticket routing logic
4. Dashboard data endpoints
5. RBAC implementation

**Key Files to Implement:**

- `backend/src/services/classification.service.js`
- `backend/src/services/sla.service.js`
- `backend/src/services/routing.service.js`
- `backend/src/controllers/dashboard.controller.js`
- `backend/src/middleware/rbac.middleware.js`
- `frontend/src/components/Dashboard.jsx`

**Scheduled Jobs:**

- SLA check job (every 5 minutes)
- Escalation job (every 15 minutes)
- Notification job (real-time)

---

### Phase 3: Advanced Features (Weeks 9-12)

**Goals:**

- ✅ Knowledge base system
- ✅ Change management
- ✅ Asset tracking
- ✅ Power BI data export

**Deliverables:**

1. KB article management
2. KB search functionality
3. Change request workflow
4. Asset tracking system
5. Data export APIs
6. Integration with Power BI

**Key Files to Implement:**

- `backend/src/controllers/knowledgebase.controller.js`
- `backend/src/services/kb.service.js`
- `backend/src/controllers/changes.controller.js`
- `backend/src/services/change.service.js`
- `backend/src/controllers/assets.controller.js`
- `backend/src/services/export.service.js`
- `frontend/src/pages/KnowledgeBase.jsx`
- `frontend/src/pages/ChangeRequest.jsx`

---

### Phase 4: Testing & Deployment (Weeks 13-16)

**Goals:**

- ✅ User acceptance testing (UAT)
- ✅ Bug fixes and optimization
- ✅ Performance testing
- ✅ Security hardening
- ✅ Production deployment

**Activities:**

1. UAT with IT team and sample end-users
2. Performance testing (load testing)
3. Security penetration testing
4. Documentation finalization
5. Training materials creation
6. Staging deployment
7. Production deployment
8. Post-launch support

**Deliverables:**

1. Test reports
2. Performance benchmarks
3. Security audit results
4. Training videos
5. User documentation
6. Admin guide
7. Troubleshooting guide

---

## Development Workflow

### Code Structure

```
backend/
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js           # Server entry point
│   ├── config/             # Configuration files
│   │   ├── database.js
│   │   └── redis.js
│   ├── controllers/        # Request handlers
│   │   ├── auth.controller.js
│   │   ├── tickets.controller.js
│   │   ├── dashboard.controller.js
│   │   └── ...
│   ├── services/           # Business logic
│   │   ├── ticket.service.js
│   │   ├── auth.service.js
│   │   ├── sla.service.js
│   │   ├── classification.service.js
│   │   ├── routing.service.js
│   │   ├── email.service.js
│   │   └── ...
│   ├── models/             # Data models (optional, if using ORM)
│   ├── routes/             # API routes
│   │   ├── auth.routes.js
│   │   ├── tickets.routes.js
│   │   └── ...
│   ├── middleware/         # Custom middleware
│   │   ├── auth.middleware.js
│   │   ├── rbac.middleware.js
│   │   └── error.middleware.js
│   ├── utils/              # Utility functions
│   │   ├── logger.js
│   │   ├── validators.js
│   │   └── helpers.js
│   └── jobs/               # Scheduled jobs
│       ├── sla.job.js
│       └── notification.job.js
├── migrations/             # Database migrations
├── tests/                  # Test files
└── .env.example            # Environment template
```

### Development Guidelines

**Code Standards:**

- Use ES6+ features
- Follow ESLint configuration
- Add JSDoc comments for functions
- Keep functions focused and small
- Use error handling consistently

**Database Queries:**

- Always use parameterized queries
- Avoid SELECT \* (specify columns)
- Add proper indexes
- Use transactions for multi-step operations

**API Responses:**

- Consistent response format
- Meaningful error messages
- Proper HTTP status codes
- Include metadata (pagination, timestamps)

**Testing:**

- Minimum 80% code coverage
- Unit tests for services
- Integration tests for API endpoints
- E2E tests for critical workflows

---

## Key Implementation Tasks

### Task 1: User Authentication

**Objective:** Implement JWT-based authentication

**Steps:**

1. Create User model with password hashing (bcrypt)
2. Implement login endpoint:
   - Validate credentials
   - Generate JWT tokens (access + refresh)
   - Set secure HTTP-only cookies
3. Implement logout endpoint:
   - Invalidate tokens
   - Clear session data
4. Implement token refresh endpoint
5. Create auth middleware for protecting routes

**Files to Create:**

- `backend/src/services/auth.service.js`
- `backend/src/controllers/auth.controller.js`
- `backend/src/middleware/auth.middleware.js`

### Task 2: Ticket CRUD Operations

**Objective:** Implement core ticket management

**Steps:**

1. Create Ticket model/schema
2. Implement POST /tickets (create)
   - Validate all required fields
   - Generate unique ticket number
   - Set initial status = "New"
   - Calculate SLA due dates
3. Implement GET /tickets (list with filters)
   - Pagination
   - Status/priority/category filters
   - Sorting options
4. Implement GET /tickets/:id (details)
   - Include comments and attachments
   - Include audit trail preview
5. Implement PATCH /tickets/:id (update)
   - Validate changes
   - Log audit trail
   - Update SLA if priority changes
6. Implement soft delete (mark as deleted, don't remove)

**Files to Create:**

- `backend/src/services/ticket.service.js`
- `backend/src/controllers/tickets.controller.js`

### Task 3: Auto-Classification Engine

**Objective:** Automatically assign priority based on description

**Implementation:**

1. Create classification rules in database
2. Build keyword matching algorithm
3. Implement priority assignment logic:
   - Parse ticket description
   - Match against keywords
   - Check business impact
   - Consider reporter role/department
   - Return calculated priority
4. Allow manual override with logging
5. Add logging for classification decisions

**Files to Create:**

- `backend/src/services/classification.service.js`
- `database/seeds/classification_rules.sql`

**Example Rules:**

```javascript
{
  keywords: ['outage', 'down', 'offline'],
  priority: 'P1',
  weight: 0.95
}
{
  keywords: ['slow', 'laggy', 'performance'],
  priority: 'P2',
  weight: 0.75
}
```

### Task 4: SLA Management

**Objective:** Track and manage Service Level Agreements

**Implementation:**

1. Create SLA rules in database (P1-P4)
2. On ticket creation:
   - Fetch SLA rule for priority
   - Calculate response_due = created_at + response_hours
   - Calculate resolution_due = created_at + resolution_hours
3. Implement SLA monitoring job:
   - Run every 5 minutes
   - Check all open tickets
   - If time remaining < 20%: mark as warning
   - If time exceeded: mark as breached
   - Send notifications
4. Update ticket status dashboard

**Files to Create:**

- `backend/src/services/sla.service.js`
- `backend/src/jobs/sla.job.js`

### Task 5: Ticket Routing

**Objective:** Automatically assign tickets to right team/agent

**Implementation:**

1. Create routing rules in database
   - Category → Team mapping
   - Location-based rules
   - Priority overrides
2. On ticket creation:
   - Extract category
   - Find matching routing rule
   - Select team
   - Load balance within team (agent with fewest tickets)
   - Assign ticket
3. Support manual reassignment

**Files to Create:**

- `backend/src/services/routing.service.js`
- `database/seeds/routing_rules.sql`

### Task 6: Email Notifications

**Objective:** Send timely notifications for ticket events

**Implementation:**

1. Set up email service (Nodemailer or SendGrid)
2. Create email templates:
   - Ticket created (to user)
   - Ticket assigned (to agent)
   - Comment added (to user)
   - SLA warning (to agent & manager)
   - Ticket resolved (to user)
3. Implement email queue
   - Async sending using Bull/Redis
   - Retry logic for failed emails
   - Tracking of sent emails

**Files to Create:**

- `backend/src/services/email.service.js`
- `backend/src/jobs/notification.job.js`
- `backend/src/templates/emails/`

### Task 7: Dashboard APIs

**Objective:** Provide data for reporting dashboards

**Implementation:**

1. Create views in database for quick queries:
   - sla_performance_summary
   - team_performance_summary
   - aging_tickets
2. Implement endpoints:
   - GET /dashboard/sla-performance
   - GET /dashboard/ticket-volume
   - GET /dashboard/team-performance
   - GET /dashboard/aging-report
   - GET /dashboard/export (CSV/JSON)
3. Add caching for frequently accessed data

**Files to Create:**

- `backend/src/services/reporting.service.js`
- `backend/src/controllers/dashboard.controller.js`

### Task 8: Frontend UI Components

**Objective:** Build user-facing interface

**Key Components:**

1. **LoginPage**: Email/password form with validation
2. **TicketForm**: Multi-step form for creating tickets
3. **TicketList**: Table view with filters, pagination
4. **TicketDetail**: Full ticket view with comments, attachments
5. **Dashboard**: Charts and metrics
6. **KnowledgeBase**: Search and article browsing
7. **AdminPanel**: User/team management

**Files to Create:**

- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/TicketForm.jsx`
- `frontend/src/pages/TicketList.jsx`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/components/Dashboard.jsx`
- `frontend/src/components/SLAIndicator.jsx`
- `frontend/src/components/TicketStatusBadge.jsx`

---

## Testing Strategy

### Unit Tests (Backend)

**Services to Test:**

- AuthService: Login, logout, token validation
- TicketService: CRUD operations
- ClassificationService: Priority assignment
- SLAService: Due date calculation
- RoutingService: Team assignment
- EmailService: Email sending

**Example Test:**

```javascript
describe("TicketService", () => {
  test("should create ticket with auto-assigned priority", async () => {
    const ticket = await ticketService.create({
      title: "System down",
      description: "The system is completely down",
      // ...
    });
    expect(ticket.priority).toBe("P1");
  });
});
```

### Integration Tests (API)

**Endpoints to Test:**

- POST /api/auth/login
- POST /api/tickets
- GET /api/tickets
- PATCH /api/tickets/:id
- POST /api/tickets/:id/comments

**Example Test:**

```javascript
describe("Ticket API", () => {
  test("should create ticket and auto-route to team", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "Hardware",
        title: "Laptop issue",
        description: "Laptop not starting",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.assigned_team).toBeDefined();
  });
});
```

### E2E Tests

**Critical User Flows:**

1. User creates ticket → Agent receives & updates → User sees update
2. P1 ticket creation → Auto-escalation at 80% SLA
3. Access request → Manager approval → Fulfillment

---

## Performance Optimization

### Database

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_tickets_status_priority ON tickets(status, priority);
CREATE INDEX idx_tickets_assigned_to_created_at ON tickets(assigned_to, created_at);
CREATE INDEX idx_comments_ticket_created ON ticket_comments(ticket_id, created_at DESC);

-- Use EXPLAIN ANALYZE to check query performance
EXPLAIN ANALYZE SELECT * FROM tickets WHERE status='In Progress' AND priority='P1';
```

### Caching

```javascript
// Cache SLA rules for 1 hour
await redis.setex("sla_rules", 3600, JSON.stringify(rules));

// Cache frequently accessed articles
await redis.setex(`kb_article:${id}`, 3600, JSON.stringify(article));
```

### API Optimization

- Pagination: Return 50 items max per page
- Lazy loading: Load comments/attachments on demand
- Batch operations: Support bulk ticket updates
- Field filtering: Let clients specify which fields to return

---

## Monitoring & Logging

### Application Monitoring

```javascript
// Log important events
logger.info("Ticket created", { ticket_id, category, priority });
logger.warn("SLA warning", { ticket_id, time_remaining: "30 minutes" });
logger.error("Email send failed", { ticket_id, error: err.message });
```

### Database Monitoring

- Query execution time
- Connection pool usage
- Slow query log
- Index usage statistics

### System Metrics

- API response time
- Error rate
- Database query performance
- Memory and CPU usage
- File storage usage

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (80%+ coverage)
- [ ] Code review completed
- [ ] Security scan passed
- [ ] Performance testing completed
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Backup procedures tested
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] User training completed

### Deployment Steps

1. Tag release in Git
2. Build Docker images
3. Push to Docker registry
4. Deploy to staging environment
5. Run smoke tests
6. Get stakeholder approval
7. Schedule deployment window
8. Deploy to production
9. Verify health checks
10. Monitor logs for errors
11. Run post-deployment tests
12. Announce to users

### Post-Deployment

- [ ] Monitor error rates
- [ ] Track SLA compliance
- [ ] Collect user feedback
- [ ] Document any issues
- [ ] Plan next improvements

---

## Success Metrics

Track these metrics to measure success:

| Metric                   | Target             | Timeline |
| ------------------------ | ------------------ | -------- |
| Platform adoption        | 100% of IT tickets | 90 days  |
| SLA compliance           | ≥90%               | 60 days  |
| Ticket resolution time   | -40% vs email      | 90 days  |
| User satisfaction        | ≥80%               | 90 days  |
| Platform uptime          | 99%                | ongoing  |
| Average response time    | <2 seconds         | ongoing  |
| First contact resolution | ≥60%               | ongoing  |

---

## Support & Maintenance

### Regular Maintenance Tasks

- **Daily**: Monitor logs and alerts
- **Weekly**: Review SLA compliance, check backup integrity
- **Monthly**: Database optimization, update dependencies
- **Quarterly**: Security audit, capacity planning
- **Annually**: Disaster recovery drill, license renewal

### Support Contacts

- **Technical Issues**: it-support@madison88.com
- **Feature Requests**: features@madison88.com
- **Security Concerns**: security@madison88.com
- **Critical Incidents**: +63-2-XXXX-XXXX (24/7)

---

**Project Status:** Phase 1 - Ready for Development
**Next Steps:** Set up development environment and begin Phase 1 implementation
**Questions?** Contact the IT team or review the API documentation
