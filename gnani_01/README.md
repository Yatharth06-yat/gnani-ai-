# 🗺️ SwachhMap AI 2.0 — Multilingual Voice-Powered Civic Intelligence & Smart Waste Management Platform

> *"From Citizen Voice to Verified Civic Action."*

SwachhMap AI 2.0 is a research-oriented, production-quality civic intelligence platform that transforms citizen voice reports and visual waste photographs into verified municipal action.

---

## ✨ Core Innovations & Features

1. **🎙️ Multilingual Voice Complaint Registration (Gnani AI)**:
   - **Gnani Prisma (STT)**: Voice-to-text recording supporting Hindi, English, and Hinglish.
   - **Gnani Evon 30B (NLU & Reasoning)**: Extracts structured complaint fields (summary, waste category, location landmark, duration, severity).
   - **Clarification Dialogue**: Generates intelligent clarifying questions when key information is missing.
   - **Gnani Timbre (TTS)**: Synthesizes natural spoken clarification questions and confirmation summaries.
   - **Transparent Adapter**: Operates in live mode with `GNANI_API_KEY` and features an offline rule-based parser when unconfigured.

2. **🤖 Dual Computer Vision Engine (FastAPI Microservice)**:
   - **Custom Binary CNN (`swachhmap_cnn_v2`)**: $224 \times 224$ MobileNetV2 architecture with threshold $0.67$ classifying garbage presence.
   - **Ultralytics YOLO11n (`yolo11n.pt`)**: Localizes 6 discrete waste classes (`plastic_bottle`, `plastic_bag`, `paper_cardboard`, `food_waste`, `mixed_garbage`, `construction_debris`) with bounding boxes and confidence scores.
   - **Model Agreement Layer**: Analyzes cross-model agreement (supporting, conflicting, or unsegmented waste suspected) and flags discrepancies for human review.

3. **🔍 Semantic Duplicate Complaint Detection**:
   - Compares new submissions against active reports using spatial Haversine distance ($\le 150\text{m}$) and textual Jaccard similarity.
   - Preserves every citizen's individual complaint while linking duplicates for municipal consolidation.

4. **🔥 Dynamic Garbage Hotspot Intelligence & Heatmap**:
   - Dynamic spatial clustering on Leaflet OpenStreetMap with time filters (`24h`, `7d`, `30d`, `All Time`).
   - Distinguishes civic reporting density from verified physical waste severity.

5. **⚖️ Explainable Complaint Prioritization**:
   - Multi-factor ranking: visual evidence quality, civic density, problem duration, and proximity to sensitive landmarks (schools, hospitals, transit corridors).
   - Returns explicit human-readable justifications for every priority score.

6. **🧹 AI-Assisted Resolution Verification**:
   - Closed-loop verification: compares before-cleaning and after-cleaning photographs using CNN and YOLO.
   - Warns administrators if residual waste is detected on site before closing the issue.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Leaflet, OpenStreetMap, Axios | Citizen dashboard, voice modal, live map, AI intelligence center |
| **Backend** | Node.js, Express, Mongoose, JWT, Cloudinary | Core REST APIs, session management, spatial analytics, fallback store |
| **AI Inference** | Python 3.13, FastAPI, Uvicorn, Torch, Ultralytics YOLO11n, Keras 3 | Computer vision classification, object localization, multimodal fusion |
| **Voice / NLU** | Gnani Prisma (STT), Evon 30B, Timbre (TTS) | Multilingual voice complaints, structured reasoning, speech synthesis |

---

## 🚀 Running the Platform

### Start All Services Simultaneously:
```bash
npm run dev
```
This runs:
- **Python FastAPI AI Engine** on `http://127.0.0.1:8000`
- **Node.js Express Server** on `http://localhost:8002`
- **React Frontend App** on `http://localhost:3000`

### Or Run Individual Services:
```bash
# 1. Start Python FastAPI AI Engine
python3 -m uvicorn ai_service.app.main:app --host 127.0.0.1 --port 8000

# 2. Start Node.js Express Backend
cd backend && node server.js

# 3. Start React Frontend
cd frontend && npm start
```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up MongoDB**
   - Install MongoDB locally
   - Start MongoDB service:
     ```bash
     # On macOS with Homebrew
     brew services start mongodb-community
     
     # On Ubuntu/Linux
     sudo systemctl start mongod
     
     # On Windows
     net start MongoDB
     ```

4. **Configure Environment Variables**
   
   Edit `backend/.env` file:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/swachhmap
   JWT_SECRET=your_jwt_secret_key_here_change_this_in_production
   CLOUDINARY_CLOUD_NAME=demo
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on http://localhost:5000
   - Frontend React app on http://localhost:3000

## 📋 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user & return JWT |
| GET | `/api/auth/me` | Get logged-in user |
| GET | `/api/issues` | Get all civic issues |
| POST | `/api/issues` | Report a new issue |
| PUT | `/api/issues/:id` | Update issue status |
| DELETE | `/api/issues/:id` | Delete issue (Admin only) |
| GET | `/api/issues/my-reports` | Get reports by logged-in user |
| GET | `/api/issues/admin/stats` | Get admin statistics |

## 🎯 Usage

### For Citizens

1. **Register/Login**: Create an account or sign in
2. **Report Issue**: 
   - Navigate to "Report Issue"
   - Fill in title, description, and category
   - Upload a photo (optional)
   - Allow location access for automatic coordinates
   - Submit the report
3. **Track Reports**: View your submitted reports in "My Reports"
4. **View Map**: See all community issues on the interactive map

### For Admins

1. **Login**: Use admin credentials
2. **Dashboard**: View statistics and all reported issues
3. **Manage Issues**: 
   - Update status (Reported → In-progress → Resolved)
   - Delete inappropriate reports
   - View detailed analytics
4. **Map View**: Monitor issues geographically

## 🗂️ Project Structure

```
SwachhMap/
├── backend/
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── issueController.js
│   ├── models/
│   │   ├── User.js
│   │   └── Issue.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── issueRoutes.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   └── utils/
│       └── cloudinary.js
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── MapComponent.jsx
│   │   │   ├── IssueCard.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Report.jsx
│   │   │   ├── Map.jsx
│   │   │   ├── MyReports.jsx
│   │   │   └── Admin.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   └── styles/
│   │       └── app.css
│   └── package.json
└── README.md
```

## 🎨 Issue Categories

- **🗑️ Garbage**: Overflowing bins, illegal dumping, waste management
- **🕳️ Potholes**: Road damage, broken pavements, traffic hazards
- **💧 Waterlogging**: Drainage issues, flooding, water stagnation
- **🚿 Sanitation**: Public toilet issues, sewage problems, hygiene

## 🔧 Configuration

### Cloudinary Setup (Optional)

1. Create a free account at [Cloudinary](https://cloudinary.com/)
2. Get your credentials from the dashboard
3. Update the `.env` file with your credentials
4. If not configured, images won't be uploaded but the app will still work

### MongoDB Setup

The app uses a local MongoDB database. Make sure MongoDB is running:

```bash
# Check if MongoDB is running
mongosh

# If not running, start it
# macOS: brew services start mongodb-community
# Ubuntu: sudo systemctl start mongod
# Windows: net start MongoDB
```

## 🚀 Deployment

### Backend Deployment
- Deploy to Heroku, Railway, or any Node.js hosting service
- Set environment variables in your hosting platform
- Use MongoDB Atlas for production database

### Frontend Deployment
- Build the React app: `npm run build`
- Deploy to Netlify, Vercel, or any static hosting service
- Update API URLs in production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📝 Demo Accounts

For testing purposes, you can create these demo accounts:

- **Admin**: admin@demo.com / password123
- **Citizen**: citizen@demo.com / password123

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running locally
   - Check the connection string in `.env`

2. **Location Not Working**
   - Enable location services in your browser
   - Use HTTPS in production for geolocation API

3. **Image Upload Failing**
   - Check Cloudinary credentials
   - Ensure file size is under 5MB

4. **Port Already in Use**
   - Change ports in package.json scripts
   - Kill existing processes: `lsof -ti:5000 | xargs kill`

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenStreetMap for free map tiles
- Leaflet.js for map functionality
- Cloudinary for image hosting
- MongoDB for database
- React.js community for excellent documentation

---

**Made with ❤️ for cleaner, smarter cities**