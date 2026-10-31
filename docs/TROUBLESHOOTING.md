# Troubleshooting & Diagnostic Guide

---

## 1. MySQL Connectivity Issues

- **Symptom:** `connect ECONNREFUSED 127.0.0.1:3306`
- **Solution:** Verify the MySQL 8.4 Windows service is active:
  ```powershell
  Get-Service *mysql*
  Start-Service -Name "MySQL Server 8.4"
  ```
- **Symptom:** `ER_ACCESS_DENIED_ERROR for user 'username'`
  Ensure user privileges are granted:
  ```sql
  GRANT ALL PRIVILEGES ON unified_ai_workspace.* TO 'username'@'localhost';
  FLUSH PRIVILEGES;
  ```

---

## 2. WhatsApp QR Code Does Not Appear

- **Symptom:** Status shows disconnected, no QR code.
- **Solution:**
  1. Open the **Connections** page and click **Show QR Code**.
  2. If the session expired or corrupted, click **Disconnect** to wipe `storage/whatsapp/auth_info/` and re-initialize.
  3. Keep the browser open while scanning from WhatsApp > Linked Devices.

---

## 3. Google OAuth 2.0 Error: `redirect_uri_mismatch`

- **Symptom:** Google displays error 400 `redirect_uri_mismatch`.
- **Solution:**
  Ensure `http://localhost:5000/api/connections/google/callback` is added under **Authorized redirect URIs** in your Google Cloud Console OAuth 2.0 client configuration.

---

## 4. Google Gemini API Error: `API_KEY_INVALID` or Quota Exceeded

- **Symptom:** Chat returns API error.
- **Solution:**
  1. Navigate to **Settings** in the application.
  2. Enter a valid API key from [Google AI Studio](https://aistudio.google.com/).
  3. Click **Test Connection** to verify response with `gemini-2.5-flash`.
