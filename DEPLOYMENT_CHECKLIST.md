# Deployment Checklist

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
