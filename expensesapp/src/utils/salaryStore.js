import { types } from "mobx-state-tree";

const SalaryModel = types
  .model("SalaryModel", {
    amount: types.maybeNull(types.number),
    currency: types.maybeNull(types.string),
    fixed: types.maybeNull(types.boolean),
    deposits_date: types.maybeNull(types.string),
    fixed_day: types.maybeNull(types.integer),
  })
  .actions(self => ({
    setSalaryModel(amount, currency, fixed, depDate, fixedDay) {
      self.amount = amount;
      self.currency = currency;
      self.fixed = fixed;
      self.deposits_date = depDate;
      self.fixed_day = fixedDay;
    },
    clear() {
      self.amount = null;
      self.currency = null;
      self.fixed = null;
      self.deposits_date = null;
      self.fixed_day = null;
    }
  }));

export default SalaryModel;
