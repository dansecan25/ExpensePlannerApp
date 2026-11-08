// Describes which stored record produced a projected movement so the
// "Edit movement" screen can load and change it.
export const getEditTarget = event => {
  const base = { occurrenceDate: event.date };
  if (event.account_transfer) {
    return { ...base, sourceType: "transfer", sourceId: event.transfer_id };
  }
  if (event.subscription) {
    return {
      ...base,
      sourceType: "subscription",
      sourceId: event.subscription_id,
    };
  }
  if (event.source === "salary") {
    return {
      ...base,
      sourceType: "salary",
      sourceId: null,
      occurrenceAmount: Number(event.amount ?? 0),
      occurrenceAccountId: event.account_id ?? null,
    };
  }
  return {
    ...base,
    sourceType: "expense",
    sourceId: event.recurring_deduction ? event.source_expense_id : event.id,
  };
};
