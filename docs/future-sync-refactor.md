# Future Synchronized Refactor — Backend + Frontend

These changes were identified during the 2026-03-25 backend refactor but **not implemented** because they require coordinated frontend changes. Each item lists the backend change, the frontend files affected, and what needs to change on each side.

---

## 1. URL Parameter Naming: `taskId` → `task_id`

**Why:** Django convention is `snake_case` for URL params. Current `camelCase` is inconsistent.

**Backend:**
- `comrade_core/urls.py` — rename all `<int:taskId>` to `<int:task_id>`, `<int:partId>` to `<int:part_id>`
- All view method signatures — rename `taskId` → `task_id`, `partId` → `part_id`

**Frontend:**
- `client/src/api.ts` — no change needed (URLs are string-interpolated, parameter names are internal to Django)
- Actually no frontend change needed — URL paths stay the same, only the Django-internal capture group name changes. **This is backend-only safe to do.** Reclassified: can be done in backend refactor Phase 3.

---

## 2. Explicit Serializer Fields (replace `fields = "__all__"`)

**Why:** `__all__` exposes every model field, including internal state that may change. Explicit fields are safer and serve as documentation.

**Backend (`comrade_core/serializers.py`):**
- `TaskSerializer.Meta.fields` — replace `"__all__"` with explicit list

**Frontend (`client/src/api.ts`):**
- `Task` TypeScript interface — audit against the explicit field list. Remove any fields that are dropped. This is the main risk: if a field the frontend uses gets omitted from the explicit list, it breaks.

**Migration strategy:**
1. First, set explicit fields to exactly what `__all__` currently produces (no behavior change)
2. Then, in a second pass, audit which fields the frontend actually uses and remove unused ones

---

## 3. Pagination on List Endpoints

**Why:** `GET /api/tasks/`, `GET /api/achievements/`, `GET /api/chat/history/` return unbounded results.

**Backend:**
- Add DRF pagination classes
- Response shape changes from `{"tasks": [...]}` to `{"count": N, "next": "url", "results": [...]}`

**Frontend (`client/src/api.ts` + components):**
- Update response type to handle paginated shape
- Add "load more" or infinite scroll where needed
- `TasksSidebar.tsx`, `AchievementsPanel.tsx`, `Chat.tsx` — handle pagination

---

## 4. Standardized Error Response Format

**Why:** Current error responses are inconsistent: `{"error": "string"}`, `{"error": ["list"]}`, `{"status": "string"}`.

**Backend:**
- All error responses → `{"error": {"code": "TASK_NOT_FOUND", "message": "Human-readable message"}}`
- All success responses → `{"data": {...}}` or `{"data": [...]}`

**Frontend:**
- `client/src/api.ts` — update error handling to parse new format
- All components that read `.error` from responses — update field access
- Likely affected: `MapView.tsx`, `ActiveTaskPanel.tsx`, `CreateTaskModal.tsx`, `TutorialPanel.tsx`, `ReviewModal.tsx`

---

## 5. WebSocket Event Field Naming

**Why:** Mixed conventions. Some events use `camelCase` (`userId`, `firstName`), matching JS convention. Others use `snake_case`. Should pick one and be consistent.

**Backend (`comrade_core/consumers.py`, `comrade_core/ws_events.py`):**
- Standardize all event fields to `camelCase` (since the consumer is JS/frontend)
- Or standardize to `snake_case` (Django convention) and let frontend transform

**Frontend (`client/src/hooks/useLocationSocket.ts`):**
- Update all event field access to match chosen convention

**Recommendation:** Keep `camelCase` for WebSocket events since the primary consumer is JavaScript. Just make it consistent — audit all events and fix the few that mix conventions.

---

## 6. Task Create Input Validation

**Why:** `TaskCreateView` passes raw request data to model fields with minimal validation. No structured error responses for invalid input.

**Backend:**
- Create a proper `TaskCreateSerializer` with field-level validation
- Return structured validation errors: `{"error": {"code": "VALIDATION_ERROR", "fields": {"name": ["Required"], "lat": ["Must be between -90 and 90"]}}}`

**Frontend (`client/src/components/CreateTaskModal.tsx`):**
- Update to display per-field validation errors from the new response format
- Currently only shows generic error messages

---

## Priority Order

If tackling these, recommended order:
1. **#2 (Explicit serializer fields)** — lowest risk, biggest safety improvement
2. **#5 (WebSocket naming)** — small scope, consistency win
3. **#6 (Task create validation)** — user-facing quality improvement
4. **#4 (Error format)** — larger scope but high value
5. **#3 (Pagination)** — only matters at scale, low priority for MVP
