import User from '../models/User.js';
import CreditBalance from '../models/CreditBalance.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { getDefaultCreditsForRole } from '../services/creditService.js';

/**
 * Ensures a root admin account exists based on environment variables (ADMIN_EMAIL, ADMIN_PASSWORD).
 * If the admin does not exist, it is created automatically as root admin.
 * If the admin exists, its role and isRootAdmin flag are verified.
 */
export const ensureAdminUser = async () => {
  const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : 'admin@svara.in';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const adminName = process.env.ADMIN_NAME || 'SVARA Root Admin';
  const defaultAdminCredits = getDefaultCreditsForRole('admin');

  try {
    let admin = await User.findOne({ email: adminEmail }).select('+password');

    if (!admin) {
      console.log(`👑 Creating initial root admin account for ${adminEmail}...`);
      admin = await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        isRootAdmin: true,
        emailVerified: true,
        sellerStatus: 'none',
      });

      // Ensure credit balance exists for admin
      await CreditBalance.findOneAndUpdate(
        { userId: admin._id },
        { $setOnInsert: { balance: defaultAdminCredits, reservedBalance: 0 } },
        { upsert: true, new: true }
      );

      console.log(`✅ Root Admin account initialized: ${adminEmail}`);
    } else {
      let modified = false;

      if (!admin.emailVerified) {
        admin.emailVerified = true;
        modified = true;
      }

      // Ensure role is admin and isRootAdmin is true
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        modified = true;
      }

      if (!admin.isRootAdmin) {
        admin.isRootAdmin = true;
        modified = true;
      }

      if (admin.isBlocked) {
        admin.isBlocked = false;
        modified = true;
      }

      // If manual reset is explicitly requested via FORCE_ADMIN_PASSWORD_RESET=true, synchronize it.
      if (process.env.FORCE_ADMIN_PASSWORD_RESET === 'true') {
        const passwordMatches = await admin.comparePassword(adminPassword);
        if (!passwordMatches) {
          console.log(`🔐 Updating admin password via FORCE_ADMIN_PASSWORD_RESET for ${adminEmail}...`);
          admin.password = adminPassword;
          modified = true;
        }
      }

      if (modified) {
        await admin.save();
        console.log(`✅ Root Admin account updated successfully: ${adminEmail}`);
      }

      // Ensure credit balance exists and matches configured default admin credits if not purchased/spent
      const txCount = await CreditTransaction.countDocuments({ userId: admin._id });
      if (txCount === 0) {
        await CreditBalance.findOneAndUpdate(
          { userId: admin._id },
          { $set: { balance: defaultAdminCredits }, $setOnInsert: { reservedBalance: 0 } },
          { upsert: true, new: true }
        );
      } else {
        await CreditBalance.findOneAndUpdate(
          { userId: admin._id },
          { $setOnInsert: { balance: defaultAdminCredits, reservedBalance: 0 } },
          { upsert: true, new: true }
        );
      }
    }
  } catch (err) {
    console.error('⚠️ Could not initialize/verify root admin account:', err.message);
  }
};
