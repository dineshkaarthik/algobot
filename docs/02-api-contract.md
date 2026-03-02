# Algo - API Contract Design

## Base URL
```
Production: https://api.algo.algonit.com/v1
Staging:    https://api-staging.algo.algonit.com/v1
```

## Authentication Headers
```
Authorization: Bearer <jwt_token>
X-Tenant-ID: <tenant_uuid>
X-Request-ID: <uuid_v4>
Content-Type: application/json
```

---

## 1. Authentication Endpoints

### POST /auth/login
```json
// Request
{
  "email": "user@company.com",
  "password": "encrypted_password",
  "device_id": "ios_abc123",
  "device_type": "ios" // "ios" | "android"
}

// Response 200
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "user": {
    "id": "usr_abc123",
    "email": "user@company.com",
    "name": "John Doe",
    "role": "admin",
    "tenant_id": "ten_xyz789",
    "avatar_url": "https://..."
  }
}
```

### POST /auth/refresh
```json
// Request
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
}

// Response 200
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_in": 3600
}
```

### POST /auth/logout
```json
// Request
{
  "device_id": "ios_abc123"
}

// Response 200
{ "status": "ok" }
```

---

## 2. Chat / Conversation Endpoints

### POST /chat/message
Primary endpoint for all voice/text interactions.

```json
// Request
{
  "conversation_id": "conv_abc123",       // null for new conversation
  "message": "How did my social media campaign perform today?",
  "input_type": "text",                    // "text" | "voice"
  "audio_url": null,                       // S3 URL if voice input
  "context": {
    "screen": "dashboard",                 // current screen context
    "selected_campaign_id": null           // optional context
  }
}

// Response 200
{
  "conversation_id": "conv_abc123",
  "message_id": "msg_def456",
  "response": {
    "text": "Your social media campaigns today generated 2,847 total engagements across all platforms. Instagram led with 1,203 likes and 89 comments. Your 'Spring Sale' campaign on Facebook drove 456 shares. Would you like a detailed breakdown by platform?",
    "structured_data": {
      "type": "performance_summary",
      "metrics": [
        { "platform": "instagram", "likes": 1203, "comments": 89, "shares": 45 },
        { "platform": "facebook", "likes": 890, "comments": 67, "shares": 456 },
        { "platform": "twitter", "likes": 234, "comments": 12, "shares": 51 }
      ],
      "chart_type": "bar",
      "time_range": "today"
    },
    "suggested_actions": [
      { "label": "View detailed report", "action": "VIEW_REPORT", "params": { "date": "2026-03-01" } },
      { "label": "Compare with yesterday", "action": "COMPARE_PERFORMANCE", "params": { "date_from": "2026-02-28", "date_to": "2026-03-01" } }
    ],
    "requires_confirmation": false
  },
  "intent": {
    "classified_as": "query.social.performance",
    "confidence": 0.94
  },
  "timestamp": "2026-03-01T15:30:00Z"
}
```

### POST /chat/message (Action with confirmation)
```json
// Request
{
  "conversation_id": "conv_abc123",
  "message": "Pause the Spring Sale campaign",
  "input_type": "text"
}

// Response 200
{
  "conversation_id": "conv_abc123",
  "message_id": "msg_ghi789",
  "response": {
    "text": "I found the 'Spring Sale' campaign (currently active, 12,345 impressions today). Are you sure you want to pause it? This will stop all scheduled posts and ads.",
    "structured_data": {
      "type": "action_confirmation",
      "action": "PAUSE_CAMPAIGN",
      "target": {
        "campaign_id": "cmp_spring2026",
        "campaign_name": "Spring Sale",
        "status": "active",
        "today_impressions": 12345
      }
    },
    "suggested_actions": [
      { "label": "Yes, pause it", "action": "CONFIRM_ACTION", "params": { "action_id": "act_pause_001" } },
      { "label": "No, keep it running", "action": "CANCEL_ACTION", "params": { "action_id": "act_pause_001" } }
    ],
    "requires_confirmation": true,
    "confirmation_id": "cfm_abc123"
  },
  "intent": {
    "classified_as": "action.campaign.pause",
    "confidence": 0.97
  },
  "timestamp": "2026-03-01T15:31:00Z"
}
```

### POST /chat/confirm
```json
// Request
{
  "conversation_id": "conv_abc123",
  "confirmation_id": "cfm_abc123",
  "confirmed": true
}

// Response 200
{
  "conversation_id": "conv_abc123",
  "message_id": "msg_jkl012",
  "response": {
    "text": "Done! The 'Spring Sale' campaign has been paused. You can resume it anytime by saying 'Resume Spring Sale campaign'.",
    "structured_data": {
      "type": "action_result",
      "action": "PAUSE_CAMPAIGN",
      "status": "success",
      "campaign_id": "cmp_spring2026"
    },
    "suggested_actions": [
      { "label": "Resume campaign", "action": "RESUME_CAMPAIGN", "params": { "campaign_id": "cmp_spring2026" } },
      { "label": "View all campaigns", "action": "LIST_CAMPAIGNS", "params": {} }
    ],
    "requires_confirmation": false
  },
  "timestamp": "2026-03-01T15:31:30Z"
}
```

### GET /chat/conversations
```json
// Query: ?page=1&limit=20

// Response 200
{
  "conversations": [
    {
      "id": "conv_abc123",
      "title": "Campaign Performance Check",
      "last_message": "Done! The 'Spring Sale' campaign has been paused.",
      "message_count": 5,
      "created_at": "2026-03-01T15:28:00Z",
      "updated_at": "2026-03-01T15:31:30Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "has_more": true
  }
}
```

### GET /chat/conversations/:id/messages
```json
// Query: ?page=1&limit=50

// Response 200
{
  "messages": [
    {
      "id": "msg_def456",
      "role": "user",
      "content": "How did my social media campaign perform today?",
      "input_type": "text",
      "timestamp": "2026-03-01T15:30:00Z"
    },
    {
      "id": "msg_def457",
      "role": "assistant",
      "content": "Your social media campaigns today generated...",
      "structured_data": { ... },
      "suggested_actions": [ ... ],
      "timestamp": "2026-03-01T15:30:02Z"
    }
  ],
  "pagination": { ... }
}
```

---

## 3. Dashboard Endpoints

### GET /dashboard/summary
```json
// Response 200
{
  "period": "today",
  "metrics": {
    "total_leads": 47,
    "hot_leads": 5,
    "active_campaigns": 12,
    "total_engagement": 8934,
    "ai_credits_remaining": 4500,
    "ai_credits_total": 10000,
    "revenue_today": 12450.00,
    "pipeline_value": 89000.00,
    "pending_followups": 8
  },
  "alerts": [
    {
      "id": "alt_001",
      "type": "hot_lead",
      "severity": "high",
      "title": "New hot lead detected",
      "message": "Sarah Johnson from TechCorp scored 92/100",
      "created_at": "2026-03-01T14:20:00Z",
      "action": { "type": "VIEW_LEAD", "params": { "lead_id": "lead_sarah_001" } }
    }
  ],
  "updated_at": "2026-03-01T15:30:00Z"
}
```

---

## 4. Notification Endpoints

### GET /notifications
```json
// Query: ?page=1&limit=20&unread_only=true

// Response 200
{
  "notifications": [
    {
      "id": "notif_001",
      "type": "hot_lead",
      "title": "Hot Lead Detected",
      "body": "Sarah Johnson from TechCorp has high engagement score (92/100)",
      "severity": "high",
      "read": false,
      "action_url": "/leads/lead_sarah_001",
      "created_at": "2026-03-01T14:20:00Z"
    }
  ],
  "unread_count": 3,
  "pagination": { ... }
}
```

### POST /notifications/:id/read
```json
// Response 200
{ "status": "ok" }
```

### PUT /notifications/settings
```json
// Request
{
  "hot_lead": { "enabled": true, "push": true, "email": true },
  "campaign_drop": { "enabled": true, "push": true, "email": false },
  "budget_alert": { "enabled": true, "push": true, "email": true, "threshold_pct": 80 },
  "revenue_spike": { "enabled": true, "push": false, "email": true },
  "credit_low": { "enabled": true, "push": true, "email": true, "threshold": 500 },
  "followup_overdue": { "enabled": true, "push": true, "email": false }
}
```

---

## 5. Device Registration (Push Notifications)

### POST /devices/register
```json
// Request
{
  "device_id": "ios_abc123",
  "device_type": "ios",
  "push_token": "apns_token_here",
  "app_version": "1.0.0",
  "os_version": "iOS 19.0"
}

// Response 200
{ "status": "registered" }
```

---

## 6. Audio Upload (Voice Input)

### POST /audio/upload
```
Content-Type: multipart/form-data

Fields:
  - audio: <binary> (m4a/wav, max 60 seconds)
  - conversation_id: "conv_abc123" (optional)

// Response 200
{
  "audio_id": "aud_xyz789",
  "audio_url": "https://s3.../audio/aud_xyz789.m4a",
  "transcription": "How did my campaign perform today?",
  "duration_seconds": 3.2
}
```

---

## 7. Error Response Format

```json
// Standard error response
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You have exceeded the rate limit. Please try again in 30 seconds.",
    "details": {
      "limit": 60,
      "window": "1m",
      "retry_after": 30
    }
  },
  "request_id": "req_abc123",
  "timestamp": "2026-03-01T15:30:00Z"
}
```

### Error Codes
| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | INVALID_REQUEST | Malformed request body |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Action conflicts with current state |
| 422 | VALIDATION_ERROR | Request validation failed |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Downstream service unavailable |

---

## 8. WebSocket Connection (Real-time updates)

### Connect
```
wss://api.algo.algonit.com/v1/ws?token=<jwt_token>
```

### Server-sent events
```json
// Typing indicator
{ "type": "typing", "conversation_id": "conv_abc123" }

// Streaming response (chunked)
{ "type": "stream", "conversation_id": "conv_abc123", "chunk": "Your campaign" }
{ "type": "stream", "conversation_id": "conv_abc123", "chunk": " performed well today" }
{ "type": "stream_end", "conversation_id": "conv_abc123", "message_id": "msg_def456" }

// Real-time alert
{ "type": "alert", "alert": { "id": "alt_002", "type": "hot_lead", ... } }

// Dashboard metric update
{ "type": "metric_update", "metric": "total_leads", "value": 48 }
```

---

## 9. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /chat/message | 30 | per minute |
| /auth/login | 5 | per minute |
| /dashboard/* | 60 | per minute |
| /audio/upload | 10 | per minute |
| WebSocket messages | 20 | per minute |
