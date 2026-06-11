// ===================================================================
// Budget Tool - Credit-card settlement engine
//
// Given the credit-card transactions to settle, work out how much each
// account should transfer to the card. Allocation rules:
//
//   - Fun-money purchase   -> the CARD OWNER's fun account, UNLESS a manual
//                            override (tx.allocTo = 'Partner A' | 'Partner B')
//                            is set, which wins. One shared card account, a card
//                            number each, so the owner of the purchase normally
//                            decides whose fun money pays - but it can be reassigned.
//   - Bills-funded category -> its funding account (normally "Joint Bills").
//   - Everything else       -> "Joint Income" (income covers the rest).
//
// "Fun money" is a single category (split by card/override). Legacy per-person
// fun categories ("Partner A Spending" / "Partner B Spending") are still treated
// as fun for back-compat during migration.
//
// Pure + side-effect free. Loads in the browser (window.Settlement) and in
// Node (module.exports) so it can be unit-tested without a browser.
// ===================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Settlement = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var FUN_ACCOUNTS = ["Partner A Spending", "Partner B Spending"];
  // Categories that mean "discretionary / fun" - new collapsed one + legacy two.
  var DEFAULT_FUN_CATEGORIES = ['Fun money', "Partner A Spending", "Partner B Spending"];

  function isFunAccount(name) { return FUN_ACCOUNTS.indexOf(name) !== -1; }

  // Map a person to their fun account. Returns null if unknown.
  function ownerFunAccount(person) {
    var o = (person || '').toLowerCase();
    if (o === 'partner a') return "Partner A Spending";
    if (o === 'partner b') return "Partner B Spending";
    return null;
  }

  function isFunCategory(category, funCategories, funding) {
    if (funCategories && funCategories.indexOf(category) !== -1) return true;
    if (funding && isFunAccount(funding[category])) return true; // legacy funding map
    return false;
  }

  // Which account is responsible for a single transaction.
  function accountFor(tx, config) {
    config = config || {};
    var funding = config.funding || {};
    var defaultAccount = config.defaultAccount || 'Joint Income';
    var funCategories = config.funCategories || DEFAULT_FUN_CATEGORIES;

    if (isFunCategory(tx.category, funCategories, funding)) {
      var person = tx.allocTo || tx.owner;          // manual override wins over card owner
      var acct = ownerFunAccount(person);
      if (acct) return acct;
      // Unknown person: if the (legacy) category itself names a person, use it;
      // otherwise it falls to the income remainder until an owner is assigned.
      if (isFunAccount(tx.category)) return tx.category;
      return defaultAccount;
    }
    return funding[tx.category] || defaultAccount;
  }

  // transactions: the credit-card charges to settle (caller filters to the card
  //   account + the unsettled window). Each: {date, detail, amount, category,
  //   owner, allocTo?}. amount<0 = a charge, amount>0 = a refund.
  // config: { funding, defaultAccount='Joint Income', funCategories }.
  function computeSettlement(transactions, config) {
    config = config || {};
    var funding = config.funding || {};
    var funCategories = config.funCategories || DEFAULT_FUN_CATEGORIES;

    var perAccount = {};   // account -> amount owed to the card
    var lines = {};        // account -> [tx, ...]
    var needsOwner = [];   // fun-money txns with no card owner / override
    var total = 0;

    (transactions || []).forEach(function (tx) {
      var owed = -Number(tx.amount || 0);   // charge (neg) -> positive owed
      if (!owed) return;

      if (isFunCategory(tx.category, funCategories, funding) && !ownerFunAccount(tx.allocTo || tx.owner)) {
        needsOwner.push(tx);
      }
      var account = accountFor(tx, config);
      perAccount[account] = (perAccount[account] || 0) + owed;
      (lines[account] = lines[account] || []).push(tx);
      total += owed;
    });

    var order = ["Partner A Spending", "Partner B Spending", 'Joint Bills', 'Joint Income'];
    var accounts = Object.keys(perAccount).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia === -1) ia = order.length;
      if (ib === -1) ib = order.length;
      return ia - ib || a.localeCompare(b);
    });

    return { perAccount: perAccount, accounts: accounts, lines: lines, total: total, needsOwner: needsOwner };
  }

  return {
    computeSettlement: computeSettlement,
    accountFor: accountFor,
    isFunCategory: isFunCategory,
    isFunAccount: isFunAccount,
    ownerFunAccount: ownerFunAccount,
    FUN_ACCOUNTS: FUN_ACCOUNTS,
    DEFAULT_FUN_CATEGORIES: DEFAULT_FUN_CATEGORIES
  };
});
