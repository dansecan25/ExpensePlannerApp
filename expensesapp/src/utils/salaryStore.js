import { types } from "mobx-state-tree";

const SalaryModel = types
  .model("SalaryModel", {
    amount: types.maybeNull(types.number),
    currentAmount:types.optional(types.number,0),
    lastDeposit:types.maybeNull(types.string),
    currency: types.maybeNull(types.string),
    fixed: types.maybeNull(types.boolean),
    deposits_date: types.maybeNull(types.string),
    fixed_day: types.maybeNull(types.integer),
    setupComplete: types.optional(types.boolean, false),
    profileExists: types.optional(types.boolean, false),
  })
  .actions(self => ({
    setSalaryModel(amount,balance,last_deposit, currency, fixed, depDate, fixedDay, setupComplete = true) {
      self.amount = amount;
      self.currency = currency;
      self.currentAmount=balance;
      self.fixed = fixed;
      self.deposits_date = depDate;
      self.fixed_day = fixedDay;
      self.lastDeposit=last_deposit;
      self.setupComplete = setupComplete;
      self.profileExists = true;
    },
    clear() {
      self.amount = null;
      self.currency = null;
      self.fixed = null;
      self.deposits_date = null;
      self.fixed_day = null;
      self.currentAmount=0;
      self.lastDeposit=null;
      self.setupComplete=false;
      self.profileExists=false;
    }
  }));

export default SalaryModel;
