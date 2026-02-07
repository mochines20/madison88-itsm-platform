# Madison88 ITSM Platform - System Architecture

## High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  React.js SPA  │  Mobile Browser  │  Admin Dashboard            │
└────────────────┬──────────────────┬──────────────────────────────┘
                 │                  │
                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Gateway / Load Balancer                         │
│  (Nginx/AWS ELB) - Rate Limiting, SSL/TLS Termination           │
└────────────────┬──────────────────┬──────────────────────────────┘
                 │                  │
                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Express.js Backend API (Node.js)                   │
├─────────────────────────────────────────────────────────────────┤
│  Routes        │ Controllers    │ Services   │ Middleware       │
│  - Auth        │ - Ticket Mgmt  │ - Ticket   │ - Auth Guard    │
│  - Tickets     │ - Dashboard    │ - SLA      │ - Error Handler │
│  - KB          │ - Knowledge    │ - Email    │ - Validation    │
│  - Dashboard   │ - Admin        │ - Auth     │ - Logging       │
│  - Admin       │                │ - Routing  │                 │
└────────────────┬───────────────┬────────────┴──────────────────┘
                 │               │
                 ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data & Cache Layer                           │
├──────────────────────────┬──────────────────────────────────────┤
│    PostgreSQL Database   │     Redis Cache                      │
│  - Users                 │  - Sessions                          │
│  - Tickets               │  - Rate Limits                       │
│  - Comments              │  - Frequently Accessed Data          │
│  - Attachments           │  - Job Queue                         │
│  - SLA Rules             │  - Real-time Subscriptions           │
│  - Routing Rules         │                                      │
│  - Knowledge Base        │                                      │
│  - Audit Logs            │                                      │
│  - Change Requests       │                                      │
│  - Assets                │                                      │
└──────────────────────────┴──────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 External Services                               │
├─────────────────────────────────────────────────────────────────┤
│  AWS S3 (File Storage)  │  Email Service (SMTP/SendGrid)        │
│  Socket.io (Real-time)  │  Logging (ELK Stack)                  │
│  Power BI (Dashboards)  │  Monitoring (Datadog/New Relic)       │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Component Architecture

### 1. Frontend Layer (React.js)

**Components:**

- **Pages**: Login, Dashboard, Ticket Form, Ticket List, Ticket Details, KB, Admin Panel
- **Components**: Header, Sidebar, Modal, Forms, Tables, Charts
- **Services**: API Client, Auth Service, WebSocket Client
- **Hooks**: useQuery, useTickets, useAuth
- **State Management**: Zustand for global state

**Key Features:**

- Real-time updates via Socket.io
- Responsive design (Mobile, Tablet, Desktop)
- Form validation
- Error handling & User feedback
- Chart visualization (Chart.js/React-ChartJS-2)

### 2. API Layer (Express.js + Node.js)

**Route Structure:**

```
/api
  /auth (Authentication)
  /tickets (Ticket Management)
    /:id/comments
    /:id/attachments
    /:id/audit-log
  /dashboard (Reporting)
  /kb (Knowledge Base)
  /admin (Administration)
  /users (User Management)
  /teams (Team Management)
  /changes (Change Requests)
  /assets (Asset Management)
```

**Middleware Stack:**

1. CORS - Cross-origin resource sharing
2. Helmet - Security headers
3. Morgan - Request logging
4. Rate Limiter - Prevent abuse
5. Body Parser - Parse JSON/form data
6. Auth Validator - JWT verification
7. Error Handler - Centralized error handling

### 3. Service Layer

**Services:**

- **AuthService**: User authentication, JWT management
- **TicketService**: CRUD operations, ticket workflows
- **SLAService**: SLA calculation, escalation
- **RoutingService**: Intelligent ticket routing
- **ClassificationService**: Auto-priority assignment
- **EmailService**: Notification sending
- **AuditService**: Action logging
- **ReportingService**: Dashboard data generation
- **FileService**: S3 upload/download

### 4. Data Layer

**Database Design:**

- Normalized schema (3NF)
- Proper indexing for performance
- Audit trail via JSON columns
- Time-series data for SLA tracking

**Caching Strategy:**

- Session data in Redis
- Frequently accessed views in Redis
- Rate limit counters in Redis
- Job queue for async tasks (Bull)

### 5. External Integrations

**Email Notifications:**

- Transactional emails via SMTP/SendGrid
- Email templates for different events
- Retry mechanism for failed sends

**File Storage:**

- AWS S3 for document storage
- Signed URLs for secure downloads
- Virus scanning on upload
- CDN integration for fast delivery

**Real-time Communication:**

- Socket.io for live updates
- Room-based subscriptions (ticket-specific)
- Automatic reconnection
- Fallback to polling

**Monitoring & Logging:**

- ELK Stack for centralized logging
- Application performance monitoring
- Error tracking (Sentry)
- Custom metrics

## Deployment Architecture

### Development Environment

```
Local Machine
├── Docker Compose
│   ├── PostgreSQL
│   ├── Redis
│   ├── Backend (Node.js)
│   ├── Frontend (React)
│   └── pgAdmin
```

### Staging Environment

```
AWS (Staging)
├── EC2 Instances (Backend)
│   ├── Node.js Application
│   ├── Application Server (PM2)
│   └── Reverse Proxy (Nginx)
├── RDS PostgreSQL
├── ElastiCache Redis
├── S3 (File Storage)
├── CloudFront CDN
├── ELB (Load Balancer)
└── CloudWatch (Monitoring)
```

### Production Environment

```
AWS (Production)
├── Auto Scaling Group (Backend)
│   ├── Multiple EC2 Instances
│   ├── Container Orchestration (ECS/Kubernetes)
│   └── Reverse Proxy (Nginx)
├── RDS PostgreSQL (Multi-AZ)
├── ElastiCache Redis (Cluster)
├── S3 (File Storage)
├── CloudFront CDN
├── Application Load Balancer (ALB)
├── CloudWatch (Monitoring)
├── CloudTrail (Audit)
└── VPC & Security Groups
```

## API Flow Examples

### 1. Ticket Creation Flow

```
Client Request
    ↓
API Gateway
    ↓
Auth Middleware (Verify JWT)
    ↓
Validation Middleware (Check required fields)
    ↓
Ticket Controller
    ↓
Ticket Service
    ├─ Auto-Classify Priority (Classification Service)
    ├─ Apply Routing Rules (Routing Service)
    ├─ Save to Database
    ├─ Calculate SLA Due Dates (SLA Service)
    └─ Log Audit Trail
    ↓
Email Service (Send notifications)
    ↓
Socket.io (Broadcast to assigned agent)
    ↓
Response to Client
```

### 2. SLA Monitoring Flow

```
Scheduled Job (Every 5 minutes)
    ↓
Fetch all active tickets with SLA due dates
    ↓
For each ticket:
    ├─ Calculate remaining time
    ├─ Check if 80% threshold crossed
    │   ├─ If YES: Escalate (Send email, Notification)
    │   └─ Update ticket escalation status
    └─ Check if breached
        ├─ If YES: Mark SLA breached
        └─ Send breach notification to manager
    ↓
Log actions in audit trail
    ↓
Update dashboard metrics
```

### 3. Auto-Routing Flow

```
Ticket Created
    ↓
Extract category from ticket
    ↓
Check Classification Rules
    ├─ Parse keywords from description
    ├─ Apply business impact rules
    └─ Determine priority if not set
    ↓
Check Routing Rules
    ├─ Match category to team
    ├─ Apply location-based routing
    └─ Load balance within team (select agent with lowest ticket count)
    ↓
Assign ticket to agent/team
    ↓
Send assignment notification
    ↓
Return to client
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Internet                                     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  WAF (Web App Firewall)│
            │  (AWS WAF)            │
            └───────┬───────────────┘
                    │
                    ▼
            ┌───────────────────────┐
            │  ALB (Load Balancer)  │
            │  SSL/TLS Termination  │
            └───────┬───────────────┘
                    │
                    ▼
            ┌───────────────────────┐
            │  EC2 Instances        │
            │  (Backend)            │
            │  Rate Limiting        │
            │  CORS Validation      │
            └───────┬───────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
    ┌──────┐  ┌──────┐  ┌──────┐
    │ Auth │  │ RDS  │  │ S3   │
    │(JWT) │  │(Enc) │  │(Enc) │
    └──────┘  └──────┘  └──────┘

- HTTPS/TLS for all communications
- JWT tokens for API authentication
- Role-based access control (RBAC)
- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization)
- CSRF tokens for state-changing operations
- Rate limiting per IP and user
- Database encryption at rest
- Secrets management (AWS Secrets Manager)
- VPC & Security Groups isolation
```

## Scalability Considerations

### Horizontal Scaling

**Backend:**

- Stateless Node.js instances
- Auto-scaling based on CPU/Memory
- Load balancing with session affinity (optional)

**Database:**

- Read replicas for reporting queries
- Connection pooling
- Query optimization and indexing

**Cache:**

- Redis Cluster mode for distributed caching
- Cache invalidation strategies

**File Storage:**

- S3 with CloudFront CDN
- Multipart uploads for large files

### Vertical Scaling

- Increase instance size
- Database resource allocation
- Cache node upgrades

### Performance Optimization

1. **Database:**
   - Proper indexing strategy
   - Query optimization
   - Materialized views for reporting

2. **Caching:**
   - Redis caching layer
   - HTTP caching headers
   - CDN for static assets

3. **Frontend:**
   - Code splitting and lazy loading
   - Image optimization
   - Minification and compression

4. **API:**
   - Pagination for list endpoints
   - Field filtering to reduce payload
   - Batch operations where possible

## Disaster Recovery

```
Production Database (Primary)
        │
        ├─ Automated Backup (Daily)
        │  └─ S3 (30-day retention)
        │
        ├─ Multi-AZ Deployment (Standby)
        │  └─ Automatic failover in 1-2 minutes
        │
        └─ Replication
           └─ Read replica in different region
```

**Recovery Time Objective (RTO):** < 5 minutes
**Recovery Point Objective (RPO):** < 1 hour

## Monitoring & Observability

```
Application
    ├─ CloudWatch Metrics
    │  ├─ API Response Time
    │  ├─ Error Rate
    │  ├─ Database Queries
    │  └─ Cache Hit Rate
    │
    ├─ Logs
    │  ├─ Application Logs (ELK)
    │  ├─ Access Logs (CloudWatch)
    │  ├─ Error Logs (CloudWatch)
    │  └─ Audit Logs
    │
    └─ Alerts
       ├─ High Error Rate (>1%)
       ├─ Slow API Response (>2s)
       ├─ Database Connection Issues
       ├─ SLA Breaches
       └─ Security Events
```

---

This architecture is designed to be:

- **Scalable**: Handle 500+ users and 10,000+ tickets annually
- **Reliable**: 99% uptime SLA with redundancy
- **Secure**: Enterprise-grade security measures
- **Maintainable**: Clean separation of concerns
- **Observable**: Comprehensive monitoring and logging
