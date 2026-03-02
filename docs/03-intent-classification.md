# Algo - Intent Classification Schema

## Intent Taxonomy

### Category Structure: `{type}.{domain}.{action}`

```
intent
├── query                          # Read-only data retrieval
│   ├── query.social.performance   # Social media metrics
│   ├── query.social.engagement    # Likes, comments, shares
│   ├── query.campaign.status      # Campaign status check
│   ├── query.campaign.list        # List campaigns
│   ├── query.leads.count          # Lead count/summary
│   ├── query.leads.hot            # Hot leads specifically
│   ├── query.leads.followup       # Follow-up needed
│   ├── query.leads.source         # Lead source breakdown
│   ├── query.email.performance    # Email campaign metrics
│   ├── query.email.drip           # Drip campaign results
│   ├── query.credits.balance      # AI credits remaining
│   ├── query.revenue.summary      # Revenue metrics
│   ├── query.revenue.pipeline     # Pipeline value
│   ├── query.analytics.overview   # General analytics
│   └── query.analytics.comparison # Compare time periods
│
├── action                         # Write/mutate operations
│   ├── action.campaign.create     # Create new campaign
│   ├── action.campaign.pause      # Pause campaign
│   ├── action.campaign.resume     # Resume campaign
│   ├── action.campaign.delete     # Delete campaign
│   ├── action.content.generate    # Generate content
│   ├── action.social.post         # Launch/schedule post
│   ├── action.social.schedule     # Schedule future post
│   ├── action.followup.trigger    # Trigger follow-up
│   ├── action.task.assign         # Assign task to rep
│   ├── action.report.generate     # Generate report
│   ├── action.email.send          # Send email campaign
│   └── action.lead.update         # Update lead status
│
├── navigation                     # App navigation
│   ├── navigation.dashboard       # Go to dashboard
│   ├── navigation.campaigns       # Go to campaigns
│   ├── navigation.leads           # Go to leads
│   └── navigation.settings        # Go to settings
│
├── system                         # System interactions
│   ├── system.help                # Help request
│   ├── system.greeting            # Hi/Hello
│   └── system.feedback            # App feedback
│
└── unknown                        # Unclassifiable
```

---

## Example Intent JSON Objects

### 1. Performance Query

```json
{
  "input": "How did my social media campaign perform today?",
  "intent": {
    "category": "query",
    "domain": "social",
    "action": "performance",
    "full_intent": "query.social.performance",
    "confidence": 0.94
  },
  "entities": {
    "time_range": {
      "value": "today",
      "resolved": {
        "start": "2026-03-01T00:00:00Z",
        "end": "2026-03-01T23:59:59Z"
      }
    },
    "platform": null,
    "campaign_name": null
  },
  "api_mapping": {
    "primary": "GET /social/performance",
    "params": {
      "date_from": "2026-03-01",
      "date_to": "2026-03-01"
    }
  },
  "requires_confirmation": false
}
```

### 2. Engagement Query

```json
{
  "input": "How many likes, comments, and shares did I get this week?",
  "intent": {
    "category": "query",
    "domain": "social",
    "action": "engagement",
    "full_intent": "query.social.engagement",
    "confidence": 0.96
  },
  "entities": {
    "time_range": {
      "value": "this week",
      "resolved": {
        "start": "2026-02-23T00:00:00Z",
        "end": "2026-03-01T23:59:59Z"
      }
    },
    "metrics": ["likes", "comments", "shares"],
    "platform": null
  },
  "api_mapping": {
    "primary": "GET /social/performance",
    "params": {
      "date_from": "2026-02-23",
      "date_to": "2026-03-01",
      "metrics": "likes,comments,shares"
    }
  },
  "requires_confirmation": false
}
```

### 3. Lead Count Query

```json
{
  "input": "How many leads were generated this week?",
  "intent": {
    "category": "query",
    "domain": "leads",
    "action": "count",
    "full_intent": "query.leads.count",
    "confidence": 0.95
  },
  "entities": {
    "time_range": {
      "value": "this week",
      "resolved": {
        "start": "2026-02-23T00:00:00Z",
        "end": "2026-03-01T23:59:59Z"
      }
    },
    "lead_source": null,
    "lead_status": null
  },
  "api_mapping": {
    "primary": "GET /leads",
    "params": {
      "created_after": "2026-02-23",
      "created_before": "2026-03-01",
      "count_only": true
    }
  },
  "requires_confirmation": false
}
```

### 4. Email Drip Campaign Query

```json
{
  "input": "Any leads from email drip campaigns?",
  "intent": {
    "category": "query",
    "domain": "email",
    "action": "drip",
    "full_intent": "query.email.drip",
    "confidence": 0.91
  },
  "entities": {
    "time_range": {
      "value": "recent",
      "resolved": {
        "start": "2026-02-22T00:00:00Z",
        "end": "2026-03-01T23:59:59Z"
      }
    },
    "campaign_type": "drip"
  },
  "api_mapping": {
    "primary": "GET /leads",
    "secondary": "GET /email",
    "params": {
      "source": "email_drip",
      "created_after": "2026-02-22"
    }
  },
  "requires_confirmation": false
}
```

### 5. Hot Leads / Follow-up Query

```json
{
  "input": "Any hot prospects needing follow-up?",
  "intent": {
    "category": "query",
    "domain": "leads",
    "action": "followup",
    "full_intent": "query.leads.followup",
    "confidence": 0.93
  },
  "entities": {
    "lead_temperature": "hot",
    "followup_status": "overdue"
  },
  "api_mapping": {
    "primary": "GET /crm",
    "secondary": "GET /leads",
    "params": {
      "score_min": 70,
      "followup_status": "overdue",
      "sort": "score_desc"
    }
  },
  "requires_confirmation": false
}
```

### 6. Credits Query

```json
{
  "input": "How many AI credits do I have remaining?",
  "intent": {
    "category": "query",
    "domain": "credits",
    "action": "balance",
    "full_intent": "query.credits.balance",
    "confidence": 0.98
  },
  "entities": {},
  "api_mapping": {
    "primary": "GET /credits",
    "params": {}
  },
  "requires_confirmation": false
}
```

### 7. Create Campaign Action

```json
{
  "input": "Create a new Instagram campaign for our summer collection",
  "intent": {
    "category": "action",
    "domain": "campaign",
    "action": "create",
    "full_intent": "action.campaign.create",
    "confidence": 0.92
  },
  "entities": {
    "platform": "instagram",
    "campaign_name": "Summer Collection",
    "campaign_type": "social"
  },
  "api_mapping": {
    "primary": "POST /campaigns",
    "params": {
      "name": "Summer Collection",
      "platform": "instagram",
      "type": "social"
    }
  },
  "requires_confirmation": true,
  "confirmation_prompt": "I'll create a new Instagram campaign called 'Summer Collection'. Should I proceed?"
}
```

### 8. Pause Campaign Action

```json
{
  "input": "Pause the Spring Sale campaign",
  "intent": {
    "category": "action",
    "domain": "campaign",
    "action": "pause",
    "full_intent": "action.campaign.pause",
    "confidence": 0.97
  },
  "entities": {
    "campaign_name": "Spring Sale"
  },
  "api_mapping": {
    "primary": "PATCH /campaigns/:id",
    "resolve_first": "GET /campaigns?name=Spring Sale",
    "params": {
      "status": "paused"
    }
  },
  "requires_confirmation": true,
  "confirmation_prompt": "I found the 'Spring Sale' campaign. Pausing it will stop all scheduled posts and ads. Confirm?"
}
```

### 9. Generate Content Action

```json
{
  "input": "Generate a LinkedIn post about our Q1 results",
  "intent": {
    "category": "action",
    "domain": "content",
    "action": "generate",
    "full_intent": "action.content.generate",
    "confidence": 0.93
  },
  "entities": {
    "platform": "linkedin",
    "content_type": "post",
    "topic": "Q1 results"
  },
  "api_mapping": {
    "primary": "POST /campaigns/content/generate",
    "params": {
      "platform": "linkedin",
      "type": "post",
      "topic": "Q1 results",
      "tone": "professional"
    }
  },
  "requires_confirmation": true,
  "confirmation_prompt": "I'll generate a professional LinkedIn post about your Q1 results. Want me to go ahead?"
}
```

### 10. Assign Task Action

```json
{
  "input": "Assign the TechCorp follow-up to Sarah from sales",
  "intent": {
    "category": "action",
    "domain": "task",
    "action": "assign",
    "full_intent": "action.task.assign",
    "confidence": 0.90
  },
  "entities": {
    "task_subject": "TechCorp follow-up",
    "assignee_name": "Sarah",
    "assignee_team": "sales"
  },
  "api_mapping": {
    "primary": "POST /crm/tasks",
    "resolve_first": [
      "GET /crm?company=TechCorp",
      "GET /crm/users?name=Sarah&team=sales"
    ],
    "params": {
      "type": "followup",
      "lead_id": "<resolved>",
      "assignee_id": "<resolved>"
    }
  },
  "requires_confirmation": true,
  "confirmation_prompt": "I'll assign the TechCorp follow-up task to Sarah (Sales Team). Confirm?"
}
```

---

## Entity Extraction Schema

```json
{
  "entity_types": {
    "time_range": {
      "type": "temporal",
      "examples": ["today", "this week", "last month", "yesterday", "Q1"],
      "resolution": "ISO 8601 date range"
    },
    "platform": {
      "type": "enum",
      "values": ["instagram", "facebook", "twitter", "linkedin", "reddit", "whatsapp", "email"],
      "aliases": { "ig": "instagram", "fb": "facebook", "x": "twitter", "li": "linkedin" }
    },
    "campaign_name": {
      "type": "string",
      "fuzzy_match": true,
      "resolve_via": "GET /campaigns"
    },
    "metrics": {
      "type": "list",
      "values": ["likes", "comments", "shares", "impressions", "clicks", "conversions", "revenue", "leads", "open_rate", "ctr"]
    },
    "lead_temperature": {
      "type": "enum",
      "values": ["hot", "warm", "cold"],
      "score_mapping": { "hot": [70, 100], "warm": [40, 69], "cold": [0, 39] }
    },
    "person_name": {
      "type": "string",
      "resolve_via": "GET /crm/users"
    },
    "company_name": {
      "type": "string",
      "resolve_via": "GET /crm?company=<value>"
    }
  }
}
```

---

## Multi-Intent Handling

For complex queries that contain multiple intents:

```json
{
  "input": "How many leads did we get this week, and pause the email drip for cold leads",
  "intents": [
    {
      "full_intent": "query.leads.count",
      "confidence": 0.91,
      "segment": "How many leads did we get this week"
    },
    {
      "full_intent": "action.campaign.pause",
      "confidence": 0.87,
      "segment": "pause the email drip for cold leads"
    }
  ],
  "execution_strategy": "sequential",
  "note": "Query executes first, action requires confirmation"
}
```
