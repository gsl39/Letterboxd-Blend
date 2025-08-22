# 🎬 Letterboxd Blend

A web application that calculates cinematic compatibility between Letterboxd users, helping you discover shared movie tastes and find your cinematic soulmate.

## ✨ Features

- **Cinematic Compatibility Score**: Get a percentage-based compatibility score between two Letterboxd users
- **Shared Favorites**: Discover up to 4 movies that both users loved
- **Biggest Disagreement**: Find the movie with the biggest rating difference between users
- **Obscurity Alignment**: See how aligned your taste in obscure vs. mainstream films is
- **Detailed Stats**: View common genres, directors, rating differences, and more
- **Beautiful UI**: Modern, animated interface with smooth transitions and gradients

## 🚀 Live Demo

[Coming Soon - Deploy to Vercel/Netlify]

## 🛠️ Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Database**: Supabase (PostgreSQL)
- **Scraping**: Puppeteer + Cheerio + Axios
- **Deployment**: Vercel (Frontend) + Railway/Render (Backend)

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Letterboxd account

## 🔧 Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/letterboxd-blend.git
cd letterboxd-blend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Set up Supabase
- Create a new Supabase project
- Run the SQL scripts in `database/` folder to create tables
- Update your `.env` file with the credentials

### 5. Start the development servers

**Frontend (Port 5173):**
```bash
npm run dev
```

**Backend (Port 3001):**
```bash
cd server
node index.cjs
```

## 🗄️ Database Schema

The app uses these main tables:
- `users`: Letterboxd user information
- `films`: Movie metadata (title, year, director, genres, popularity)
- `user_films`: User ratings and watch history
- `blends`: Compatibility calculations between user pairs

## 🔍 How It Works

1. **User Input**: Two users enter their Letterboxd handles
2. **Data Scraping**: The backend scrapes movie data from Letterboxd
3. **Compatibility Calculation**: Algorithms analyze rating patterns, genre preferences, and film obscurity
4. **Results Display**: Beautiful UI shows compatibility score, shared favorites, and detailed stats

## 🚀 Deployment

### Frontend (Vercel)
1. Connect your GitHub repo to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables in Vercel dashboard

### Backend (Railway/Render)
1. Connect your GitHub repo
2. Set build command: `npm install`
3. Set start command: `cd server && node index.cjs`
4. Add environment variables in dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Letterboxd for the amazing platform
- Supabase for the database infrastructure
- The React and Node.js communities

## 📧 Contact

- **Creator**: Guilherme Lima
- **GitHub**: [@yourusername](https://github.com/yourusername)
- **Project**: [Letterboxd Blend](https://github.com/yourusername/letterboxd-blend)

---

Made with ❤️ for movie lovers everywhere
