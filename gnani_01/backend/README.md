# SwachhMap Backend

## 📁 Project Structure

### Main Files
- **server.js** - Main Express server (runs on port 8002)
- **server-db.js** - Database-enabled server with MongoDB support
- **package.json** - Project dependencies and scripts
- **.env** - Environment variables (MongoDB URI, JWT secret, etc.)
- **SETUP.md** - Setup instructions for the backend

### Directories

#### `/config`
- **db.js** - MongoDB connection configuration

#### `/controllers`
- **authController.js** - Authentication logic (login, register, profile)
- **issueController.js** - Issue management logic (CRUD operations)

#### `/middleware`
- **auth.js** - Authentication middleware (JWT verification, role-based access)

#### `/models`
- **User.js** - User schema and model
- **Issue.js** - Issue schema and model with geospatial support

#### `/routes`
- **auth.js** - Authentication routes
- **issueRoutes.js** - Issue management routes

#### `/seeders`
- **seedDatabase.js** - Database seeding script for demo data

#### `/scripts`
- **seedUsers.js** - User seeding utility

#### `/utils`
- **jwt.js** - JWT token generation and verification
- **cloudinary.js** - Image upload utilities

## 🚀 Available Scripts

```bash
# Start the main server (port 8002)
npm start

# Start with nodemon (auto-restart on changes)
npm run dev

# Start database-enabled server
npm run db

# Seed the database with demo data
npm run seed
```

## 🔧 Current Setup

The application currently uses **server.js** which provides:
- Issue reporting endpoints
- Issue management (CRUD)
- Admin statistics
- Demo mode (no database required)

## 📊 API Endpoints

### Issues
- `GET /api/issues` - Get all issues
- `POST /api/issues` - Create new issue
- `PUT /api/issues/:id` - Update issue status
- `DELETE /api/issues/:id` - Delete issue
- `GET /api/issues/my-reports` - Get user's reports
- `GET /api/issues/admin/stats` - Get admin statistics

## 🗄️ Database Setup (Optional)

To use the full database functionality:

1. Install MongoDB
2. Update `.env` with your MongoDB URI
3. Run `npm run seed` to populate demo data
4. Use `npm run db` to start the database-enabled server

## 🎯 Demo Mode

The current `server.js` runs in demo mode:
- No database required
- In-memory data storage
- Perfect for testing and development
- All features work without MongoDB

## 📝 Notes

- Frontend authentication is handled locally (no API calls)
- Backend provides issue management endpoints
- Database models are ready for production use
- All unused server files have been removed for clarity
