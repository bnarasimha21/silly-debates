# Deployment Checklist

## Growth release (Phases 0-2 of GROWTH_SPEC.md)

Do these in order. The app build does not run migrations.

- [ ] Apply database migrations **before** deploying the new code:
      `DATABASE_URL=<production url> npx prisma migrate deploy`
      (adds `Debate.season`, the `Event` table, and anonymous-vote columns on
      `Vote`; the currently deployed code keeps working on the new schema)
- [ ] Set `ADMIN_EMAILS` to your sign-in email so you can open `/admin/metrics`
- [ ] After the custom domain is live: set `APP_URL` / `NEXTAUTH_URL` to it,
      update `APP_URL` in `functions/project.yml`, and update the OAuth
      callback URLs below. Share links and preview images use this URL.
- [ ] Optional: set `AUTH_RESEND_KEY` and `EMAIL_FROM` to offer email sign-in
- [ ] After deploy, vote once without signing in, then check `/admin/metrics`:
      "Networks" for today's debate should be 1 or more. If it stays 0 the
      platform is not passing the visitor's IP and the per-network vote limit
      is not being applied (see `requestIpHash` in `src/lib/voter.ts`).
- [ ] Paste an entry link (`/e/...`) into WhatsApp, X and Slack and confirm
      the preview card appears

## Before Deploying to DigitalOcean App Platform

- [ ] Set environment variables in App Platform:
  - `DATABASE_URL`
  - `NEXTAUTH_URL` → set to production URL (e.g., `https://silly-debates-xxxxx.ondigitalocean.app`)
  - `NEXTAUTH_SECRET`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - Gradient AI keys (Phase 3)

## After Deployment - UPDATE OAuth URLs!

### GitHub OAuth
1. Go to: GitHub → Settings → Developer Settings → OAuth Apps → Your App
2. Update **Homepage URL**: `https://your-app-url.ondigitalocean.app`
3. Update **Authorization callback URL**: `https://your-app-url.ondigitalocean.app/api/auth/callback/github`

### Google OAuth
1. Go to: Google Cloud Console → APIs & Services → Credentials → Your OAuth Client
2. Update **Authorized JavaScript origins**: `https://your-app-url.ondigitalocean.app`
3. Update **Authorized redirect URIs**: `https://your-app-url.ondigitalocean.app/api/auth/callback/google`

## Post-Deployment Verification
- [ ] Test Google sign-in
- [ ] Test GitHub sign-in
- [ ] Verify database connection
- [ ] Test voting functionality
- [ ] Test entry submission
