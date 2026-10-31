# Installation & Setup Guide

---

## 1. Prerequisites

- **Operating System:** Windows 10 or Windows 11
- **Node.js:** v20+ or v24 (Verified on `v24.17.0`)
- **MySQL Server:** 8.4 LTS (Configured as Windows Service on port 3306)
- **Git:** Git for Windows (Verified at `C:\Users\Nuage123\AppData\Local\Programs\Git\cmd\git.exe`)

---

## 2. Fast Setup (Single Command)

From the project root:

```bash
cd unified-ai-workspace
npm run dev
```

This single command automatically:
1. Verifies the database connection.
2. Executes all schema migrations on `unified_ai_workspace`.
3. Seeds default settings and admin user.
4. Starts the backend server on `http://127.0.0.1:5000`.
5. Starts the React Vite frontend on `http://127.0.0.1:5173`.

---

## 3. Configuration

### Environment Variables (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=your_jwt_secret_key
CREDENTIAL_ENCRYPTION_KEY=your_32byte_encryption_key

# MySQL Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=unified_ai_workspace

# Google Gemini API (Get key from https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Google OAuth (Gmail & Google Drive)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/connections/google/callback
```

*Note: You can also update the Gemini API key directly from the Settings page in the React UI.*
