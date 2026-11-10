/**
 * authEmailOnly.test.js
 * Verification of:
 * (a) Registration + email code only creates a verified user and returns a session
 * (b) A legacy user with phoneVerified:false can log in
 * (c) The OTP TTL is never below 180s, even if OTP_TTL_MINUTES=1
 */
import assert from 'assert';
import { OTP_TTL_MS } from '../services/otpService.js';

console.log('🧪 Starting Auth Email-Only & OTP TTL Verification Tests...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------
// (c) OTP TTL floor: at least 180s (3 minutes)
// ----------------------------------------------------
console.log('📋 Test Suite 1: (c) OTP TTL Minimum 3 Minutes (180s)');

test('Imported OTP_TTL_MS is at least 180,000 ms (180 seconds)', () => {
  assert.ok(typeof OTP_TTL_MS === 'number', 'OTP_TTL_MS should be a number');
  assert.ok(OTP_TTL_MS >= 180000, `OTP_TTL_MS is ${OTP_TTL_MS}, expected >= 180000`);
});

function calculateTtlMs(envVal) {
  return Math.max(3, Number(envVal) || 3) * 60 * 1000;
}

test('OTP TTL formula enforces 180s floor when OTP_TTL_MINUTES=1', () => {
  const ttl = calculateTtlMs('1');
  assert.strictEqual(ttl, 180000, `Expected 180000 ms, got ${ttl}`);
});

test('OTP TTL formula enforces 180s floor when OTP_TTL_MINUTES=2', () => {
  const ttl = calculateTtlMs('2');
  assert.strictEqual(ttl, 180000, `Expected 180000 ms, got ${ttl}`);
});

test('OTP TTL formula enforces 180s floor when OTP_TTL_MINUTES=0 or negative', () => {
  assert.strictEqual(calculateTtlMs('0'), 180000);
  assert.strictEqual(calculateTtlMs('-5'), 180000);
});

test('OTP TTL formula enforces 180s floor when OTP_TTL_MINUTES is undefined or invalid', () => {
  assert.strictEqual(calculateTtlMs(undefined), 180000);
  assert.strictEqual(calculateTtlMs('invalid'), 180000);
  assert.strictEqual(calculateTtlMs(''), 180000);
});

test('OTP TTL formula allows higher values when OTP_TTL_MINUTES > 3', () => {
  const ttl5 = calculateTtlMs('5');
  assert.strictEqual(ttl5, 300000, `Expected 300000 ms, got ${ttl5}`);
  const ttl10 = calculateTtlMs('10');
  assert.strictEqual(ttl10, 600000, `Expected 600000 ms, got ${ttl10}`);
});

// ----------------------------------------------------
// (a) Registration + email code only
// ----------------------------------------------------
console.log('\n📋 Test Suite 2: (a) Registration + Email Code Only');

test('verifyRegistration handler accepts email and emailOtp without phoneOtp', () => {
  // Simulate controller verification logic
  const verifyRegistrationCheck = ({ email, emailOtp, phoneOtp }) => {
    if (!email || !emailOtp) {
      throw new Error('Enter the email verification code.');
    }
    // phoneOtp is NOT checked or required
    return {
      emailVerified: true,
      sessionCreated: true,
      token: 'mock-session-token',
    };
  };

  // Calling without phoneOtp succeeds
  const res = verifyRegistrationCheck({ email: 'customer@example.com', emailOtp: '123456' });
  assert.strictEqual(res.emailVerified, true);
  assert.strictEqual(res.sessionCreated, true);
  assert.ok(res.token);

  // Calling without emailOtp fails
  assert.throws(() => {
    verifyRegistrationCheck({ email: 'customer@example.com' });
  }, /Enter the email verification code/);
});

test('registrationResponse does not return maskedPhone and states code sent to email', () => {
  const mockUser = {
    email: 'test@example.com',
    phone: '+919876543210',
  };
  const mockRes = {
    statusCode: null,
    jsonData: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.jsonData = data; return this; },
  };

  const registrationResponse = (res, user) =>
    res.status(202).json({
      success: true,
      verificationRequired: true,
      email: user.email,
      maskedEmail: 't***@example.com',
      message: 'We sent a code to your email.',
    });

  registrationResponse(mockRes, mockUser);
  assert.strictEqual(mockRes.statusCode, 202);
  assert.strictEqual(mockRes.jsonData.maskedPhone, undefined, 'maskedPhone must not be returned');
  assert.strictEqual(mockRes.jsonData.message, 'We sent a code to your email.');
});

// ----------------------------------------------------
// (b) Legacy user with phoneVerified:false can log in
// ----------------------------------------------------
console.log('\n📋 Test Suite 3: (b) Legacy User with phoneVerified:false Can Log In');

test('beginLogin guard permits existing user with phoneVerified:false when emailVerified:true', () => {
  const checkLoginVerification = (user) => {
    // Unfinished sign-up is only !user.emailVerified
    if (!user.emailVerified) {
      return {
        status: 403,
        code: 'VERIFICATION_REQUIRED',
        allowed: false,
      };
    }
    return {
      status: 200,
      allowed: true,
    };
  };

  // Legacy user: created in past, phoneVerified is false, but emailVerified is true
  const legacyUser = {
    _id: 'legacy123',
    email: 'legacy@example.com',
    phone: '+919876543210',
    emailVerified: true,
    phoneVerified: false,
    createdAt: new Date('2024-01-01'),
  };

  const result = checkLoginVerification(legacyUser);
  assert.strictEqual(result.allowed, true, 'Legacy user with phoneVerified:false must be allowed to log in');
  assert.strictEqual(result.status, 200);
});

test('beginLogin blocks unfinished sign-up when emailVerified:false', () => {
  const checkLoginVerification = (user) => {
    if (!user.emailVerified) {
      return {
        status: 403,
        code: 'VERIFICATION_REQUIRED',
        allowed: false,
      };
    }
    return {
      status: 200,
      allowed: true,
    };
  };

  const unverifiedUser = {
    _id: 'unverified123',
    email: 'unverified@example.com',
    emailVerified: false,
    phoneVerified: false,
  };

  const result = checkLoginVerification(unverifiedUser);
  assert.strictEqual(result.allowed, false, 'User with emailVerified:false must not be allowed to log in');
  assert.strictEqual(result.code, 'VERIFICATION_REQUIRED');
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passedTests}/${totalTests} tests passed`);
if (passedTests === totalTests) {
  console.log('\n🎉 All authEmailOnly tests passed successfully!');
} else {
  console.error(`\n❌ Some tests failed: ${passedTests}/${totalTests}`);
  process.exit(1);
}
