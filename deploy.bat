@echo off

echo 🚀 Starting deployment process...

echo 📦 Installing dependencies...
cd server && npm install
cd ..\client && npm install

echo 🔧 Building client...
cd client && npm run build

echo ✅ Ready for deployment!
echo.
echo 📋 Next steps:
echo 1. Deploy backend: cd server ^&^& vercel --prod
echo 2. Set environment variables in Vercel dashboard
echo 3. Deploy frontend: cd client ^&^& vercel --prod
echo 4. Update CORS settings with actual URLs
echo.
echo 🔗 Important URLs to check:
echo - Backend health: https://your-backend.vercel.app/health
echo - Backend debug: https://your-backend.vercel.app/debug
