# Google Gemini AI Integration Documentation

**SDK:** Official `@google/genai` (GoogleGenAI)  
**Configuration:** `GEMINI_API_KEY`, `GEMINI_MODEL` (default: `gemini-2.5-flash`)  
**Implementation:** `backend/src/services/ai/geminiService.js`  

---

## 1. Overview & Privacy Design

Gemini AI acts as the reasoning engine for the Unified AI Workspace. In accordance with local-first privacy principles:
- **No Bulk Transmission:** The application **never** uploads your entire database to Google.
- **Controlled Function Calling:** Gemini analyzes the user's natural language question and decides which specific search tools to invoke on the local backend.
- **Selective Retrieval:** Only matching messages, email snippets, or document chunks returned by the local search queries are forwarded to Gemini to synthesize the final answer.

---

## 2. 18 Backend Function Calling Tools

| Tool Name | Parameters | Purpose |
| :--- | :--- | :--- |
| `search_whatsapp_messages` | `q`, `limit` | Search WhatsApp messages by keyword or contact |
| `search_whatsapp_contacts` | `q` | Search WhatsApp contacts and phone numbers |
| `search_whatsapp_groups` | `q` | Search WhatsApp group titles and descriptions |
| `search_gmail_messages` | `q`, `limit` | Search emails by subject, body, sender |
| `search_gmail_threads` | `threadId` | Retrieve full message thread from Gmail |
| `search_drive_files` | `q`, `limit` | Search Google Drive files by name |
| `search_drive_content` | `q`, `limit` | Full-text search inside Google Drive document text |
| `search_all_sources` | `q`, `platforms`, `limit` | Universal search across WhatsApp, Gmail, Drive |
| `search_contacts` | `q` | Search unified address book |
| `search_entities` | `q` | Search client and company profiles |
| `get_client_profile` | `clientNameOrId` | Retrieve cross-platform client dossier |
| `get_client_timeline` | `clientNameOrId` | Multi-source chronological timeline |
| `get_document_details` | `fileId` | Retrieve document chunks and metadata |
| `get_conversation_summary`| `chatJid` | Retrieve recent WhatsApp dialogue |
| `get_transaction_history` | `entityName` | Invoices, quotes, and payment mentions |
| `find_payment_references` | `query` | Scan cross-platform payment amounts |
| `find_pending_commitments`| `query` | Scan promises, deliverables, deadlines |
| `generate_client_report` | `clientName`, `sections`| Structured multi-section client report |

---

## 3. Function Calling Execution Loop

1. **User Question:** Prompt is sent to `ai.models.generateContent` with the 18 function declarations in `config.tools`.
2. **Model Call:** Gemini inspects the query and responds with one or more `functionCall` items (e.g. `search_all_sources({ q: "XYZ Enterprises" })`).
3. **Local Execution:** Backend executes the function against the local MySQL database and storage engine.
4. **Tool Response:** The local results are passed back to the model as `functionResponse`.
5. **Real-Time Progress:** Emits socket events (`ai:progress`) to the frontend:
   - "Understanding your question..."
   - "Searching Gmail messages & threads..."
   - "Searching WhatsApp conversations..."
   - "Searching Google Drive documents..."
   - "Analyzing matching information..."
6. **Consolidated Answer:** Gemini formats the final response with citations, distinguishing confirmed facts from discussed statements.
