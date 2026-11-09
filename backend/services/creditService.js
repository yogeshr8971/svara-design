import CreditBalance from '../models/CreditBalance.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Resolves default credits for a specific role based on environment variables (.env).
 * Supported env vars:
 * - Customers/Users: DEFAULT_USER_CREDITS (fallback: 5)
 * - Sellers: DEFAULT_SELLER_CREDITS (fallback: 50)
 * - Admin(s): DEFAULT_ADMIN_CREDITS (fallback: 100)
 */
export const getDefaultCreditsForRole = (role) => {
  const normRole = String(role || 'user').toLowerCase().trim();
  if (normRole === 'admin') {
    const val = process.env.DEFAULT_ADMIN_CREDITS ?? process.env.DEFAULT_CREDITS_ADMIN;
    return val !== undefined && val !== '' ? Math.max(0, parseInt(val, 10) || 0) : 100;
  }
  if (normRole === 'seller') {
    const val = process.env.DEFAULT_SELLER_CREDITS ?? process.env.DEFAULT_CREDITS_SELLER;
    return val !== undefined && val !== '' ? Math.max(0, parseInt(val, 10) || 0) : 50;
  }
  const val = process.env.DEFAULT_USER_CREDITS ?? process.env.DEFAULT_CREDITS_USER;
  return val !== undefined && val !== '' ? Math.max(0, parseInt(val, 10) || 0) : 5;
};

/**
 * Ensures a user/seller/admin account has an initialized credit balance.
 * If the record is missing, creates it with default credits according to .env.
 * If the record exists with 0 balance and 0 transaction history (e.g. legacy or uncredited seller),
 * it grants the default credits consistently.
 */
export const ensureCreditBalance = async (userId, role = 'user') => {
  let record = await CreditBalance.findOne({ userId });
  const defaultCredits = getDefaultCreditsForRole(role);

  if (!record) {
    record = await CreditBalance.create({
      userId,
      balance: defaultCredits,
      reservedBalance: 0,
    });
    if (defaultCredits > 0) {
      const description = role === 'admin'
        ? 'Initial credits for admin'
        : role === 'seller'
          ? 'Initial credits for seller virtual try-on'
          : 'Welcome bonus credits for virtual try-on';
      await CreditTransaction.create({
        userId,
        amount: defaultCredits,
        type: 'BONUS',
        description,
        balanceAfter: defaultCredits,
      });
    }
  } else {
    // If the account has no transactions, its balance is purely default credits.
    // Sync with defaultCredits from .env if it differs.
    const txCount = await CreditTransaction.countDocuments({ userId });
    if (txCount === 0 && record.balance !== defaultCredits) {
      record.balance = defaultCredits;
      await record.save();
    }
  }
  return record;
};

/**
 * Reserve credits before AI call.
 * Atomically decrements balance and increments reservedBalance.
 */
export const reserveCredits = async (userId, amount, role = 'user') => {
  let current = await CreditBalance.findOne({ userId });
  if (!current) {
    current = await ensureCreditBalance(userId, role);
  }
  const updated = await CreditBalance.findOneAndUpdate(
    { userId, balance: { $gte: amount } },
    { $inc: { balance: -amount, reservedBalance: amount }, $set: { updatedAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    const available = current ? current.balance : 0;
    throw new ApiError(402, `Insufficient credits. You have ${available} credit(s), need ${amount}.`);
  }
  return updated;
};

/**
 * Consume reserved credits after successful AI generation.
 */
export const consumeReservedCredits = async (userId, amount, description, referenceId) => {
  const balance = await CreditBalance.findOneAndUpdate(
    { userId },
    { $inc: { reservedBalance: -amount }, $set: { updatedAt: new Date() } },
    { new: true }
  );
  await CreditTransaction.create({
    userId,
    amount: -amount,
    type: 'TRY_ON',
    description,
    referenceId,
    balanceAfter: balance.balance,
  });
};

/**
 * Refund reserved credits if AI generation fails.
 */
export const refundReservedCredits = async (userId, amount, description, referenceId) => {
  const balance = await CreditBalance.findOneAndUpdate(
    { userId },
    { $inc: { balance: amount, reservedBalance: -amount }, $set: { updatedAt: new Date() } },
    { new: true }
  );
  await CreditTransaction.create({
    userId,
    amount,
    type: 'REFUND',
    description,
    referenceId,
    balanceAfter: balance ? balance.balance : 0,
  });
};

/**
 * Add credits to a user's balance (after purchase or bonus).
 */
export const addCredits = async (userId, amount, description, referenceId) => {
  const balance = await CreditBalance.findOneAndUpdate(
    { userId },
    { $inc: { balance: amount }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  await CreditTransaction.create({
    userId,
    amount,
    type: 'PURCHASE',
    description,
    referenceId,
    balanceAfter: balance.balance,
  });
  return balance;
};

/**
 * Add bonus credits (e.g. welcome bonus).
 */
export const addBonusCredits = async (userId, amount, description) => {
  const balance = await CreditBalance.findOneAndUpdate(
    { userId },
    { $inc: { balance: amount }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  await CreditTransaction.create({
    userId,
    amount,
    type: 'BONUS',
    description,
    balanceAfter: balance.balance,
  });
  return balance;
};

/**
 * Get current credit balance for a user.
 */
export const getBalance = async (userId, role = 'user') => {
  let bal = await CreditBalance.findOne({ userId });
  const defaultCredits = getDefaultCreditsForRole(role);
  if (!bal) {
    bal = await ensureCreditBalance(userId, role);
  } else {
    const txCount = await CreditTransaction.countDocuments({ userId });
    if (txCount === 0 && bal.balance !== defaultCredits) {
      bal.balance = defaultCredits;
      await bal.save();
    }
  }
  return bal || { balance: 0, reservedBalance: 0 };
};
