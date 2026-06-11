// ===================================================================
// Budget Tool - schema migrations
//
// collapseFunMoney(store): merge the two per-person fun categories
//   ("Partner A Spending" / "Partner B Spending") into a single "Fun money"
//   category. Per-person attribution is NOT lost - each historical fun
//   transaction gets `allocTo` set to the person from its old category, which
//   the settlement engine uses to split by person (overridable). The two fun
//   *accounts* (bank accounts) are untouched; only the *category* collapses.
//
// Idempotent and non-destructive (only renames/merges; never drops data).
// Loads in the browser (window.Migrations) and Node (module.exports).
// ===================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Migrations = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var OLD = ["Partner A Spending", "Partner B Spending"];
  var NEW = 'Fun money';
  var PERSON = { "Partner A Spending": 'Partner A', "Partner B Spending": 'Partner B' };
  var FREQ_TO_WEEKLY = { weekly: 1, fortnightly: 0.5, monthly: 12 / 52, quarterly: 4 / 52, yearly: 1 / 52 };

  function toWeekly(entry) {
    if (!entry || typeof entry !== 'object') return 0;
    return (entry.amount || 0) * (FREQ_TO_WEEKLY[entry.freq] || 1);
  }

  function collapseFunMoney(store) {
    if (!store || typeof store !== 'object') return store;
    var changed = { txns: 0 };

    // categories: drop the two, ensure single "Fun money"
    if (Array.isArray(store.categories)) {
      var hadNew = store.categories.indexOf(NEW) !== -1;
      store.categories = store.categories.filter(function (c) { return OLD.indexOf(c) === -1; });
      if (!hadNew) store.categories.push(NEW);
    }

    // budget: merge the two allowances into one weekly "Fun money" allowance
    if (store.budget && typeof store.budget === 'object') {
      var m = store.budget[OLD[0]], s = store.budget[OLD[1]];
      if ((m || s) && !store.budget[NEW]) {
        var amt = toWeekly(m) + toWeekly(s);
        store.budget[NEW] = { amount: Math.round(amt * 100) / 100, freq: 'weekly', type: 'allowance' };
      }
      delete store.budget[OLD[0]]; delete store.budget[OLD[1]];
    }

    // funding: tidy (engine splits fun by card/override, value here is cosmetic)
    if (store.funding && typeof store.funding === 'object') {
      delete store.funding[OLD[0]]; delete store.funding[OLD[1]];
      if (!(NEW in store.funding)) store.funding[NEW] = 'Joint Income';
    }

    // merchants: remap locked category + merge counts
    if (store.merchants && typeof store.merchants === 'object') {
      Object.keys(store.merchants).forEach(function (k) {
        var mm = store.merchants[k]; if (!mm) return;
        if (mm.locked && OLD.indexOf(mm.locked) !== -1) mm.locked = NEW;
        if (mm.counts) {
          OLD.forEach(function (oldc) {
            if (mm.counts[oldc]) { mm.counts[NEW] = (mm.counts[NEW] || 0) + mm.counts[oldc]; delete mm.counts[oldc]; }
          });
        }
      });
    }

    // periods: remap transaction categories (preserving person via allocTo) and
    // merge the per-period category/transfer rollup maps.
    if (Array.isArray(store.periods)) {
      store.periods.forEach(function (p) {
        (p.transactions || []).forEach(function (tx) {
          if (OLD.indexOf(tx.category) !== -1) {
            if (!tx.allocTo) tx.allocTo = PERSON[tx.category];
            tx.category = NEW;
            changed.txns++;
          }
        });
        ['categories', 'transfers'].forEach(function (field) {
          var obj = p[field];
          if (obj && typeof obj === 'object') {
            OLD.forEach(function (oldc) {
              if (oldc in obj) { obj[NEW] = (obj[NEW] || 0) + obj[oldc]; delete obj[oldc]; }
            });
          }
        });
      });
    }

    store._funCollapsed = true;
    return store;
  }

  return { collapseFunMoney: collapseFunMoney, OLD_FUN_CATEGORIES: OLD, NEW_FUN_CATEGORY: NEW };
});
