# 🚀 Deployment Guide

This guide will walk you through deploying your Letterboxd Blend app to production.

## 📋 Prerequisites

- GitHub repository set up
- Supabase project configured
- Environment variables ready

## 🌐 Frontend Deployment (Vercel)

### 1. Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your `letterboxd-blend` repository

### 2. Configure Build Settings
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Environment Variables
Add these in Vercel dashboard:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=your_backend_url
```

### 4. Deploy
Click "Deploy" and wait for the build to complete!

## ⚙️ Backend Deployment (Render)

### 1. Connect to Render
1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click "New +" → "Web Service"
3. Connect your `letterboxd-blend` repository

### 2. Configure Service
- **Name**: `letterboxd-blend-backend` (or whatever you prefer)
- **Source Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `node index.cjs`
- **Plan**: Free (or choose paid if you need more resources)

### 3. Environment Variables
Add these in Render dashboard:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NODE_ENV=production
PORT=10000
```

**Note**: Render uses port 10000 by default, but your code expects 3001. The PORT env var will override this.

### 4. Deploy
Render will automatically deploy when you push to your main branch!

## 🔄 Alternative Backend Options

### Railway
- Similar to Render
- Free tier available (500 hours/month)
- Good for Node.js apps

### Heroku
- More established platform
- Free tier discontinued
- Good documentation

### DigitalOcean App Platform
- More control
- Pay-as-you-go pricing
- Good for scaling

## 🌍 Custom Domain (Optional)

1. **Buy a domain** (Namecheap, GoDaddy, etc.)
2. **Configure DNS** to point to your Vercel deployment
3. **Add domain** in Vercel dashboard
4. **Update backend URL** in your frontend environment variables

## 📊 Monitoring & Analytics

### Vercel Analytics
- Built-in performance monitoring
- Real user metrics
- Error tracking

### Railway Monitoring
- Logs and metrics
- Performance insights
- Error tracking

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **CORS**: Configure backend to only allow your frontend domain
3. **Rate Limiting**: Consider adding rate limiting to your API
4. **HTTPS**: Both Vercel and Railway provide HTTPS by default

## 🚨 Troubleshooting

### Frontend Build Fails
- Check Node.js version (needs 18+)
- Verify all dependencies are installed
- Check for TypeScript/ESLint errors

### Backend Won't Start
- Verify environment variables are set
- Check port configuration
- Look at Railway logs for errors

### Database Connection Issues
- Verify Supabase credentials
- Check if IP is whitelisted (if using IP restrictions)
- Ensure database is active

## 📈 Scaling Considerations

1. **Database**: Supabase scales automatically
2. **Backend**: Railway can scale vertically
3. **Frontend**: Vercel handles CDN and scaling
4. **Scraping**: Consider implementing queue systems for high traffic

## 💰 Cost Estimation

### Free Tier (Starting)
- **Vercel**: Free (100GB bandwidth/month)
- **Railway**: Free (500 hours/month)
- **Supabase**: Free (500MB database, 50MB file storage)

### Paid Plans (Growth)
- **Vercel**: $20/month (unlimited bandwidth)
- **Railway**: $5/month (unlimited hours)
- **Supabase**: $25/month (8GB database, 100GB file storage)

## 🎯 Next Steps

1. **Deploy frontend** to Vercel
2. **Deploy backend** to Railway
3. **Test the full flow** with real users
4. **Monitor performance** and errors
5. **Set up custom domain** (optional)
6. **Add analytics** and monitoring

---

Happy deploying! 🚀
