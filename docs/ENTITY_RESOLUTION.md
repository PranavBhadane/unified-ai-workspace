# Entity Resolution & Cross-Platform Intelligence

**Implementation:** `backend/src/services/entities/entityResolver.js`  

---

## 1. The Cross-Platform Identity Problem

In daily business workflows, the same person or company appears under distinct identifiers:
- **WhatsApp:** `Rahul Sharma`, phone number `+91 98765 43210`
- **Gmail:** `rahul@xyz.com`, name `Rahul`
- **Google Drive:** Folder `XYZ Enterprises / Rental Agreement - Rahul Sharma.pdf`

Without entity resolution, AI cannot cross-correlate these records.

---

## 2. Resolution Methodology

1. **Normalization Pipeline:**
   - **Phone Normalization:** Strips international prefixes, spaces, and punctuation (`+91 98765-43210` -> `9876543210`).
   - **Email Normalization:** Trims whitespace, lowercases (` Rahul@XYZ.COM ` -> `rahul@xyz.com`).
2. **Matching Engine:**
   - Cross-matches against `contacts` imported from WhatsApp and Gmail.
   - Computes match confidence scores (0 - 100%).
   - Stores aliases in `entity_aliases` (`name`, `email`, `phone`, `company`).
3. **Client Profile Consolidation (`getClientProfile`):**
   - Retrieves linked WhatsApp messages.
   - Retrieves linked Gmail email threads.
   - Retrieves linked Google Drive files.
   - Extracts financial highlights: scans for keywords (`invoice`, `rental`, `payment`, `amount`, `rs`, `inr`, `$`).
4. **Chronological Multi-Source Timeline (`getClientTimeline`):**
   - Merges chat messages, email exchanges, and document updates into a unified chronological stream.
