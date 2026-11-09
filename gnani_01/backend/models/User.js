const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['citizen', 'admin', 'official'],
    default: 'citizen'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const RealUser = mongoose.model('User', userSchema);

// ── In-Memory Users Store (fallback when MongoDB is disconnected) ──
class InMemoryUser {
  constructor(data = {}) {
    Object.assign(this, {
      name: 'User',
      email: '',
      role: 'citizen',
      isActive: true,
      ...data
    });
    if (!this._id) {
      this._id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }
  }

  async comparePassword(candidatePassword) {
    if (this.plainPassword && candidatePassword === this.plainPassword) return true;
    if (this.password) {
      try {
        return await bcrypt.compare(candidatePassword, this.password);
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  async save() {
    if (this.password && !this.password.startsWith('$2')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    const idx = inMemoryUsers.findIndex(u => u.email === this.email || u._id === this._id);
    if (idx >= 0) {
      inMemoryUsers[idx] = this;
    } else {
      inMemoryUsers.push(this);
    }
    return this;
  }

  toObject() {
    const copy = { ...this };
    delete copy.plainPassword;
    return copy;
  }

  toJSON() {
    const copy = { ...this };
    delete copy.password;
    delete copy.plainPassword;
    return copy;
  }
}

const inMemoryUsers = [
  new InMemoryUser({
    _id: 'admin_user_001',
    name: 'SwachhMap System Administrator',
    email: 'admin@demo.com',
    plainPassword: 'password123',
    role: 'admin',
    isActive: true
  }),
  new InMemoryUser({
    _id: 'admin_user_002',
    name: 'SwachhMap System Administrator',
    email: 'admin@swachhmap.gov.in',
    plainPassword: 'password123',
    role: 'admin',
    isActive: true
  }),
  new InMemoryUser({
    _id: 'citizen_user_001',
    name: 'Citizen Demo User',
    email: 'citizen@demo.com',
    plainPassword: 'password123',
    role: 'citizen',
    isActive: true
  })
];

const isDbConnected = () => Boolean(mongoose.connection && mongoose.connection.readyState === 1);

function makeQuery(result) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    lean() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    catch(reject) { return Promise.resolve(result).catch(reject); }
  };
}

function UserProxy(data) {
  if (isDbConnected()) {
    try {
      return new RealUser(data);
    } catch (_) {}
  }
  return new InMemoryUser(data);
}

UserProxy.prototype = RealUser.prototype;

UserProxy.findOne = function(query) {
  if (isDbConnected()) {
    try {
      return RealUser.findOne(query);
    } catch (_) {}
  }
  const email = query.email ? String(query.email).toLowerCase() : null;
  const found = email ? inMemoryUsers.find(u => u.email.toLowerCase() === email) : inMemoryUsers[0];
  return makeQuery(found ? Object.assign(new InMemoryUser(), found) : null);
};

UserProxy.findById = function(id) {
  if (isDbConnected()) {
    try {
      return RealUser.findById(id);
    } catch (_) {}
  }
  const idStr = String(id);
  const found = inMemoryUsers.find(u => String(u._id) === idStr || String(u.id) === idStr) || inMemoryUsers[0];
  return makeQuery(found ? Object.assign(new InMemoryUser(), found) : null);
};

UserProxy.countDocuments = async function() {
  if (isDbConnected()) {
    try {
      return await RealUser.countDocuments();
    } catch (_) {}
  }
  return inMemoryUsers.length;
};

UserProxy.schema = userSchema;

module.exports = UserProxy;