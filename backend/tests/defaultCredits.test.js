import assert from 'assert';
import { getDefaultCreditsForRole } from '../services/creditService.js';

console.log('🧪 Testing Default Credits Role Resolution via .env...');

// Save initial env
const initialUser = process.env.DEFAULT_USER_CREDITS;
const initialSeller = process.env.DEFAULT_SELLER_CREDITS;
const initialAdmin = process.env.DEFAULT_ADMIN_CREDITS;

try {
  // Test 1: Configured values from .env
  process.env.DEFAULT_USER_CREDITS = '15';
  process.env.DEFAULT_SELLER_CREDITS = '75';
  process.env.DEFAULT_ADMIN_CREDITS = '250';

  assert.strictEqual(getDefaultCreditsForRole('user'), 15, 'User credits should match DEFAULT_USER_CREDITS');
  assert.strictEqual(getDefaultCreditsForRole('seller'), 75, 'Seller credits should match DEFAULT_SELLER_CREDITS');
  assert.strictEqual(getDefaultCreditsForRole('admin'), 250, 'Admin credits should match DEFAULT_ADMIN_CREDITS');
  console.log('  ✅ [PASS] Resolves custom .env values for user (15), seller (75), admin (250)');

  // Test 2: Fallback values when env is undefined
  delete process.env.DEFAULT_USER_CREDITS;
  delete process.env.DEFAULT_SELLER_CREDITS;
  delete process.env.DEFAULT_ADMIN_CREDITS;
  delete process.env.DEFAULT_CREDITS_USER;
  delete process.env.DEFAULT_CREDITS_SELLER;
  delete process.env.DEFAULT_CREDITS_ADMIN;

  assert.strictEqual(getDefaultCreditsForRole('user'), 5, 'User credits should fall back to 5');
  assert.strictEqual(getDefaultCreditsForRole('seller'), 50, 'Seller credits should fall back to 50');
  assert.strictEqual(getDefaultCreditsForRole('admin'), 100, 'Admin credits should fall back to 100');
  console.log('  ✅ [PASS] Fallback values respected when env variables are unset: user=5, seller=50, admin=100');

  // Test 3: Zero or invalid strings
  process.env.DEFAULT_USER_CREDITS = '0';
  assert.strictEqual(getDefaultCreditsForRole('user'), 0, 'User credits can be configured as 0');
  process.env.DEFAULT_USER_CREDITS = '-10';
  assert.strictEqual(getDefaultCreditsForRole('user'), 0, 'Negative credits clamp to 0');
  console.log('  ✅ [PASS] Clamping and 0 values handled safely');

  console.log('\n🎉 Default credits tests passed successfully!');
} finally {
  // Restore initial env
  if (initialUser !== undefined) process.env.DEFAULT_USER_CREDITS = initialUser;
  if (initialSeller !== undefined) process.env.DEFAULT_SELLER_CREDITS = initialSeller;
  if (initialAdmin !== undefined) process.env.DEFAULT_ADMIN_CREDITS = initialAdmin;
}
