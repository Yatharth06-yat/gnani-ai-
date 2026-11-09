# SwachhMap Backend Setup

## Database Setup Options

### Option 1: Install MongoDB Locally (Recommended)

1. **Install MongoDB using Homebrew:**
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   ```

2. **Start MongoDB:**
   ```bash
   brew services start mongodb/brew/mongodb-community
   ```

3. **Seed the database:**
   ```bash
   npm run seed
   ```

4. **Start the database-enabled server:**
   ```bash
   npm run db
   ```

### Option 2: Use MongoDB Atlas (Cloud)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account and cluster
3. Get your connection string
4. Update `.env` file:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/swachhmap
   ```

### Option 3: Continue with Demo Mode

The server will automatically fall back to demo mode if MongoDB is not available.

## Environment Variables

Make sure your `.env` file contains:
```
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/swachhmap
JWT_SECRET=Hostallife@1234
```

## Demo Login Credentials

After seeding the database:
- **Admin:** admin@swachhmap.com / admin123
- **Citizen:** john@example.com / citizen123
- **Official:** official@city.gov / official123

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `GET /api/issues` - Get all issues
- `POST /api/issues` - Create new issue (requires auth)
- `PUT /api/issues/:id` - Update issue (admin/official only)
- `DELETE /api/issues/:id` - Delete issue (admin only)
- `GET /api/issues/my-reports` - Get user's reports (requires auth)
- `GET /api/issues/admin/stats` - Get admin statistics (admin only)