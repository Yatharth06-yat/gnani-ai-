const User = require('../models/User');

/**
 * Ensures at least one authorized system administrator exists in the database
 */
async function seedDefaultAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@swachhmap.gov.in';
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      console.log('🛡️ Creating default system administrator account:', adminEmail);
      const admin = new User({
        name: 'SwachhMap System Administrator',
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin',
        isActive: true
      });
      await admin.save();
      console.log('✅ Default administrator created successfully.');
    } else if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log('✅ Updated existing account role to admin:', adminEmail);
    }
  } catch (err) {
    console.warn('⚠️ Admin seed warning (continuing):', err.message);
  }
}

module.exports = { seedDefaultAdmin };

