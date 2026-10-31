# Unified Search Engine Documentation

**Implementation:** `backend/src/services/search/searchEngine.js`  
**Indexing Engine:** MySQL 8.4 LTS InnoDB FULLTEXT  

---

## 1. Search Strategy

The search engine employs a **hybrid retrieval strategy** combining:
1. **Exact Term Matching:** Substring and prefix matching for telephone numbers, email addresses, person names, and invoice numbers.
2. **MySQL FULLTEXT In-Depth Search:** Utilizes MySQL `MATCH(...) AGAINST(... IN BOOLEAN MODE)` with automatic word prefix expansion (`+term*`).
3. **Relevance Scoring:** Computes composite scores combining exact match bonuses (5.0 - 7.0 bonus points) + MySQL natural language relevance score + recency timestamps.

---

## 2. Indexed Full-Text Fields

- **WhatsApp:** `wa_messages(text_content, caption)`
- **Gmail:** `emails(subject, body_plain)`
- **Google Drive Files:** `drive_files(name)`
- **Google Drive Contents:** `drive_file_contents(raw_text)`
- **Document Chunks:** `document_chunks(chunk_text, filename)`

---

## 3. Universal Search (`searchAllSources`)

When querying across platforms:
- Searches WhatsApp, Gmail, Drive, and Chunks in parallel `Promise.all` branches.
- Deduplicates results by composite identifier.
- Sorts by composite relevance score descending.
- Formats uniform output schema containing:
  - `id`: unique record key
  - `platform`: `whatsapp` | `gmail` | `drive`
  - `title`: subject, file name, or sender
  - `snippet`: matching text excerpt
  - `date`: ISO timestamp
  - `score`: relevance score
