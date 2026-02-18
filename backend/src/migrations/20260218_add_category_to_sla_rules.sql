-- Migration: Add Category to SLA Rules
-- Date: 2026-02-18

-- 1. Add category column
ALTER TABLE sla_rules ADD COLUMN category VARCHAR(50);

-- 2. Drop existing priority-only unique constraint
-- The constraint name was 'sla_rules_priority_key' as seen in revert_franchise.sql
ALTER TABLE sla_rules DROP CONSTRAINT IF EXISTS sla_rules_priority_key;

-- 3. Add new unique constraint on (priority, category)
-- This allows one rule per priority, or one rule per (priority, category) pair.
-- Note: PostgreSQL treats multiple NULLs as distinct, but for our logic, 
-- we only want ONE generic rule per priority. 
-- However, standard unique index on (priority, category) allows multiple (P1, NULL).
-- We can use a partial index or just let the application handle the 'one NULL per priority' logic,
-- but a unique index with COALESCE is better:
CREATE UNIQUE INDEX idx_sla_rules_priority_category_unique 
ON sla_rules (priority, COALESCE(category, 'GLOBAL_DEFAULT'));

-- 4. Add some sample specific rules for demonstration
INSERT INTO sla_rules (priority, category, response_time_hours, resolution_time_hours, escalation_threshold_percent)
VALUES 
('P1', 'Software', 1, 4, 80),
('P1', 'Hardware', 2, 8, 90)
ON CONFLICT DO NOTHING;
