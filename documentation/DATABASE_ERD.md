# Madison88 ITSM - Database ERD (Entity-Relationship Diagram)

## Core Entities

### Users (End Users, IT Agents, Managers, Admins)

```
user_id (PK)
├── email (UNIQUE)
├── password_hash
├── first_name
├── last_name
├── role (end_user | it_agent | it_manager | system_admin)
├── department
├── location (Philippines | US | Indonesia | Other)
├── phone
├── is_active
├── last_login
└── timestamps (created_at, updated_at)
```

### Teams (IT Support Teams)

```
team_id (PK)
├── team_name (UNIQUE)
├── description
├── team_lead_id (FK: users)
├── location
├── category_assigned
├── is_active
└── timestamps
```

### Tickets (Core Ticketing System)

```
ticket_id (PK)
├── ticket_number (UNIQUE, auto-generated)
├── user_id (FK: users) - Requester
├── category (Hardware | Software | Access Request | etc.)
├── subcategory
├── priority (P1 | P2 | P3 | P4)
├── title
├── description
├── business_impact
├── status (New | In Progress | Pending | Resolved | Closed | Reopened)
├── location
├── assigned_to (FK: users)
├── assigned_team (FK: teams)
├── sla_due_date
├── sla_response_due
├── sla_breached
├── reopened_count
├── parent_ticket_id (FK: tickets) - For linking related tickets
├── priority_override_reason
├── tags
├── currency & cost fields
└── timestamps (created_at, updated_at, resolved_at, closed_at)
```

### Ticket_Comments

```
comment_id (PK)
├── ticket_id (FK: tickets)
├── user_id (FK: users)
├── comment_text
├── is_internal (not visible to end users)
├── is_edited
└── timestamps
```

### Ticket_Attachments

```
attachment_id (PK)
├── ticket_id (FK: tickets)
├── file_name
├── file_path (AWS S3)
├── file_size
├── file_type
├── uploaded_by (FK: users)
└── timestamps
```

## Configuration & Rules

### SLA_Rules

```
sla_id (PK)
├── priority (UNIQUE: P1 | P2 | P3 | P4)
├── response_time_hours
├── resolution_time_hours
├── escalation_threshold_percent (default: 80)
└── is_active
```

### Routing_Rules

```
rule_id (PK)
├── category
├── subcategory
├── assigned_team (FK: teams)
├── priority_override
├── location
├── is_active
└── order_priority
```

### Classification_Rules

```
rule_id (PK)
├── rule_name
├── keywords (array)
├── matching_type (any | all)
├── assigned_priority
├── assigned_category
├── is_active
└── order_priority
```

## Knowledge Base

### Knowledge_Base_Articles

```
article_id (PK)
├── title
├── slug (UNIQUE)
├── content
├── summary
├── category
├── tags
├── author_id (FK: users)
├── status (draft | published | archived)
├── views
├── helpful_count
├── unhelpful_count
├── version
├── is_featured
└── timestamps (created_at, updated_at, published_at, archived_at)
```

### KB_Article_Versions

```
version_id (PK)
├── article_id (FK: knowledge_base_articles)
├── content
├── version_number
├── changed_by (FK: users)
└── timestamps
```

### KB_Article_Feedback

```
feedback_id (PK)
├── article_id (FK: knowledge_base_articles)
├── user_id (FK: users) - optional for anonymous feedback
├── feedback_type (helpful | unhelpful)
└── comment
```

## Change Management

### Change_Requests

```
change_id (PK)
├── change_number (UNIQUE)
├── ticket_id (FK: tickets) - related incident
├── title
├── description
├── change_type (standard | normal | emergency)
├── affected_systems
├── implementation_plan
├── rollback_plan
├── risk_assessment (low | medium | high | critical)
├── change_window_start
├── change_window_end
├── requested_by (FK: users)
├── status (new | submitted | approved | scheduled | implemented | closed | rejected)
└── timestamps
```

### Change_Approvers

```
approver_id (PK)
├── change_id (FK: change_requests)
├── user_id (FK: users)
├── approval_status (pending | approved | rejected)
└── approved_at
```

## Service Requests

### Service_Requests

```
request_id (PK)
├── request_number (UNIQUE)
├── ticket_id (FK: tickets)
├── request_type (access_request | account_creation | hardware_request | software_request)
├── details (JSONB) - flexible structure per type
├── requested_by (FK: users)
├── approver_id (FK: users)
├── status (submitted | approved | rejected | fulfilled | completed)
└── timestamps
```

## Asset Management

### IT_Assets

```
asset_id (PK)
├── asset_tag (UNIQUE)
├── serial_number
├── asset_type (laptop | desktop | monitor | printer | phone | tablet | server | network_device)
├── model
├── manufacturer
├── assigned_user_id (FK: users)
├── location
├── purchase_date
├── warranty_expiration
├── last_maintenance_date
├── next_maintenance_date
├── cost
├── currency
├── status (active | inactive | retired | for_repair)
└── timestamps
```

### Asset_Tickets

```
association_id (PK)
├── asset_id (FK: it_assets)
├── ticket_id (FK: tickets)
└── associated_at
```

## Audit & Logging

### Audit_Logs

```
log_id (PK)
├── ticket_id (FK: tickets) - optional
├── user_id (FK: users)
├── action_type (created | updated | assigned | commented | closed | etc.)
├── entity_type (ticket | user | team | etc.)
├── entity_id
├── old_value
├── new_value
├── description
├── ip_address
├── user_agent
├── session_id
└── timestamp
```

### SLA_History

```
history_id (PK)
├── ticket_id (FK: tickets)
├── sla_id (FK: sla_rules)
├── response_due
├── resolution_due
├── response_met
├── resolution_met
├── escalated_at
├── breached_at
└── recorded_at
```

## Relationships Summary

- **Users** ↔ **Teams** (Many-to-Many via team_members)
- **Users** ↔ **Tickets** (1-to-Many as requester)
- **Users** ↔ **Tickets** (1-to-Many as assignee)
- **Teams** ↔ **Tickets** (1-to-Many)
- **Tickets** ↔ **Ticket_Comments** (1-to-Many)
- **Tickets** ↔ **Ticket_Attachments** (1-to-Many)
- **Tickets** ↔ **Audit_Logs** (1-to-Many)
- **Tickets** ↔ **Change_Requests** (1-to-Many)
- **Tickets** ↔ **IT_Assets** (Many-to-Many via asset_tickets)
- **Users** ↔ **Audit_Logs** (1-to-Many)
- **Users** ↔ **Knowledge_Base_Articles** (1-to-Many as author)
- **Knowledge_Base_Articles** ↔ **KB_Article_Versions** (1-to-Many)

## Key Indexes for Performance

- users(email, role, is_active)
- tickets(ticket_number, user_id, assigned_to, assigned_team, status, priority, category, created_at, sla_due_date, sla_breached)
- ticket_comments(ticket_id, user_id)
- audit_logs(ticket_id, user_id, timestamp, action_type)
- knowledge_base_articles(category, status, author_id)
- change_requests(status, ticket_id)
- it_assets(asset_tag, assigned_user_id, status)

## Views for Reporting

1. **sla_performance_summary** - SLA compliance by priority
2. **team_performance_summary** - Team metrics and efficiency
3. **aging_tickets** - Tickets open > 7/14/30 days
