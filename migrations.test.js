// Tests for the fun-money collapse migration. Run: node migrations.test.js
var M = require('./migrations.js');

var failed = 0;
function assert(name, cond) {
  if (cond) { console.log('  ok   ' + name); } else { console.error('  FAIL ' + name); failed++; }
}

// -- Synthetic --------------------------------------------------------
var store = {
  categories: ['Groceries', "Partner A Spending", "Partner B Spending", 'Unaccounted'],
  budget: {
    "Partner A Spending": { amount: 25, freq: 'weekly', type: 'allowance' },
    "Partner B Spending": { amount: 25, freq: 'weekly', type: 'allowance' }
  },
  funding: { "Partner A Spending": "Partner A Spending", "Partner B Spending": "Partner B Spending" },
  merchants: { 'pub x': { counts: { "Partner A Spending": 3 }, locked: "Partner A Spending", o: 'Partner A' } },
  periods: [{
    categories: { "Partner A Spending": -40, "Partner B Spending": -60 },
    transactions: [
      { detail: 'Pub', amount: -40, category: "Partner A Spending", owner: 'Partner A' },
      { detail: 'Salon', amount: -60, category: "Partner B Spending", owner: 'Partner B' }
    ]
  }]
};
M.collapseFunMoney(store);

assert('categories collapsed to single "Fun money"',
  store.categories.indexOf("Partner A Spending") === -1 &&
  store.categories.indexOf("Partner B Spending") === -1 &&
  store.categories.indexOf('Fun money') !== -1);
assert('budget merged to 50/wk', store.budget['Fun money'] && store.budget['Fun money'].amount === 50 && !store.budget["Partner A Spending"]);
assert('merchant lock + counts remapped', store.merchants['pub x'].locked === 'Fun money' && store.merchants['pub x'].counts['Fun money'] === 3);
assert('txn category remapped + allocTo set from old category',
  store.periods[0].transactions[0].category === 'Fun money' &&
  store.periods[0].transactions[0].allocTo === 'Partner A' &&
  store.periods[0].transactions[1].allocTo === 'Partner B');
assert('period rollup map merged', store.periods[0].categories['Fun money'] === -100);

// idempotent
var snapshot = JSON.stringify(store);
M.collapseFunMoney(store);
assert('idempotent (second run is a no-op)', JSON.stringify(store) === snapshot);

console.log(failed ? ('\n' + failed + ' test(s) FAILED') : '\nAll migration tests passed.');
process.exitCode = failed ? 1 : 0;
