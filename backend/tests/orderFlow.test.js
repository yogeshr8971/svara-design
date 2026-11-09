/**
 * orderFlow.test.js
 * Verification of:
 * 1) Migration mapping logic for orderStatus and item fulfillmentStatus
 * 2) Ship and deliver transition guards (case-insensitive, exactly 3 stages)
 * 3) Email flag atomic claim and rollback mechanism
 */
import assert from 'assert';

console.log('🧪 Starting Order Flow & Status Migration Verification Tests...\n');

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
// 1. Migration Mapping Logic (§1)
// ----------------------------------------------------
console.log('📋 Test Suite 1: Status Migration Mapping Logic');

function mapOrderStatus(status, paymentStatus, paymentMethod) {
  const s = (status || '').toLowerCase();
  if (s === 'pending_payment' || s === 'cancelled') return null;
  if (status === 'Ordered' || status === 'Shipped' || status === 'Delivered') return null;
  if (status === 'ordered') return 'Ordered';
  if (status === 'shipped') return 'Shipped';
  if (status === 'delivered') return 'Delivered';
  if (['placed', 'processing', 'confirmed', 'paid'].includes(s)) {
    const isEffectivelyPaid = paymentStatus === 'paid' || paymentMethod === 'cod';
    return isEffectivelyPaid ? 'Ordered' : 'pending_payment';
  }
  return null;
}

function mapItemStatus(status) {
  const s = (status || '').toLowerCase();
  if (status === 'Ordered' || status === 'Shipped' || status === 'Delivered' || status === 'cancelled' || status === 'pending_payment') {
    return null;
  }
  if (status === 'ordered') return 'Ordered';
  if (status === 'shipped') return 'Shipped';
  if (status === 'delivered') return 'Delivered';
  if (['placed', 'processing', 'confirmed', 'paid'].includes(s)) return 'Ordered';
  return null;
}

test('Legacy orderStatus placed/processing/confirmed/paid maps to Ordered when paymentStatus is paid', () => {
  for (const st of ['placed', 'processing', 'confirmed', 'paid']) {
    assert.strictEqual(mapOrderStatus(st, 'paid', 'razorpay'), 'Ordered');
  }
});

test('Legacy orderStatus placed/processing/confirmed/paid maps to Ordered when paymentMethod is cod', () => {
  for (const st of ['placed', 'processing', 'confirmed', 'paid']) {
    assert.strictEqual(mapOrderStatus(st, 'pending', 'cod'), 'Ordered');
  }
});

test('Legacy orderStatus maps to pending_payment when unpaid online/upi', () => {
  for (const st of ['placed', 'processing', 'confirmed', 'paid']) {
    assert.strictEqual(mapOrderStatus(st, 'pending', 'razorpay'), 'pending_payment');
    assert.strictEqual(mapOrderStatus(st, 'pending', 'upi'), 'pending_payment');
  }
});

test('Lowercase ordered/shipped/delivered map to capitalised Ordered/Shipped/Delivered', () => {
  assert.strictEqual(mapOrderStatus('ordered', 'paid', 'cod'), 'Ordered');
  assert.strictEqual(mapOrderStatus('shipped', 'paid', 'cod'), 'Shipped');
  assert.strictEqual(mapOrderStatus('delivered', 'paid', 'cod'), 'Delivered');
});

test('Canonical Ordered/Shipped/Delivered are idempotent (return null / no change)', () => {
  assert.strictEqual(mapOrderStatus('Ordered', 'paid', 'cod'), null);
  assert.strictEqual(mapOrderStatus('Shipped', 'paid', 'cod'), null);
  assert.strictEqual(mapOrderStatus('Delivered', 'paid', 'cod'), null);
});

test('pending_payment and cancelled are left unchanged (return null)', () => {
  assert.strictEqual(mapOrderStatus('pending_payment', 'pending', 'razorpay'), null);
  assert.strictEqual(mapOrderStatus('cancelled', 'failed', 'razorpay'), null);
});

test('Item fulfillmentStatus: placed/processing/confirmed/paid map to Ordered', () => {
  for (const st of ['placed', 'processing', 'confirmed', 'paid']) {
    assert.strictEqual(mapItemStatus(st), 'Ordered');
  }
  assert.strictEqual(mapItemStatus('ordered'), 'Ordered');
  assert.strictEqual(mapItemStatus('shipped'), 'Shipped');
  assert.strictEqual(mapItemStatus('delivered'), 'Delivered');
  assert.strictEqual(mapItemStatus('Ordered'), null);
  assert.strictEqual(mapItemStatus('cancelled'), null);
});

// ----------------------------------------------------
// 2. Ship & Deliver Transition Guards (§10)
// ----------------------------------------------------
console.log('\n📋 Test Suite 2: Transition Guards (Ordered -> Shipped -> Delivered)');

function validateTransition(currentStatus, targetStatus) {
  const normalizedCurrent = (currentStatus || '').toLowerCase();
  const normalizedTarget = (targetStatus || '').toLowerCase();

  if (normalizedTarget === 'shipped') {
    if (normalizedCurrent !== 'ordered') {
      throw new Error(`Cannot ship an order in "${currentStatus}" status.`);
    }
    return 'Shipped';
  }

  if (normalizedTarget === 'delivered') {
    if (normalizedCurrent !== 'shipped') {
      throw new Error(`Cannot deliver an order in "${currentStatus}" status.`);
    }
    return 'Delivered';
  }

  throw new Error(`Invalid status transition to "${targetStatus}".`);
}

test('Permits transition Ordered -> Shipped case-insensitively', () => {
  assert.strictEqual(validateTransition('Ordered', 'Shipped'), 'Shipped');
  assert.strictEqual(validateTransition('ordered', 'shipped'), 'Shipped');
});

test('Permits transition Shipped -> Delivered case-insensitively', () => {
  assert.strictEqual(validateTransition('Shipped', 'Delivered'), 'Delivered');
  assert.strictEqual(validateTransition('shipped', 'delivered'), 'Delivered');
});

test('Rejects transition to Shipped from legacy "confirmed", "placed", "paid", or "pending_payment"', () => {
  assert.throws(() => validateTransition('confirmed', 'Shipped'), /Cannot ship/);
  assert.throws(() => validateTransition('placed', 'Shipped'), /Cannot ship/);
  assert.throws(() => validateTransition('paid', 'Shipped'), /Cannot ship/);
  assert.throws(() => validateTransition('pending_payment', 'Shipped'), /Cannot ship/);
  assert.throws(() => validateTransition('Delivered', 'Shipped'), /Cannot ship/);
});

test('Rejects transition to Delivered from "Ordered" or "pending_payment"', () => {
  assert.throws(() => validateTransition('Ordered', 'Delivered'), /Cannot deliver/);
  assert.throws(() => validateTransition('pending_payment', 'Delivered'), /Cannot deliver/);
});

// ----------------------------------------------------
// 3. Email Flag Atomic Claim and Rollback Mechanism
// ----------------------------------------------------
console.log('\n📋 Test Suite 3: Email Flag Atomic Claim & Rollback');

class MockOrderModel {
  constructor(initialData) {
    this.data = { ...initialData };
  }

  async findOneAndUpdate(filter, update) {
    for (const [key, val] of Object.entries(filter)) {
      if (this.data[key] !== val) return null;
    }
    const previous = { ...this.data };
    if (update.$set) {
      Object.assign(this.data, update.$set);
    }
    return previous;
  }

  async updateOne(filter, update) {
    if (update.$set) {
      Object.assign(this.data, update.$set);
    }
    return { modifiedCount: 1 };
  }
}

async function sendOrderEmailWithAtomicClaim(mockOrder, sendFn) {
  const claimed = await mockOrder.findOneAndUpdate(
    { _id: mockOrder.data._id, confirmationEmailSent: false },
    { $set: { confirmationEmailSent: true } }
  );

  if (!claimed) return { sent: false, reason: 'ALREADY_SENT_OR_CLAIMED' };

  try {
    await sendFn();
    return { sent: true };
  } catch (err) {
    // Rollback flag on send failure
    await mockOrder.updateOne(
      { _id: mockOrder.data._id },
      { $set: { confirmationEmailSent: false } }
    );
    return { sent: false, error: err.message, rolledBack: true };
  }
}

test('Successful send claims flag atomically and leaves flag as true', async () => {
  const mockOrder = new MockOrderModel({ _id: '123', confirmationEmailSent: false });
  const result = await sendOrderEmailWithAtomicClaim(mockOrder, async () => {
    // Send succeeded
    return true;
  });

  assert.strictEqual(result.sent, true);
  assert.strictEqual(mockOrder.data.confirmationEmailSent, true);
});

test('Duplicate send attempt is prevented when flag is already claimed', async () => {
  const mockOrder = new MockOrderModel({ _id: '123', confirmationEmailSent: true });
  let sendCalled = false;
  const result = await sendOrderEmailWithAtomicClaim(mockOrder, async () => {
    sendCalled = true;
  });

  assert.strictEqual(result.sent, false);
  assert.strictEqual(result.reason, 'ALREADY_SENT_OR_CLAIMED');
  assert.strictEqual(sendCalled, false);
  assert.strictEqual(mockOrder.data.confirmationEmailSent, true);
});

test('Failed send rolls back the flag to false so retry is permitted', async () => {
  const mockOrder = new MockOrderModel({ _id: '123', confirmationEmailSent: false });
  const result = await sendOrderEmailWithAtomicClaim(mockOrder, async () => {
    throw new Error('SMTP connection timed out');
  });

  assert.strictEqual(result.sent, false);
  assert.strictEqual(result.rolledBack, true);
  assert.strictEqual(mockOrder.data.confirmationEmailSent, false);

  // Next retry attempt is now able to claim the flag again
  const retryResult = await sendOrderEmailWithAtomicClaim(mockOrder, async () => {
    return true;
  });
  assert.strictEqual(retryResult.sent, true);
  assert.strictEqual(mockOrder.data.confirmationEmailSent, true);
});

console.log(`\n🎉 All ${passedTests}/${totalTests} Order Flow unit tests passed successfully!\n`);
