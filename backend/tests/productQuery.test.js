/**
 * Tests for the catalog rules shared by Shop All and Curate Look (utils/productQuery.js).
 * Pure functions - no database needed. Run with: npm test
 */
import assert from 'assert';
import { buildCatalogFilter, getSortOption, getPaging, escapeRegex } from '../utils/productQuery.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✅ [PASS] ${name}`);
};

console.log('📋 Shared catalog rules (Shop All + Curate Look)');

test('no query -> no filter', () => {
  assert.deepStrictEqual(buildCatalogFilter({}), {});
});

test('price range becomes $gte / $lte numbers', () => {
  assert.deepStrictEqual(buildCatalogFilter({ minPrice: '500', maxPrice: '9000' }), { price: { $gte: 500, $lte: 9000 } });
});

test('size matches product sizes OR variant sizes', () => {
  assert.deepStrictEqual(buildCatalogFilter({ size: 'M' }), { $and: [{ $or: [{ sizes: 'M' }, { 'variants.size': 'M' }] }] });
});

test('search text is regex-escaped (no regex injection)', () => {
  const filter = buildCatalogFilter({ search: 'a.*(b' });
  assert.strictEqual(filter.$and[0].$or[0].name.$regex, 'a\\.\\*\\(b');
  assert.strictEqual(escapeRegex('x+y'), 'x\\+y');
});

test('stock status maps to stock ranges', () => {
  assert.deepStrictEqual(buildCatalogFilter({ stockStatus: 'inStock' }).stock, { $gte: 5 });
  assert.deepStrictEqual(buildCatalogFilter({ availability: 'lowStock' }).stock, { $gt: 0, $lt: 5 });
  assert.deepStrictEqual(buildCatalogFilter({ stockStatus: 'outOfStock' }).stock, { $lte: 0 });
});

test('the filter never decides visibility or category (controllers own that)', () => {
  const filter = buildCatalogFilter({ category: 'dress', status: 'pending', seller: 'x', maxPrice: '100' });
  assert.deepStrictEqual(Object.keys(filter), ['price']);
});

test('unknown sort falls back to newest', () => {
  assert.deepStrictEqual(getSortOption('price_asc'), { price: 1 });
  assert.deepStrictEqual(getSortOption('???'), { createdAt: -1 });
});

test('paging is clamped: page >= 1, limit 1..100, default applied', () => {
  assert.deepStrictEqual(getPaging('0', '9999', 12), { safePage: 1, safeLimit: 100, skip: 0 });
  assert.deepStrictEqual(getPaging('3', '10', 12), { safePage: 3, safeLimit: 10, skip: 20 });
  assert.deepStrictEqual(getPaging(undefined, undefined, 36), { safePage: 1, safeLimit: 36, skip: 0 });
});

console.log(`\nproductQuery: ${passed}/${passed} tests passed`);
