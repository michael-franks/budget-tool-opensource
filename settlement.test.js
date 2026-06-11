// Unit tests for the settlement engine. Run: node settlement.test.js
var S = require('./settlement.js');

var funding = {
  'Groceries': 'Joint Income',
  'Rates': 'Joint Bills',
  'Power': 'Joint Bills',
  'Petrol': 'Joint Bills',
  'Fun money': 'Joint Income' // funding value is irrelevant for fun; engine splits by card/override
};

var txs = [
  { detail: 'New World',       amount: -100, category: 'Groceries', owner: 'Partner B' },                       // Joint Income 100
  { detail: 'Council rates',   amount: -50,  category: 'Rates',     owner: '' },                                // Joint Bills 50
  { detail: 'Pub (A card)',    amount: -40,  category: 'Fun money', owner: 'Partner A' },                        // A Fun 40
  { detail: 'Salon (B card)',  amount: -60,  category: 'Fun money', owner: 'Partner B' },                        // B Fun 60
  { detail: 'Gift (override)', amount: -30,  category: 'Fun money', owner: 'Partner A', allocTo: 'Partner B' },  // override -> B Fun 30
  { detail: 'Refund (A)',      amount: 25,   category: 'Fun money', owner: 'Partner A' },                        // A Fun -25
  { detail: 'Mystery fun',     amount: -10,  category: 'Fun money', owner: '' }                                  // needsOwner -> Joint Income 10
];

var r = S.computeSettlement(txs, { funding: funding });

var failed = 0;
function assert(name, cond) {
  if (cond) { console.log('  ok   ' + name); }
  else { console.error('  FAIL ' + name); failed++; }
}

// Expected:
//   Joint Income  = 100 + 10 = 110   (general spend + unattributed fun until owner assigned)
//   Joint Bills   = 50
//   Partner A Fun = 40 - 25 = 15
//   Partner B Fun = 60 + 30 = 90     (salon + override beats card owner)
//   total         = 100+50+40+60+30-25+10 = 265
assert('Joint Income = 110',                  Math.round(r.perAccount['Joint Income']) === 110);
assert('Joint Bills = 50',                    Math.round(r.perAccount['Joint Bills']) === 50);
assert("Partner A Fun = 15",                  Math.round(r.perAccount["Partner A Spending"]) === 15);
assert("Partner B Fun = 90 (override wins)",  Math.round(r.perAccount["Partner B Spending"]) === 90);
assert('one txn needs an owner',              r.needsOwner.length === 1 && r.needsOwner[0].detail === 'Mystery fun');
assert('grand total = 265',                   Math.round(r.total) === 265);
assert('accounts ordered fun -> bills -> income',
       JSON.stringify(r.accounts) === JSON.stringify(["Partner A Spending", "Partner B Spending", 'Joint Bills', 'Joint Income']));

// Legacy per-person fun categories still treated as fun (back-compat during migration).
var legacy = S.computeSettlement(
  [{ detail: 'old', amount: -10, category: "Partner A Spending", owner: 'Partner A' }],
  { funding: {} }
);
assert('legacy fun category still allocates to fun account',
       Math.round(legacy.perAccount["Partner A Spending"]) === 10);

console.log('\nperAccount:', JSON.stringify(r.perAccount));
console.log(failed ? ('\n' + failed + ' test(s) FAILED') : '\nAll settlement tests passed.');
process.exitCode = failed ? 1 : 0;
