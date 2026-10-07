import TransactionForm from "./TransactionForm";

export default function GeneralExpenseAddScreen({ navigation, route }) {
  return (
    <TransactionForm
      initialTagId={route?.params?.initialTagId ?? null}
      initialTagName={route?.params?.initialTagName ?? ""}
      initialSavingsWithdrawal={
        route?.params?.initialSavingsWithdrawal ?? false
      }
      mode="variation"
      navigation={navigation}
    />
  );
}
