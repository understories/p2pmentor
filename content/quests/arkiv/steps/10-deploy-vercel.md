# Deploy to Vercel

## Why Deploy?

Deploying your app proves it works independently of your local machine. It's the final step in the walkaway test - your app runs on Vercel's servers, but your data lives on Arkiv.

## Step 1: Prepare for Deployment

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "My Arkiv app"
   git push origin main
   ```

2. **Verify `.env.local` is gitignored** - Never commit private keys!

## Step 2: Deploy to Vercel

### Option A: Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Add environment variables:**
   ```bash
   vercel env add ARKIV_SPACE_ID
   vercel env add ARKIV_PRIVATE_KEY
   ```

### Option B: Vercel Dashboard

1. **Go to [vercel.com](https://vercel.com)**
2. **Import your GitHub repository**
3. **Add environment variables** in project settings:
   - `ARKIV_SPACE_ID` = `beta-launch`
   - `ARKIV_PRIVATE_KEY` = (your private key)
4. **Deploy**

## Step 3: Verify Deployment

1. **Visit your deployed URL** (e.g., `https://my-app.vercel.app`)
2. **Test entity creation** - Create a new entity
3. **Check the Explorer** - Verify it appears on-chain
4. **Stop your local server** - The deployed app should still work!

## The Walkaway Test, Part 2

This deployment proves:
- ✅ Your app works on different infrastructure
- ✅ Your data persists independently
- ✅ Multiple instances can read the same data
- ✅ You're not locked into one server

## Environment Variables in Production

**Important:** Set environment variables in Vercel dashboard, not in code:
- ✅ Use Vercel's environment variable UI
- ✅ Different values for production vs preview
- ✅ Never hardcode in source code
- ✅ Rotate keys if exposed

## Monitoring Your Deployment

Vercel provides:
- **Function logs** - See server-side execution
- **Analytics** - Track usage
- **Deployment history** - Roll back if needed

## Common Deployment Issues

**"Environment variables not found"**
- Check Vercel dashboard settings
- Verify variable names match exactly
- Redeploy after adding variables

**"Build failed"**
- Check build logs in Vercel
- Verify all dependencies are in `package.json`
- Ensure TypeScript compiles

**"Runtime errors"**
- Check function logs
- Verify Arkiv connection
- Test locally first

## What You've Accomplished

You now have:
- ✅ A working Arkiv app
- ✅ Deployed to production
- ✅ Data stored on-chain
- ✅ Verifiable independently
- ✅ No central database dependency

## Next Steps

Your app is live! Explore advanced patterns, build more features, and continue learning. Check out the "Next Steps" section for resources.
