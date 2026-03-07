# Collaborative Lists Architecture

## Data Model

```
users (Supabase Auth)
  ↓
  lists (owned_by user)
    ├─ list_members (many users can access one list)
    │   ├─ Role: 'admin' (can manage members + edit villas)
    │   ├─ Role: 'editor' (can edit villas)
    │   └─ Role: 'viewer' (can view villas only)
    │
    ├─ villas (list contains many villas)
    │   └─ user_id (who scouted/added it)
    │
    └─ invite_tokens (shareable links to invite people)
        ├─ Token (URL-safe string)
        ├─ Role (what role new member gets)
        ├─ Expires at
        └─ Max uses (optional limit)
```

## Permissions Model

### List Creator (Admin)
- ✅ View list
- ✅ Edit list name/description
- ✅ Delete list
- ✅ Add/remove members
- ✅ Change member roles
- ✅ Add/edit/delete villas
- ✅ Create invite links

### List Admin (Member with admin role)
- ✅ View list
- ✅ Add/remove members
- ✅ Change member roles
- ✅ Add/edit/delete villas
- ✅ Create invite links
- ❌ Delete list
- ❌ Edit list name/description

### List Editor (Member with editor role)
- ✅ View list
- ✅ Add/edit/delete villas
- ✅ View members
- ❌ Manage members
- ❌ Delete list

### List Viewer (Member with viewer role)
- ✅ View list
- ✅ View villas
- ✅ View members
- ❌ Edit villas
- ❌ Manage members

## Invite Flow

```
1. Admin creates invite link
   ↓
   create_invite_token(
     list_id="abc123",
     role="editor",
     expires_in_days=30,
     max_uses=5
   )
   ↓
   Returns: {token: "xyz_secret_token", expires_at: "...", uses: 0}

2. Admin shares URL with others
   ↓
   https://myapp.com/join/xyz_secret_token

3. New user clicks link
   ↓
   Frontend fetches token details: get_invite_token("xyz_secret_token")
   ↓
   Shows list name and role they'll get

4. New user accepts
   ↓
   accept_invite("xyz_secret_token", current_user_id)
   ↓
   Adds them to list with specified role
   ↓
   Increments uses counter

5. They now see list in their dashboard
   ↓
   get_user_lists() returns lists they own + member of
```

## Row Level Security (RLS)

### Lists Table
```sql
SELECT: auth.uid() = user_id OR user is in list_members
INSERT: auth.uid() = user_id (only creator)
UPDATE: auth.uid() = user_id (only creator)
DELETE: auth.uid() = user_id (only creator)
```

### List Members Table
```sql
SELECT: user has access to the list
INSERT: only list creator/admin
UPDATE: only list creator/admin
DELETE: only list creator/admin
```

### Villas Table
```sql
SELECT: user has access to parent list
INSERT: user has access + (admin OR editor role)
UPDATE: user has access + (admin OR editor role)
DELETE: user has access + admin role
```

### Invite Tokens Table
```sql
SELECT: user is list creator
INSERT: user is list creator
UPDATE: user is list creator
DELETE: user is list creator
```

## Backend Changes Needed

### Scout Endpoint
```python
@app.post("/api/scout")
async def scout_listing(req: ScoutRequest):
    # req.list_id (which list to save to)
    # req.user_id (who's scouting)
    # Verify user has access to list
    # Save villa to list
```

### New Endpoints
```python
# Lists
POST   /api/lists              - Create list
GET    /api/lists              - Get user's lists
GET    /api/lists/{id}         - Get specific list
PUT    /api/lists/{id}         - Update list
DELETE /api/lists/{id}         - Delete list

# List Members
GET    /api/lists/{id}/members          - Get members
POST   /api/lists/{id}/members          - Add member
PUT    /api/lists/{id}/members/{uid}    - Change role
DELETE /api/lists/{id}/members/{uid}    - Remove member

# Invites
POST   /api/lists/{id}/invites           - Create invite
GET    /api/invites/{token}              - Get invite details
POST   /api/invites/{token}/accept       - Accept invite
GET    /api/lists/{id}/invites           - List invite tokens
DELETE /api/invites/{token}              - Revoke invite

# Villas
GET    /api/lists/{id}/villas            - Get villas in list
PUT    /api/lists/{id}/villas/{slug}     - Update villa
DELETE /api/lists/{id}/villas/{slug}     - Delete villa
```

## Frontend Components

### New Pages
- `/dashboard` - Show user's lists
- `/lists/[id]` - View list with villas
- `/join/[token]` - Accept invite

### New Components
- `ListGrid` - Show user's lists
- `ListMembers` - Manage members
- `ListSettings` - Edit name/description
- `InviteForm` - Create invite link
- `InviteShare` - Share link + manage tokens

### Updated Components
- `VillaTable` - Add list context
- `DropZone` - Include list_id in request
- `VillaRow` - Show editor/viewer restrictions

## Migration Path

### Option 1: Keep Single-User Mode First
- Use default list created at signup
- All villas go to default list
- No member management initially
- Easier rollout

### Option 2: Full Multi-User Rollout
- Create lists as main feature
- Require users to create/join lists
- Full invite system from day 1
- More complex but feature-complete

## Database Queries Example

### Get user's lists with villa counts
```python
response = supabase_client.table("lists").select(
    """
    *,
    list_members(user_id, role),
    villas(count)
    """
).execute()
```

### Get specific list with all data
```python
response = supabase_client.table("lists").select(
    """
    *,
    list_members(id, user_id, role, auth.users(email)),
    villas(*)
    """
).eq("id", list_id).single().execute()
```

### Get user's accessible villas across all lists
```python
response = supabase_client.table("villas").select(
    """
    *,
    lists(id, name, user_id)
    """
).order("created_at", desc=True).execute()
```

## Code Structure

### New Files
- `db_lists.py` - All list/member/invite functions
- `SCHEMA_V2_LISTS.sql` - Database schema with RLS
- `models_lists.py` - Pydantic models for API
- `routes_lists.py` - FastAPI endpoints

### Updated Files
- `scout.py` - Add `list_id` parameter
- `app.py` - Add list endpoints
- `utils/persistence.py` - Use new db_lists functions

## Security

✅ RLS enforces all permissions at database level
✅ Users cannot access lists they don't have access to
✅ Editors cannot delete villas (only admins)
✅ Viewers cannot edit villas
✅ Invite tokens have expiry + usage limits
✅ All operations checked against list membership

## Next Steps

1. Choose migration path (single-user → multi-user or full rollout)
2. Run SQL schema v2
3. Update backend with new endpoints
4. Update frontend to show lists
5. Test invite flow end-to-end

Ready to implement?
