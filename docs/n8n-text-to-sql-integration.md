# n8n Text-to-SQL Integration for Meetdup AI Chatbot

## Overview

This document describes how to integrate n8n as a Text-to-SQL backend for the Meetdup AI Chapter Data Assistant.

## Architecture

```
LINE OA --> Meetdup Webhook --> isChapterAIQuery? 
                                      |
                       Yes --> POST to n8n webhook
                                      |
                       n8n AI Agent --> Text-to-SQL
                                      |
                       Query Supabase PostgreSQL
                                      |
                       Return response to Meetdup
                                      |
                       Meetdup replies to LINE
```

## n8n Webhook Specification

### Endpoint
```
POST https://your-n8n-instance.com/webhook/meetdup-ai-query
```

### Request Body
```json
{
  "tenant_id": "uuid",
  "line_user_id": "Uxxxxx",
  "user_role": "admin" | "member" | "visitor",
  "user_name": "John Doe",
  "message": "ใครมาประชุมวันนี้บ้าง",
  "session_id": "uuid (for conversation continuity)"
}
```

### Response Body
```json
{
  "success": true,
  "response": "วันนี้มีสมาชิกมาประชุม 37 คน...",
  "metadata": {
    "sql_query": "SELECT ... (optional, for debugging)",
    "execution_time_ms": 150
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Could not process query",
  "response": "ขออภัย ไม่สามารถประมวลผลได้ กรุณาลองใหม่"
}
```

---

## n8n Workflow Structure

### Nodes Required:

1. **Webhook** (Trigger)
   - Method: POST
   - Path: `/meetdup-ai-query`
   - Response: "Respond to Webhook"

2. **AI Agent** (Core)
   - Model: OpenAI GPT-4o or Claude
   - System Prompt: See below
   - Tools:
     - get_database_schema
     - execute_sql_query

3. **OpenAI Chat Model** (Sub-node)
   - Model: gpt-4o-mini or gpt-4o
   - Temperature: 0.1 (for consistent SQL)

4. **Postgres Chat Memory** (Sub-node)
   - Connection: Supabase PostgreSQL
   - Session ID: `{{ $json.session_id }}`

5. **Get tables, schemas, foreign keys** (Tool)
   - Returns schema information

6. **Execute SQL query** (Tool)
   - Connection: Supabase PostgreSQL
   - Read-only recommended

7. **Respond to Webhook** (Final)
   - Return JSON response

---

## Supabase Connection String

```
postgresql://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Or use individual fields:
- Host: `aws-0-ap-southeast-1.pooler.supabase.com`
- Port: `6543`
- Database: `postgres`
- User: `postgres.[project-ref]`
- Password: (from Supabase dashboard)

---

## Environment Variable

Set in Meetdup:
```
N8N_AI_QUERY_WEBHOOK_URL=https://your-n8n.com/webhook/meetdup-ai-query
```

---

## Meetdup Integration Code

Location: `server/services/n8nAIQuery.ts`

See the implementation file for the forwardToN8nAI function.
