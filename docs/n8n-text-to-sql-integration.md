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
                       Response Formatter Agent
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

### Visual Flow

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Webhook   │───>│  Text-to-SQL     │───>│   Execute SQL   │
│  (Trigger)  │    │    AI Agent      │    │     (Tool)      │
└─────────────┘    └──────────────────┘    └────────┬────────┘
                                                    │
                                                    v
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│   Respond to    │<───│  Response Formatter  │<───│   SQL Results    │
│    Webhook      │    │      AI Agent        │    │    (Raw Data)    │
└─────────────────┘    └──────────────────────┘    └──────────────────┘
```

### Nodes Required:

1. **Webhook** (Trigger)
   - Method: POST
   - Path: `/meetdup-ai-query`
   - Response: "Respond to Webhook"

2. **Text-to-SQL AI Agent** (Core)
   - Model: OpenAI GPT-4o or Claude
   - System Prompt: See `docs/n8n-system-prompt.md`
   - Tools:
     - get_database_schema
     - execute_sql_query
   - **Purpose**: Converts user question to SQL query

3. **OpenAI Chat Model** (Sub-node for Agent #1)
   - Model: gpt-4o-mini or gpt-4o
   - Temperature: 0.1 (for consistent SQL generation)

4. **Postgres Chat Memory** (Sub-node)
   - Connection: Supabase PostgreSQL
   - Session ID: `{{ $json.session_id }}`

5. **Get tables, schemas, foreign keys** (Tool for Agent #1)
   - Returns schema information

6. **Execute SQL query** (Tool for Agent #1)
   - Connection: Supabase PostgreSQL
   - Read-only recommended
   - **Output**: Raw SQL results (rows/data)

7. **Response Formatter AI Agent** (NEW - Humanize Results)
   - Model: OpenAI GPT-4o-mini
   - System Prompt: See `docs/n8n-response-formatter-prompt.md`
   - **Purpose**: Converts raw SQL results to human-readable Thai response
   - **Inputs**:
     - Original user question
     - Executed SQL query
     - SQL query results (rows/data)
     - User role (admin/member/visitor)
     - User name

8. **Respond to Webhook** (Final)
   - Return JSON response

---

## Response Formatter Agent Details

### Purpose
The Response Formatter Agent takes raw SQL query results and transforms them into natural, human-readable Thai language responses that directly answer the user's original question.

### Why This Step?
- Raw SQL results are just data tables/numbers
- Users expect conversational answers, not raw data
- Role-based filtering (hide sensitive data from non-admins)
- Empty result handling with helpful messages
- Consistent formatting across all responses

### Input Payload for Formatter Agent

```json
{
  "original_question": "ใครมาประชุมวันนี้บ้าง",
  "executed_sql": "SELECT p.nickname_th, p.full_name_th FROM participants p JOIN checkins c ON ...",
  "sql_results": [
    {"nickname_th": "ชายดี", "full_name_th": "สมชาย สุขใจ"},
    {"nickname_th": "หญิงดี", "full_name_th": "สมหญิง มีสุข"}
  ],
  "row_count": 2,
  "user_role": "admin",
  "user_name": "คุณบอย",
  "tenant_id": "uuid"
}
```

### Expected Output

```
วันนี้มีสมาชิกมาประชุม 2 คนครับ:
• คุณสมชาย (ชายดี)
• คุณสมหญิง (หญิงดี)
```

### n8n Configuration

**Expressions to Pass to Formatter Agent:**

```
Original Question: {{ $('Webhook').item.json.message }}
User Role: {{ $('Webhook').item.json.user_role }}
User Name: {{ $('Webhook').item.json.user_name }}
SQL Query: {{ $('Text-to-SQL Agent').item.json.sql_query }}
SQL Results: {{ JSON.stringify($('Execute SQL').item.json) }}
Row Count: {{ $('Execute SQL').item.json.length || 0 }}
```

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

---

## Workflow Testing Checklist

1. [ ] Webhook receives request correctly
2. [ ] Text-to-SQL Agent generates valid SQL
3. [ ] SQL includes tenant_id filter
4. [ ] Execute SQL returns results
5. [ ] Response Formatter creates human-readable Thai response
6. [ ] Response respects user role (admin sees all, member sees limited)
7. [ ] Empty results handled gracefully
8. [ ] Errors return user-friendly message
