# PACE App - Netlify Deployment Guide

## ✅ Pre-Deployment Checklist

### Build & Configuration
- [x] Build process works (`npm run build`)
- [x] `netlify.toml` configured for SPA routing
- [x] Environment variables properly configured
- [x] API keys moved to environment variables
- [x] Firebase configuration set up

### Security
- [x] No hardcoded API keys in source code
- [x] Sensitive data moved to environment variables
- [x] `.env` file excluded from git (in .gitignore)

## 🚀 Netlify Deployment Steps

### 1. Environment Variables Setup in Netlify
After deploying to Netlify, you need to add these environment variables in your Netlify dashboard:

**Site Settings > Environment Variables > Add Variable:**

```
REACT_APP_GOOGLE_API_KEY=your_actual_google_ai_api_key
```

### 2. Deploy Options

#### Option A: Git Integration (Recommended)
1. Push your code to GitHub/GitLab
2. Connect Netlify to your repository
3. Set build command: `npm run build`
4. Set publish directory: `build`
5. Add environment variables in Netlify dashboard

#### Option B: Manual Deploy
1. Run `npm run build` locally
2. Drag and drop the `build` folder to Netlify deploy area

### 3. Firebase Security Rules
Make sure your Firebase rules are properly configured for production.

### 4. Custom Domain (Optional)
Configure your custom domain in Netlify dashboard if needed.

## 🔧 Post-Deployment Testing

Test these features after deployment:
- [ ] User authentication (Google sign-in)
- [ ] Project creation and management
- [ ] Task management
- [ ] File uploads (bug reports)
- [ ] AI chatbot (requires API key)
- [ ] Real-time updates
- [ ] Mobile responsiveness

## 📝 Notes

- The AI chatbot will show a message if the API key is not configured
- All other features will work without the AI chatbot
- Firebase configuration is already included in the build
- SPA routing is handled by Netlify redirects

## 🔒 Security Considerations

- Never commit `.env` files to version control
- Use Netlify environment variables for production
- Consider implementing rate limiting for API calls
- Monitor Firebase usage and costs
