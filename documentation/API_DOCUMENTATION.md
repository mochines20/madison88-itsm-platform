# Madison88 ITSM - API Documentation

## Overview

The Madison88 ITSM API is a RESTful API built with Node.js/Express that provides comprehensive ticket management, knowledge base, and reporting functionality. All endpoints return JSON responses and require JWT authentication (except for login endpoint).

## Base URL

```
Development: http://localhost:3001/api
Staging: https://staging-itsm.madison88.com/api
Production: https://itsm.madison88.com/api
```

## Authentication

All API requests (except login) require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### JWT Token

- Access token expiry: 24 hours
- Refresh token expiry: 7 days
- All tokens are signed with RS256 algorithm

## Response Format

All responses follow a consistent format:

```json
{
  "status": "success|error",
  "message": "Optional message",
  "data": {},
  "errors": []
}
```

## HTTP Status Codes

- `200` - OK (successful GET, PATCH)
- `201` - Created (successful POST)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication Endpoints

### POST /auth/login

Authenticate user and receive JWT token.

**Request:**

```json
{
  "email": "user@madison88.com",
  "password": "password"
}
```

**Response (200):**

```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@madison88.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "it_agent",
      "location": "Philippines"
    }
  }
}
```

### POST /auth/logout

Logout user and invalidate token.

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "status": "success",
  "message": "Logout successful"
}
```

### POST /auth/refresh-token

Refresh JWT access token using refresh token.

**Request:**

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## Ticket Endpoints

### POST /tickets

Create a new ticket.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**

```json
{
  "category": "Hardware",
  "subcategory": "Laptop Issue",
  "title": "Laptop not turning on",
  "description": "My laptop won't start, shows black screen",
  "business_impact": "Unable to work, high impact",
  "location": "Philippines",
  "priority": "P2"
}
```

**Response (201):**

```json
{
  "status": "success",
  "message": "Ticket created successfully",
  "data": {
    "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
    "ticket_number": "TKT-2026-001",
    "status": "New",
    "priority": "P2",
    "sla_due_date": "2026-02-08T08:00:00Z"
  }
}
```

### GET /tickets

List all tickets with optional filters.

**Query Parameters:**

- `status` - Filter by status (New, In Progress, Pending, Resolved, Closed)
- `priority` - Filter by priority (P1, P2, P3, P4)
- `category` - Filter by category
- `assigned_to` - Filter by assigned agent ID
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)
- `sort_by` - Sort field (created_at, updated_at, priority)
- `sort_order` - asc or desc

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "tickets": [
      {
        "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
        "ticket_number": "TKT-2026-001",
        "title": "Laptop not turning on",
        "status": "In Progress",
        "priority": "P2",
        "category": "Hardware",
        "assigned_to": "550e8400-e29b-41d4-a716-446655440001",
        "sla_due_date": "2026-02-08T08:00:00Z",
        "created_at": "2026-02-07T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

### GET /tickets/:id

Get detailed information about a specific ticket.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "ticket": {
      "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
      "ticket_number": "TKT-2026-001",
      "title": "Laptop not turning on",
      "description": "My laptop won't start, shows black screen",
      "business_impact": "Unable to work, high impact",
      "status": "In Progress",
      "priority": "P2",
      "category": "Hardware",
      "location": "Philippines",
      "assigned_to": {
        "user_id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Jane Smith"
      },
      "assigned_team": {
        "team_id": "550e8400-e29b-41d4-a716-446655440002",
        "team_name": "Hardware Support"
      },
      "sla_due_date": "2026-02-08T08:00:00Z",
      "sla_breached": false,
      "created_at": "2026-02-07T10:00:00Z",
      "updated_at": "2026-02-07T14:30:00Z",
      "comments": [
        {
          "comment_id": "550e8400-e29b-41d4-a716-446655440003",
          "user_id": "550e8400-e29b-41d4-a716-446655440001",
          "user_name": "Jane Smith",
          "comment_text": "Checking the laptop hardware",
          "is_internal": false,
          "created_at": "2026-02-07T14:30:00Z"
        }
      ],
      "attachments": [
        {
          "attachment_id": "550e8400-e29b-41d4-a716-446655440004",
          "file_name": "laptop_issue.jpg",
          "file_size": 1024000,
          "uploaded_at": "2026-02-07T10:15:00Z"
        }
      ]
    }
  }
}
```

### PATCH /tickets/:id

Update a ticket.

**Request:**

```json
{
  "status": "Resolved",
  "priority": "P2",
  "resolution_notes": "Replaced hard drive"
}
```

**Response (200):**

```json
{
  "status": "success",
  "message": "Ticket updated successfully"
}
```

### POST /tickets/:id/comments

Add a comment to a ticket.

**Request:**

```json
{
  "comment_text": "Customer confirmed issue resolved",
  "is_internal": false
}
```

**Response (201):**

```json
{
  "status": "success",
  "message": "Comment added successfully"
}
```

### POST /tickets/:id/attachments

Upload an attachment to a ticket.

**Content-Type:** multipart/form-data

**Form Fields:**

- `file` - The file to upload (max 10MB, allowed types: pdf, png, jpg, xlsx, docx, msg)

**Response (201):**

```json
{
  "status": "success",
  "message": "Attachment uploaded successfully",
  "data": {
    "attachment_id": "550e8400-e29b-41d4-a716-446655440004",
    "file_name": "screenshot.png"
  }
}
```

### GET /tickets/:id/audit-log

Get audit trail for a ticket.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "audit_logs": [
      {
        "log_id": "550e8400-e29b-41d4-a716-446655440005",
        "action_type": "created",
        "user_name": "John Doe",
        "timestamp": "2026-02-07T10:00:00Z",
        "changes": {
          "status": { "old": null, "new": "New" }
        }
      },
      {
        "log_id": "550e8400-e29b-41d4-a716-446655440006",
        "action_type": "assigned",
        "user_name": "Admin User",
        "timestamp": "2026-02-07T10:15:00Z",
        "changes": {
          "assigned_to": { "old": null, "new": "Jane Smith" }
        }
      }
    ]
  }
}
```

---

## Dashboard Endpoints

### GET /dashboard/sla-performance

Get SLA performance metrics.

**Query Parameters:**

- `start_date` - ISO format date (default: 30 days ago)
- `end_date` - ISO format date (default: today)

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "sla_performance": {
      "P1": {
        "total": 10,
        "met": 9,
        "breached": 1,
        "compliance_percent": 90,
        "avg_resolution_hours": 3.5
      },
      "P2": {
        "total": 45,
        "met": 42,
        "breached": 3,
        "compliance_percent": 93.3,
        "avg_resolution_hours": 18.5
      }
    }
  }
}
```

### GET /dashboard/ticket-volume

Get ticket volume metrics.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "ticket_volume": {
      "by_status": {
        "New": 15,
        "In Progress": 42,
        "Pending": 8,
        "Resolved": 95,
        "Closed": 890
      },
      "by_category": {
        "Hardware": 250,
        "Software": 380,
        "Access Request": 150,
        "Network": 125
      },
      "by_priority": {
        "P1": 12,
        "P2": 68,
        "P3": 580,
        "P4": 245
      },
      "by_location": {
        "Philippines": 450,
        "US": 350,
        "Indonesia": 105
      }
    }
  }
}
```

### GET /dashboard/team-performance

Get team performance metrics.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "team_performance": {
      "teams": [
        {
          "team_id": "550e8400-e29b-41d4-a716-446655440002",
          "team_name": "Hardware Support",
          "tickets_assigned": 180,
          "tickets_closed": 165,
          "avg_resolution_hours": 24.5,
          "first_contact_resolution": 75,
          "agents": [
            {
              "user_id": "550e8400-e29b-41d4-a716-446655440001",
              "name": "Jane Smith",
              "open_tickets": 12,
              "avg_resolution_hours": 22
            }
          ]
        }
      ]
    }
  }
}
```

### GET /dashboard/aging-report

Get aging tickets report.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "aging_report": {
      "over_7_days": 28,
      "over_14_days": 12,
      "over_30_days": 3,
      "tickets": [
        {
          "ticket_number": "TKT-2026-001",
          "title": "Laptop not turning on",
          "days_open": 32,
          "status": "Pending",
          "assigned_to": "Jane Smith"
        }
      ]
    }
  }
}
```

### GET /dashboard/export

Export dashboard data as CSV or JSON.

**Query Parameters:**

- `format` - csv or json (default: json)
- `start_date` - ISO format date
- `end_date` - ISO format date
- `report_type` - sla, volume, team, aging (default: all)

**Response (200):** CSV or JSON file download

---

## Knowledge Base Endpoints

### GET /kb/articles

List knowledge base articles.

**Query Parameters:**

- `category` - Filter by category
- `status` - Filter by status (published, draft, archived)
- `page` - Page number
- `limit` - Items per page

### POST /kb/articles

Create a new KB article.

**Request:**

```json
{
  "title": "How to Reset Password",
  "content": "<p>Follow these steps...</p>",
  "category": "FAQ",
  "tags": ["password", "account"]
}
```

### GET /kb/search

Search knowledge base articles.

**Query Parameters:**

- `q` - Search query (required)
- `category` - Optional category filter
- `page` - Page number
- `limit` - Items per page

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "article_id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "How to Reset Password",
        "summary": "Steps to reset your IT password",
        "category": "FAQ",
        "relevance_score": 0.95
      }
    ]
  }
}
```

---

## Admin Endpoints

### GET /admin/users

List all users (Admin only).

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "users": [
      {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@madison88.com",
        "first_name": "John",
        "role": "it_agent",
        "location": "Philippines",
        "is_active": true
      }
    ]
  }
}
```

### GET /admin/sla-rules

Get SLA configuration rules.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "sla_rules": [
      {
        "sla_id": "550e8400-e29b-41d4-a716-446655440000",
        "priority": "P1",
        "response_time_hours": 1,
        "resolution_time_hours": 4,
        "escalation_threshold_percent": 80
      }
    ]
  }
}
```

### PATCH /admin/sla-rules/:id

Update SLA configuration.

**Request:**

```json
{
  "response_time_hours": 1,
  "resolution_time_hours": 4
}
```

### GET /admin/routing-rules

Get ticket routing rules.

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "routing_rules": [
      {
        "rule_id": "550e8400-e29b-41d4-a716-446655440000",
        "category": "Hardware",
        "assigned_team": "Hardware Support"
      }
    ]
  }
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "status": "error",
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

### Common Error Codes

- `401` - Unauthorized: Missing or invalid token
- `403` - Forbidden: Insufficient permissions
- `400` - Bad Request: Validation error
- `404` - Not Found: Resource doesn't exist
- `429` - Too Many Requests: Rate limit exceeded
- `500` - Internal Server Error

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- Standard endpoints: 100 requests per 15 minutes per IP
- Login endpoint: 5 requests per 15 minutes per IP
- File upload: 10 requests per 15 minutes per user

Rate limit headers are included in responses:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Pagination

List endpoints support pagination with the following parameters:

- `page` - Page number (default: 1, min: 1)
- `limit` - Items per page (default: 50, min: 1, max: 100)

Response includes pagination metadata:

```json
{
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "pages": 10
  }
}
```

---

## Webhooks

The API supports webhooks for real-time events. Configure webhook URLs in the admin panel.

**Supported Events:**

- `ticket.created`
- `ticket.updated`
- `ticket.assigned`
- `ticket.resolved`
- `ticket.closed`
- `comment.added`

**Webhook Payload:**

```json
{
  "event": "ticket.created",
  "timestamp": "2026-02-07T10:00:00Z",
  "data": {
    "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
    "ticket_number": "TKT-2026-001"
  }
}
```

---

## Implementation Roadmap

- [x] API structure setup
- [ ] Complete authentication implementation
- [ ] Complete ticket CRUD operations
- [ ] Implement auto-classification
- [ ] Implement SLA tracking
- [ ] Implement ticket routing
- [ ] Add knowledge base functionality
- [ ] Add admin endpoints
- [ ] Add real-time notifications
- [ ] Add webhook support
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Load testing
- [ ] Production deployment
