-- Madison88 ITSM Platform - Database Schema
-- PostgreSQL 12+

-- ============================================
-- CORE TABLES
-- ============================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('end_user', 'it_agent', 'it_manager', 'system_admin')),
    department VARCHAR(100),
    location VARCHAR(50) CHECK (location IN ('Philippines', 'US', 'Indonesia', 'Other')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
    team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    team_lead_id UUID REFERENCES users(user_id),
    location VARCHAR(50),
    category_assigned VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team Members Association
CREATE TABLE IF NOT EXISTS team_members (
    member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('member', 'lead')),
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    category VARCHAR(100) NOT NULL CHECK (category IN ('Hardware', 'Software', 'Access Request', 'Account Creation', 'Network', 'Other')),
    subcategory VARCHAR(100),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    business_impact TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Reopened')),
    location VARCHAR(50) CHECK (location IN ('Philippines', 'US', 'Indonesia', 'Other')),
    assigned_to UUID REFERENCES users(user_id),
    assigned_team UUID REFERENCES teams(team_id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    assigned_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    sla_due_date TIMESTAMP WITH TIME ZONE,
    sla_response_due TIMESTAMP WITH TIME ZONE,
    sla_breached BOOLEAN DEFAULT false,
    sla_response_breached BOOLEAN DEFAULT false,
    priority_override_reason TEXT,
    overridden_by UUID REFERENCES users(user_id),
    overridden_at TIMESTAMP WITH TIME ZONE,
    reopened_count INTEGER DEFAULT 0,
    parent_ticket_id UUID REFERENCES tickets(ticket_id),
    tags VARCHAR(255),
    currency VARCHAR(3) DEFAULT 'USD',
    estimated_cost DECIMAL(12, 2),
    actual_cost DECIMAL(12, 2)
);

-- Ticket Comments Table
CREATE TABLE IF NOT EXISTS ticket_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    edited_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Attachments Table
CREATE TABLE IF NOT EXISTS ticket_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50),
    uploaded_by UUID NOT NULL REFERENCES users(user_id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false
);

-- ============================================
-- AUDIT & LOGGING TABLES
-- ============================================

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(ticket_id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255)
);

-- ============================================
-- SLA & CONFIGURATION TABLES
-- ============================================

-- SLA Rules Table
CREATE TABLE IF NOT EXISTS sla_rules (
    sla_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priority VARCHAR(10) NOT NULL UNIQUE CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    response_time_hours INTEGER NOT NULL,
    resolution_time_hours INTEGER NOT NULL,
    escalation_threshold_percent INTEGER DEFAULT 80,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SLA History Table (for tracking SLA changes per ticket)
CREATE TABLE IF NOT EXISTS sla_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    sla_id UUID NOT NULL REFERENCES sla_rules(sla_id),
    response_due TIMESTAMP WITH TIME ZONE,
    resolution_due TIMESTAMP WITH TIME ZONE,
    response_met BOOLEAN,
    resolution_met BOOLEAN,
    escalated_at TIMESTAMP WITH TIME ZONE,
    breached_at TIMESTAMP WITH TIME ZONE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Routing Rules Table
CREATE TABLE IF NOT EXISTS routing_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    assigned_team UUID NOT NULL REFERENCES teams(team_id),
    priority_override VARCHAR(10),
    location VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    order_priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, subcategory, location)
);

-- Auto-Classification Rules Table
CREATE TABLE IF NOT EXISTS classification_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    keywords TEXT[] NOT NULL,
    matching_type VARCHAR(20) DEFAULT 'any' CHECK (matching_type IN ('any', 'all')),
    assigned_priority VARCHAR(10) NOT NULL CHECK (assigned_priority IN ('P1', 'P2', 'P3', 'P4')),
    assigned_category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    order_priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- KNOWLEDGE BASE TABLES
-- ============================================

-- Knowledge Base Articles Table
CREATE TABLE IF NOT EXISTS knowledge_base_articles (
    article_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    summary TEXT,
    category VARCHAR(100) NOT NULL,
    tags VARCHAR(255),
    author_id UUID NOT NULL REFERENCES users(user_id),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    views INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    unhelpful_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- KB Article Versions Table
CREATE TABLE IF NOT EXISTS kb_article_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES knowledge_base_articles(article_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(user_id),
    change_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, version_number)
);

-- KB Article Feedback Table
CREATE TABLE IF NOT EXISTS kb_article_feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES knowledge_base_articles(article_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    feedback_type VARCHAR(50) CHECK (feedback_type IN ('helpful', 'unhelpful')),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CHANGE MANAGEMENT TABLES
-- ============================================

-- Change Requests Table
CREATE TABLE IF NOT EXISTS change_requests (
    change_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_number VARCHAR(20) NOT NULL UNIQUE,
    ticket_id UUID REFERENCES tickets(ticket_id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    change_type VARCHAR(50) CHECK (change_type IN ('standard', 'normal', 'emergency')),
    affected_systems VARCHAR(500),
    implementation_plan TEXT,
    rollback_plan TEXT,
    risk_assessment VARCHAR(50) CHECK (risk_assessment IN ('low', 'medium', 'high', 'critical')),
    change_window_start TIMESTAMP WITH TIME ZONE,
    change_window_end TIMESTAMP WITH TIME ZONE,
    requested_by UUID NOT NULL REFERENCES users(user_id),
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'submitted', 'approved', 'scheduled', 'implemented', 'closed', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    implemented_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Change Approvers Table
CREATE TABLE IF NOT EXISTS change_approvers (
    approver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_id UUID NOT NULL REFERENCES change_requests(change_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_comment TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(change_id, user_id)
);

-- ============================================
-- SERVICE REQUEST TABLES
-- ============================================

-- Service Requests Table
CREATE TABLE IF NOT EXISTS service_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(20) NOT NULL UNIQUE,
    ticket_id UUID NOT NULL REFERENCES tickets(ticket_id),
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('access_request', 'account_creation', 'hardware_request', 'software_request')),
    details JSONB,
    requested_by UUID NOT NULL REFERENCES users(user_id),
    approver_id UUID REFERENCES users(user_id),
    status VARCHAR(50) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'fulfilled', 'completed')),
    approval_comment TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ASSET TRACKING TABLES
-- ============================================

-- IT Assets Table
CREATE TABLE IF NOT EXISTS it_assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag VARCHAR(50) NOT NULL UNIQUE,
    serial_number VARCHAR(100),
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('laptop', 'desktop', 'monitor', 'printer', 'phone', 'tablet', 'server', 'network_device', 'other')),
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    assigned_user_id UUID REFERENCES users(user_id),
    location VARCHAR(100),
    purchase_date DATE,
    warranty_expiration DATE,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    cost DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired', 'for_repair')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Asset Ticket Association
CREATE TABLE IF NOT EXISTS asset_tickets (
    association_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES it_assets(asset_id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    associated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, ticket_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- User Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Team Indexes
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- Ticket Indexes
CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_assigned_team ON tickets(assigned_team);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_category ON tickets(category);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_sla_due_date ON tickets(sla_due_date);
CREATE INDEX idx_tickets_sla_breached ON tickets(sla_breached);

-- Ticket Comments Indexes
CREATE INDEX idx_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX idx_comments_user_id ON ticket_comments(user_id);

-- Audit Log Indexes
CREATE INDEX idx_audit_ticket_id ON audit_logs(ticket_id);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_action_type ON audit_logs(action_type);

-- KB Indexes
CREATE INDEX idx_kb_articles_category ON knowledge_base_articles(category);
CREATE INDEX idx_kb_articles_status ON knowledge_base_articles(status);
CREATE INDEX idx_kb_articles_author_id ON knowledge_base_articles(author_id);

-- Change Request Indexes
CREATE INDEX idx_change_requests_status ON change_requests(status);
CREATE INDEX idx_change_requests_ticket_id ON change_requests(ticket_id);

-- Service Request Indexes
CREATE INDEX idx_service_requests_ticket_id ON service_requests(ticket_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);

-- Asset Indexes
CREATE INDEX idx_assets_asset_tag ON it_assets(asset_tag);
CREATE INDEX idx_assets_assigned_user ON it_assets(assigned_user_id);
CREATE INDEX idx_assets_status ON it_assets(status);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- SLA Performance View
CREATE OR REPLACE VIEW sla_performance_summary AS
SELECT 
    t.priority,
    COUNT(*) as total_tickets,
    SUM(CASE WHEN t.sla_breached = false THEN 1 ELSE 0 END) as sla_met,
    SUM(CASE WHEN t.sla_breached = true THEN 1 ELSE 0 END) as sla_breached,
    ROUND(100.0 * SUM(CASE WHEN t.sla_breached = false THEN 1 ELSE 0 END) / COUNT(*), 2) as sla_compliance_percent,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) as avg_resolution_hours
FROM tickets t
WHERE t.status IN ('Resolved', 'Closed')
GROUP BY t.priority
ORDER BY CASE WHEN t.priority = 'P1' THEN 1 WHEN t.priority = 'P2' THEN 2 WHEN t.priority = 'P3' THEN 3 ELSE 4 END;

-- Team Performance View
CREATE OR REPLACE VIEW team_performance_summary AS
SELECT 
    tm.team_id,
    t.team_name,
    COUNT(tk.ticket_id) as tickets_assigned,
    SUM(CASE WHEN tk.status = 'Closed' THEN 1 ELSE 0 END) as tickets_closed,
    AVG(EXTRACT(EPOCH FROM (tk.resolved_at - tk.created_at)) / 3600) as avg_resolution_hours,
    SUM(CASE WHEN tk.sla_breached = false THEN 1 ELSE 0 END) as sla_met
FROM teams t
LEFT JOIN team_members tm ON t.team_id = tm.team_id
LEFT JOIN tickets tk ON tm.user_id = tk.assigned_to
GROUP BY tm.team_id, t.team_id, t.team_name;

-- Aging Tickets View
CREATE OR REPLACE VIEW aging_tickets AS
SELECT 
    ticket_id,
    ticket_number,
    title,
    priority,
    status,
    created_at,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - created_at) as days_open,
    assigned_to,
    sla_due_date,
    CASE 
        WHEN EXTRACT(DAY FROM CURRENT_TIMESTAMP - created_at) > 30 THEN 'over_30_days'
        WHEN EXTRACT(DAY FROM CURRENT_TIMESTAMP - created_at) > 14 THEN 'over_14_days'
        WHEN EXTRACT(DAY FROM CURRENT_TIMESTAMP - created_at) > 7 THEN 'over_7_days'
        ELSE 'normal'
    END as age_category
FROM tickets
WHERE status NOT IN ('Resolved', 'Closed')
ORDER BY created_at ASC;

-- ============================================
-- INITIAL DATA (SLA Rules)
-- ============================================

INSERT INTO sla_rules (priority, response_time_hours, resolution_time_hours, is_active)
VALUES 
    ('P1', 1, 4, true),
    ('P2', 4, 24, true),
    ('P3', 8, 72, true),
    ('P4', 24, 120, true)
ON CONFLICT (priority) DO NOTHING;
