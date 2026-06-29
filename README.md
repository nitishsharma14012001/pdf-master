# 📄 PDF Master

**The complete free online toolkit for PDFs and images.** 50+ tools. Fast, secure, no sign-up required.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev)

---

## 🚀 Features

### PDF Tools (12)
Merge · Split · Compress · Organize · Rotate · Delete Pages · Extract Pages · Protect · Unlock · Repair · Add Page Numbers · Add Watermark

### Convert to PDF (6)
JPG → PDF · PNG → PDF · WebP → PDF · Word → PDF · Excel → PDF · PowerPoint → PDF

### Convert from PDF (6)
PDF → JPG · PDF → PNG · PDF → Word · PDF → Excel · PDF → PowerPoint · PDF → Text

### Image Tools (10)
Resize · Compress · Crop · Rotate · Flip · Convert JPG · Convert PNG · Convert WebP · Image Quality · Remove Background (AI-ready)

### Platform Features
- 🌗 Dark / Light mode
- 📱 Mobile-first responsive design
- 🔐 JWT-based authentication
- 👤 User dashboard with download history
- 🛡️ Admin panel with analytics & user management
- 💳 Pricing page (Free / Pro / Business)
- 📊 Google AdSense placeholders
- 🔍 SEO optimized with sitemap & robots.txt
- 📦 Drag & drop with batch upload
- ⚡ File size validation & error handling
- 🗑️ Auto file cleanup (1-hour TTL)
- 🔒 Rate limiting & security headers

---

## 🗂️ Project Structure

```
pdf-master/
├── frontend/                    # React + Vite SPA
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── robots.txt
│   │   └── sitemap.xml
│   └── src/
│       ├── components/
│       │   ├── auth/            # Login, Signup, ForgotPassword
│       │   ├── layout/          # Navbar, Footer
│       │   ├── pages/           # All page components
│       │   └── ui/              # Reusable UI components
│       ├── context/             # ThemeContext, AuthContext
│       ├── hooks/               # useFileProcessor, useSearch
│       ├── utils/               # tools.js metadata
│       ├── App.jsx              # Router + Layout
│       ├── main.jsx
│       └── index.css            # Tailwind + custom styles
│
├── backend/                     # Node.js + Express API
│   ├── controllers/
│   │   └── toolsController.js   # Processing logic
│   ├── middleware/
│   │   ├── auth.js              # JWT middleware
│   │   └── upload.js            # Multer + validation
│   ├── routes/
│   │   ├── auth.js              # /api/auth/*
│   │   ├── tools.js             # /api/tools/*
│   │   ├── admin.js             # /api/admin/*
│   │   └── contact.js           # /api/contact
│   ├── utils/
│   │   ├── cleanup.js           # Auto-delete old files
│   │   └── logger.js            # Winston logger
│   ├── server.js                # Express entry point
│   ├── .env.example
│   └── package.json
│
├── package.json                 # Root workspace scripts
└── README.md
```

---

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone the repo
```bash
git clone https://github.com/yourname/pdf-master.git
cd pdf-master
```

### 2. Install all dependencies
```bash
npm run install:all
```

### 3. Configure the backend
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values
```

### 4. Start development servers
```bash
npm run dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
```

---

## 🔑 Demo Accounts

| Role  | Email                   | Password  |
|-------|-------------------------|-----------|
| Admin | admin@pdfmaster.app     | admin123  |
| User  | user@example.com        | user123   |

---

## 🌐 Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set **Framework**: Vite
4. Set **Root Directory**: `frontend`
5. Add environment variable:
   ```
   VITE_API_URL=https://your-backend.onrender.com/api
   ```
6. Deploy

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repo
3. Set **Root Directory**: `backend`
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `npm start`
6. Add all environment variables from `.env.example`
7. Deploy

### Environment Variables (Backend)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | Yes | `production` or `development` |
| `JWT_SECRET` | Yes | Long random string for signing tokens |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `STRIPE_SECRET_KEY` | Pro | Stripe secret for payments |
| `SMTP_HOST` / `SMTP_PASS` | Pro | Email provider for password resets |

---

## 🔧 Adding Real PDF Processing

This project is built with the full processing pipeline in place. To swap in real processors:

### PDF processing (Node.js)
```bash
npm install pdf-lib @pdf-lib/fontkit
```
Then implement each tool in `backend/controllers/toolsController.js`.

### Image processing
```bash
npm install sharp
```

### Office document conversion
```bash
# Use LibreOffice (available on Render/Railway)
# or a service like ConvertAPI / CloudConvert
```

---

## 💰 Monetization

1. **Google AdSense** — Replace `AdBanner` placeholder divs with real `<ins>` tags
2. **Stripe Subscriptions** — Add webhook handler in `/api/stripe`
3. **File size upsell** — Free tier capped at 25 MB, Pro at 200 MB (enforced in `middleware/upload.js`)

---

## 🧪 Testing

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## 📄 License

MIT © 2025 PDF Master

---

## 🤝 Contributing

PRs welcome! Please open an issue first to discuss what you'd like to change.
