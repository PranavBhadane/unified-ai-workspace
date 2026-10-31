# Security Policy

Unified AI Workspace is built with a **local-first, security-conscious architecture** designed to give users complete control and sovereignty over their personal and enterprise data.

---

## 1. Reporting Security Vulnerabilities

We take the security of Unified AI Workspace seriously. If you discover a security vulnerability, we appreciate your help in disclosing it to us responsibly.

### 1.1 Responsible Disclosure Procedure
- **Reporting Channel:** Please report potential security vulnerabilities privately via GitHub Security Advisories or by emailing `security@workspace.local` (or the project maintainer).
- **Please DO NOT** open a public GitHub issue for undisclosed vulnerabilities.
- **Information to Include:**
  - Description of the vulnerability.
  - Step-by-step reproduction instructions or proof-of-concept script.
  - Potential impact of exploitation.
  - Proposed remediation or patch, if available.
- **Response Timeline:**
  - **Initial Acknowledgment:** Within 48 hours.
  - **Assessment & Status Update:** Within 5 business days.
  - **Patch Release:** Targeted within 14 business days depending on severity.

---

## 2. Local Credential Storage & Encryption Architecture

### 2.1 AES-256-GCM Authenticated Encryption
All sensitive third-party credentials stored in the local database (`connected_accounts` and `ai_provider_configs`) are encrypted at rest using **AES-256-GCM** (Galois/Counter Mode).
- **Key Derivation:** The encryption key is sourced directly from the `CREDENTIAL_ENCRYPTION_KEY` environment variable. It must be an exact 32-character string.
- **Initialization Vector (IV):** A unique, cryptographically random 16-byte initialization vector (`crypto.randomBytes(16)`) is generated for every encryption operation.
- **Authentication Tag:** A 16-byte GCM authentication tag is generated and appended to the cipher payload, preventing tampering or bit-flipping attacks.
- **Payload Format:** Serialized as `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.

### 2.2 Plaintext Credential Non-Persistence
- API keys entered via the web interface are encrypted immediately before database insertion.
- Decrypted credentials exist solely in short-lived memory during outgoing API request construction and are never logged to diagnostic log files.

---

## 3. OAuth Token Security & Protection

### 3.1 Google OAuth 2.0 Tokens
- **Access Tokens:** Used exclusively for authorized Google API requests (Gmail and Google Drive read-only endpoints). Stored in encrypted format in MySQL.
- **Refresh Tokens:** Encrypted at rest. Used strictly by the backend to obtain fresh access tokens when previous tokens expire.
- **Token Revocation:** When an account is disconnected via the Connections interface or API (`DELETE /api/connections/:platform`), the backend revokes the token with Google and purges the row from `connected_accounts`.
- **Minimal Privilege Scopes:** Unified AI Workspace only requests read-only scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/drive.readonly`
  The application never requests or possesses permissions to send emails, delete messages, modify drive files, or alter Google settings.

---

## 4. WhatsApp Session Protection

- **Baileys Multi-Device Keys:** WhatsApp session keys, Noise handshake certificates, and encryption keys are stored in `backend/storage/whatsapp/`.
- **Filesystem Isolation:** The `storage/` directory is strictly excluded from version control via `.gitignore`.
- **Session Purging:** Disconnecting WhatsApp removes all cached session credentials from disk, requiring a new QR scan to re-authenticate.

---

## 5. Network Communication Boundaries & Zero-Telemetry Guarantee

- **Local-Only Web Server:** By default, Express binds to `127.0.0.1` and `localhost`. It does not listen on public interfaces unless explicitly configured by the user.
- **Whitelisted Outbound Endpoints:** The application only initiates outbound network traffic to:
  1. Google APIs (`oauth2.googleapis.com`, `gmail.googleapis.com`, `www.googleapis.com`).
  2. Configured AI Providers:
     - Google Gemini (`generativelanguage.googleapis.com`)
     - OpenAI (`api.openai.com`)
     - Anthropic Claude (`api.anthropic.com`)
  3. WhatsApp WebSocket Gateway (`*.whatsapp.net`) via Baileys.
- **Zero Third-Party Telemetry:** Unified AI Workspace contains **no telemetry, analytics beacons, crash collectors, or advertising tracking scripts**. Your queries, conversation history, and data remain entirely private.

---

## 6. Deployment & Operational Hardening Best Practices

When deploying Unified AI Workspace in a team or home-server environment:
1. **Never commit `.env`:** Always verify that `.env` is listed in `.gitignore` before committing code.
2. **Use Strong Encryption Keys:** Ensure `CREDENTIAL_ENCRYPTION_KEY` and `JWT_SECRET` are unique, high-entropy 32-character strings.
3. **Restrict File Permissions:** Set operating system permissions on `backend/.env` and `backend/storage/` so only the service user can read them (e.g. `chmod 600 backend/.env` on Unix).
4. **Use a Secure Reverse Proxy for Remote Access:** If accessing Unified AI Workspace over the local network or internet, place the application behind a reverse proxy (e.g., Nginx, Caddy) with TLS/HTTPS enabled and strong authentication.
