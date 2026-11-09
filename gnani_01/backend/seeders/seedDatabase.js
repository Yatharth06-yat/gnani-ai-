const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Issue = require('../models/Issue');

dotenv.config();

const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Issue.deleteMany({});
    console.log('🗑️ Cleared existing data');

    // Create demo users
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@swachhmap.com',
      password: 'admin123',
      role: 'admin'
    });

    const citizenUser = new User({
      name: 'John Citizen',
      email: 'john@example.com',
      password: 'citizen123',
      role: 'citizen',
      phone: '+1234567890',
      address: {
        street: '123 Main St',
        city: 'Delhi',
        state: 'Delhi',
        zipCode: '110001'
      }
    });

    const officialUser = new User({
      name: 'City Official',
      email: 'official@city.gov',
      password: 'official123',
      role: 'official'
    });

    await adminUser.save();
    await citizenUser.save();
    await officialUser.save();
    console.log('👥 Created demo users');

    // Create demo issues
    const issues = [
      {
        title: 'Broken Street Light on Main Street',
        description: 'The street light has been broken for 3 days, causing safety concerns for pedestrians and drivers.',
        category: 'Infrastructure',
        status: 'Reported',
        priority: 'High',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139],
          address: 'Main Street, Connaught Place, New Delhi'
        },
        reportedBy: citizenUser._id
      },
      {
        title: 'Garbage Overflow Near Park',
        description: 'The garbage bin near Central Park is overflowing and attracting pests.',
        category: 'Sanitation',
        status: 'In-progress',
        priority: 'Medium',
        location: {
          type: 'Point',
          coordinates: [77.2100, 28.6150],
          address: 'Central Park, Lodi Gardens, New Delhi'
        },
        reportedBy: citizenUser._id,
        assignedTo: officialUser._id
      },
      {
        title: 'Pothole on Highway',
        description: 'Large pothole causing vehicle damage on the main highway.',
        category: 'Roads',
        status: 'Resolved',
        priority: 'Critical',
        location: {
          type: 'Point',
          coordinates: [77.2080, 28.6120],
          address: 'NH-1, Outer Ring Road, New Delhi'
        },
        reportedBy: citizenUser._id,
        assignedTo: officialUser._id,
        resolvedAt: new Date()
      },
      {
        title: 'Water Pipe Leakage',
        description: 'Water pipe leaking near residential area, wasting precious water.',
        category: 'Water',
        status: 'Reported',
        priority: 'High',
        location: {
          type: 'Point',
          coordinates: [77.2110, 28.6160],
          address: 'Residential Block A, Vasant Kunj, New Delhi'
        },
        reportedBy: citizenUser._id
      },
      {
        title: 'Illegal Dumping Site',
        description: 'Construction waste being dumped illegally in the vacant lot.',
        category: 'Sanitation',
        status: 'Reported',
        priority: 'Medium',
        location: {
          type: 'Point',
          coordinates: [77.2130, 28.6180],
          address: 'Vacant Lot, Sector 15, Dwarka, New Delhi'
        },
        reportedBy: citizenUser._id
      }
    ];

    for (const issueData of issues) {
      const issue = new Issue(issueData);
      await issue.save();
    }

    console.log('📋 Created demo issues');
    console.log('✅ Database seeding completed successfully!');
    
    console.log('\n🔐 Demo Login Credentials:');
    console.log('Admin: admin@swachhmap.com / admin123');
    console.log('Citizen: john@example.com / citizen123');
    console.log('Official: official@city.gov / official123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedData();