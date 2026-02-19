-- Migration: Global Location-Based Auto-Routing
-- Date: 2026-02-19

-- 1. Expand LOCATION check constraint in USERS table
-- Note: PostgreSQL doesn't easily allow "editing" a CHECK constraint. We drop and recreate.
ALTER TABLE USERS DROP CONSTRAINT IF EXISTS users_location_check;
ALTER TABLE USERS ADD CONSTRAINT users_location_check 
    CHECK (LOCATION IN ('Philippines', 'US', 'Indonesia', 'China', 'Other'));

-- 2. Expand LOCATION check constraint in TICKETS table
ALTER TABLE TICKETS DROP CONSTRAINT IF EXISTS tickets_location_check;
ALTER TABLE TICKETS ADD CONSTRAINT tickets_location_check 
    CHECK (LOCATION IN ('Philippines', 'US', 'Indonesia', 'China', 'Other'));

-- 3. Create Global IT Teams
INSERT INTO TEAMS (TEAM_NAME, DESCRIPTION, LOCATION, CATEGORY_ASSIGNED) VALUES
('PH IT Support', 'Local IT support for Philippines office', 'Philippines', 'Other'),
('US IT Support', 'Local IT support for US office', 'US', 'Other'),
('ID IT Support', 'Local IT support for Indonesia office', 'Indonesia', 'Other'),
('CN IT Support', 'Local IT support for China office', 'China', 'Other')
ON CONFLICT (TEAM_NAME) DO NOTHING;

-- 4. Seed Default Routing Rules for Locations
-- We assign team IDs dynamically based on names
DO $$
DECLARE
    team_id_ph UUID;
    team_id_us UUID;
    team_id_id UUID;
    team_id_cn UUID;
BEGIN
    SELECT TEAM_ID INTO team_id_ph FROM TEAMS WHERE TEAM_NAME = 'PH IT Support';
    SELECT TEAM_ID INTO team_id_us FROM TEAMS WHERE TEAM_NAME = 'US IT Support';
    SELECT TEAM_ID INTO team_id_id FROM TEAMS WHERE TEAM_NAME = 'ID IT Support';
    SELECT TEAM_ID INTO team_id_cn FROM TEAMS WHERE TEAM_NAME = 'CN IT Support';

    -- Generic Hardware routing by location
    INSERT INTO ROUTING_RULES (CATEGORY, LOCATION, ASSIGNED_TEAM, ORDER_PRIORITY) VALUES
    ('Hardware', 'Philippines', team_id_ph, 1),
    ('Hardware', 'US', team_id_us, 1),
    ('Hardware', 'Indonesia', team_id_id, 1),
    ('Hardware', 'China', team_id_cn, 1),
    ('Software', 'Philippines', team_id_ph, 1),
    ('Software', 'US', team_id_us, 1),
    ('Software', 'Indonesia', team_id_id, 1),
    ('Software', 'China', team_id_cn, 1)
    ON CONFLICT (CATEGORY, SUBCATEGORY, LOCATION) DO NOTHING;
END $$;
