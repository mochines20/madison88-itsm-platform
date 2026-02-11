# ITSM System Logic Review

Double-check of end-to-end logic across ticket creation, listing, status transitions, archiving, and pagination. **Two bugs were found and fixed** (see below).

---

## 1. Ticket creation

| Step | Logic | Status |
|------|--------|--------|
| Role | Only `end_user` can create (route + service). | OK |
| Validation | Joi: title (5–255), description (min 10), business_impact (min 10), category, location required; priority optional. | OK |
| Duplicate check | Same user + similar title/description in last 24h → 409 unless `confirm_duplicate: true`. | OK |
| Classification | Keyword + classification rules → priority fallback (P4 default). | OK |
| SLA | `buildSla(priority)` uses rule or default hours; ticket always gets SLA dates. | OK |
| Routing | Category/subcategory/location → routing rule → `assigned_team`; then `getLeastLoadedAgent(team)` → `assigned_to`. | OK |
| Audit | Created + routed logged with ip/user_agent/session. | OK |

---

## 2. Ticket listing (active queue)

| Area | Logic | Status |
|------|--------|--------|
| **Active vs archived** | When `include_archived !== 'true'`: `exclude_archived = true` → model adds `(is_archived IS NULL OR is_archived = false)` and `status NOT IN ('Resolved','Closed')`. So default “My Tickets” shows only New / In Progress / Pending / Reopened. | OK |
| **Explicit Resolved/Closed** | If user selects status = Resolved or Closed, we no longer set `exclude_archived` so they can see those tickets. | **Fixed** |
| **Ordering** | 1) Escalated (escalation row OR ≥80% SLA elapsed), 2) P1→P2→P3→P4, 3) SLA breached, 4) `created_at` DESC. | OK |
| **Pagination** | `page` + `limit` (frontend uses 5); COUNT for total; OFFSET/LIMIT for page. No duplicate across pages. | OK |
| **Roles** | end_user: `user_id`; it_agent: `assigned_to`; it_manager: teamIds/memberIds or unassigned; system_admin: no scope. | OK |

---

## 3. Status transitions and archiving

| Transition | Logic | Status |
|------------|--------|--------|
| **→ Resolved** | Requires resolution_summary, resolution_category, root_cause; set resolved_at/resolved_by; set `is_archived = true`, `archived_at = now`. | OK |
| **→ Closed** | Same resolution fields; set closed_at/closed_by; set `is_archived = true`, `archived_at = now`. | OK |
| **→ Reopened** | Increment reopened_count; **set `is_archived = false`, `archived_at = null`** so ticket returns to active queue. | **Fixed** |

---

## 4. Frontend ticket list

| Area | Logic | Status |
|------|--------|--------|
| Params | Sends page, limit=5, filters; `include_archived` only when “Show archived” checked. | OK |
| Page reset | Changing any filter or view mode sets page to 1. | OK |
| Empty page | If current page has 0 tickets but total > 0 (e.g. after resolves), reset to page 1. | OK |
| Buttons | “Previous 5” / “Next 5” disabled while `loading`; hasPrev/hasNext from total and page size. | OK |

---

## 5. Bugs fixed in this review

1. **Reopened not returning to active queue**  
   Tickets that were Resolved (hence `is_archived = true`) and then Reopened stayed excluded because we still required `(is_archived IS NULL OR is_archived = false)`.  
   **Fix:** On status change to Reopened, set `is_archived = false` and `archived_at = null`.

2. **Status filter Resolved/Closed with “Show archived” off**  
   With `exclude_archived = true` we also added `status NOT IN ('Resolved','Closed')`, so selecting status = “Resolved” or “Closed” made the query impossible (0 results).  
   **Fix:** Only set `exclude_archived = true` when the requested status is not Resolved or Closed. So selecting “Resolved” or “Closed” shows those tickets even if “Show archived” is unchecked.

---

## 6. Consistency checks

- **Single source of “active”:** Backend defines active as non-archived and status not Resolved/Closed; frontend only sends `include_archived`. Consistent.
- **Ordering:** Same ORDER BY for all roles and views; frontend does not re-sort. Consistent.
- **Resolved/Closed:** Always archived on transition; Reopened always unarchived. Consistent.

---

## 7. Edge cases confirmed

- No duplicates across pages: single ordered query with OFFSET/LIMIT.
- Empty state: “No tickets yet” when list is empty.
- Pagination buttons disabled while loading.
- Total and page count use same WHERE clause as the data query.

---

*Last updated: logic review and two fixes applied.*
