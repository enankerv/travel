# FastAPI Endpoints Documentation

## Base URL
```
http://localhost:8000/api
```

## Authentication
All endpoints that require user context should include the user ID as a query parameter:
```
?user_id=<uuid>
```

Frontend will extract this from Supabase Auth session.

---

## LIST MANAGEMENT

### Create List
```
POST /api/lists?user_id=<uuid>

Request:
{
  "name": "Italy Trip 2024",
  "description": "Villas for family trip"
}

Response:
{
  "id": "list-uuid",
  "user_id": "creator-uuid",
  "name": "Italy Trip 2024",
  "description": "Villas for family trip",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "list_members": []
}
```

### Get User's Lists
```
GET /api/lists?user_id=<uuid>

Response:
[
  {
    "id": "list-uuid",
    "user_id": "creator-uuid",
    "name": "Italy Trip 2024",
    "description": "...",
    "created_at": "...",
    "updated_at": "...",
    "list_members": [
      {
        "user_id": "member-uuid",
        "role": "editor",
        "joined_at": "..."
      }
    ]
  }
]
```

### Get Specific List
```
GET /api/lists/{list_id}

Response:
{
  "id": "list-uuid",
  "user_id": "creator-uuid",
  "name": "Italy Trip 2024",
  "description": "...",
  "created_at": "...",
  "updated_at": "...",
  "list_members": [...]
}
```

### Update List
```
PUT /api/lists/{list_id}

Request:
{
  "name": "Italy Trip 2025",
  "description": "Updated description"
}

Response:
{
  "id": "list-uuid",
  "name": "Italy Trip 2025",
  "description": "Updated description",
  ...
}
```

### Delete List
```
DELETE /api/lists/{list_id}

Response:
{
  "ok": true
}
```

---

## LIST MEMBER MANAGEMENT

### Get List Members
```
GET /api/lists/{list_id}/members

Response:
{
  "members": [
    {
      "id": "member-id",
      "list_id": "list-uuid",
      "user_id": "member-uuid",
      "role": "editor",
      "invited_by": "inviter-uuid",
      "joined_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Add Member to List
```
POST /api/lists/{list_id}/members?invited_by=<uuid>

Request:
{
  "user_id": "new-member-uuid",
  "role": "editor"  # or "viewer", "admin"
}

Response:
{
  "ok": true,
  "member": { ... }
}
```

### Update Member Role
```
PUT /api/lists/{list_id}/members/{user_id}

Request:
{
  "role": "viewer"
}

Response:
{
  "ok": true,
  "role": "viewer"
}
```

### Remove Member
```
DELETE /api/lists/{list_id}/members/{user_id}

Response:
{
  "ok": true
}
```

---

## INVITE TOKENS (Shareable Links)

### Create Invite Token
```
POST /api/lists/{list_id}/invites?created_by=<uuid>

Request:
{
  "role": "editor",           # "editor" or "viewer"
  "expires_in_days": 30,
  "max_uses": 5              # optional
}

Response:
{
  "token": "xyz_secret_token_string",
  "list_id": "list-uuid",
  "role": "editor",
  "expires_at": "2024-02-14T10:30:00Z",
  "max_uses": 5,
  "uses_count": 0,
  "is_active": true
}
```

Share URL: `https://yourapp.com/join/xyz_secret_token_string`

### Get Invite Details (for accepting)
```
GET /api/invites/{token}

Response:
{
  "token": "xyz_secret_token_string",
  "role": "editor",
  "list_id": "list-uuid",
  "list_name": "Italy Trip 2024",
  "expires_at": "2024-02-14T10:30:00Z",
  "uses_count": 1,
  "max_uses": 5
}
```

### Accept Invite
```
POST /api/invites/{token}/accept?user_id=<uuid>

Response:
{
  "ok": true,
  "message": "Successfully joined list"
}
```

### List Invite Tokens (for admin)
```
GET /api/lists/{list_id}/invites

Response:
{
  "invites": [
    {
      "token": "xyz_secret_token_string",
      "list_id": "list-uuid",
      "role": "editor",
      "expires_at": "2024-02-14T10:30:00Z",
      "max_uses": 5,
      "uses_count": 1,
      "is_active": true
    }
  ]
}
```

### Revoke Invite
```
DELETE /api/invites/{token}

Response:
{
  "ok": true
}
```

---

## VILLA MANAGEMENT

### Get Villas in List
```
GET /api/lists/{list_id}/villas

Response:
[
  {
    "id": "villa-uuid",
    "list_id": "list-uuid",
    "user_id": "scout-uuid",
    "slug": "villa-1",
    "title": "Beautiful Tuscan Villa",
    "villa_name": "Villa Magnifico",
    "location": "Tuscany",
    "region": "Italy",
    "bedrooms": 4,
    "bathrooms": 3,
    "max_guests": 8,
    "price_weekly_usd": 2500,
    "pool_features": ["heated pool"],
    "amenities": ["wifi", "ac"],
    "images": ["/images/villa-1/00.jpg"],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

### Update Villa
```
PUT /api/lists/{list_id}/villas/{villa_slug}

Request:
{
  "price_weekly_usd": 3000,
  "location": "Tuscany - Updated",
  "bedrooms": 5
}

Response:
{
  "ok": true,
  "villa": { ... }
}
```

### Delete Villa
```
DELETE /api/lists/{list_id}/villas/{villa_slug}

Response:
{
  "ok": true
}
```

---

## SCOUTING ENDPOINTS

### Scout URL
```
POST /api/scout

Request:
{
  "url": "https://airbnb.com/rooms/123456",
  "list_id": "list-uuid",
  "check_in": "2024-06-01",
  "check_out": "2024-06-07",
  "guests": 6
}

Response:
{
  "ok": true,
  "path": "/villas/villa-slug",
  "villa_id": "villa-uuid",
  "thin_scrape": false,
  "error": null
}
```

### Scout Paste
```
POST /api/scout-paste

Request:
{
  "pasted_text": "Beautiful 4-bedroom villa in Tuscany...",
  "list_id": "list-uuid",
  "original_url": "https://somesite.com/listing"
}

Response:
{
  "ok": true,
  "path": "/villas/villa-slug",
  "villa_id": "villa-uuid",
  "error": null
}
```

---

## ERROR RESPONSES

All errors follow this format:

```
{
  "error": "Not Found",
  "detail": "List not found"
}
```

Common status codes:
- `200` - Success
- `400` - Bad request (invalid data)
- `404` - Not found
- `500` - Server error

---

## ROLES & PERMISSIONS

### Admin
- View list ✅
- Edit list name/description ✅
- Delete list ✅
- Manage members ✅
- Create/revoke invites ✅
- Add/edit/delete villas ✅

### Editor
- View list ✅
- Add/edit/delete villas ✅
- View members ✅
- Cannot manage members ❌
- Cannot delete list ❌

### Viewer
- View list ✅
- View villas ✅
- View members ✅
- Cannot edit/delete ❌
- Cannot manage members ❌

---

## WORKFLOW EXAMPLES

### Example 1: User Creates List and Scouts Villa
```
1. POST /api/lists?user_id=alice
   → Creates list, alice is creator

2. POST /api/scout
   {
     "url": "https://airbnb.com/...",
     "list_id": "list-123"
   }
   → Scouts URL, saves villa to list

3. GET /api/lists/list-123/villas
   → Returns list with new villa
```

### Example 2: User Invites Collaborator
```
1. POST /api/lists/list-123/invites?created_by=alice
   {
     "role": "editor",
     "expires_in_days": 30
   }
   → Returns token: "xyz_token"

2. Share URL: https://yourapp.com/join/xyz_token

3. Bob clicks link, sees invite details:
   GET /api/invites/xyz_token
   → Shows "Join 'Italy Trip 2024' as Editor"

4. Bob accepts:
   POST /api/invites/xyz_token/accept?user_id=bob
   → Bob now in list as editor

5. GET /api/lists?user_id=bob
   → List now appears in Bob's list
```

### Example 3: Editor Modifies Villa
```
1. PUT /api/lists/list-123/villas/villa-slug
   {
     "price_weekly_usd": 3500,
     "bedrooms": 5
   }
   → Updates villa (editor has permission)

2. GET /api/lists/list-123/villas
   → Shows updated villa
```

---

## Development Testing

Use curl or Postman:

```bash
# Create list
curl -X POST http://localhost:8000/api/lists?user_id=alice-uuid \
  -H "Content-Type: application/json" \
  -d '{"name":"Test List","description":"Testing"}'

# Get lists
curl http://localhost:8000/api/lists?user_id=alice-uuid

# Create invite
curl -X POST http://localhost:8000/api/lists/list-uuid/invites?created_by=alice-uuid \
  -H "Content-Type: application/json" \
  -d '{"role":"editor","expires_in_days":30}'
```

---

## Frontend Integration

The Next.js frontend will:
1. Get user from Supabase Auth
2. Extract user ID from session
3. Pass `user_id` as query parameter to all endpoints
4. Use JWT token for auth verification (RLS will filter at DB level)

Example:
```typescript
const { user } = useAuth()
const userId = user?.id

// Fetch lists
const response = await fetch(`/api/lists?user_id=${userId}`)
const lists = await response.json()
```
