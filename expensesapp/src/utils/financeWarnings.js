import { Alert } from "react-native";
import { formatDisplayDate } from "./dateFormatting";

const formatAmount = (amount, currency) =>
  `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || ""}`.trim();

export const confirmProjectedNegativeBalance = (
  risk,
  currency,
  continueLabel = "Add anyways",
) =>
  new Promise(resolve => {
    const details = [];
    if (risk.negativeAccount) {
      details.push(
        `${risk.negativeAccount.accountName} is projected to be ${formatAmount(
          risk.negativeAccount.balance,
          currency,
        )} on ${formatDisplayDate(risk.negativeAccount.date)}.`,
      );
    }
    if (risk.negativeDate) {
      const totalBalance = risk.projection.balances.find(
        entry => entry.date === risk.negativeDate,
      )?.balance;
      details.push(
        `The combined balance is projected to be ${formatAmount(
          totalBalance,
          currency,
        )} on ${formatDisplayDate(risk.negativeDate)}.`,
      );
    }

    let resolved = false;
    const finish = shouldContinue => {
      if (!resolved) {
        resolved = true;
        resolve(shouldContinue);
      }
    };

    Alert.alert(
      "Negative balance projected",
      `${details.join("\n")}\n\nContinue only if you have a contingency plan.`,
      [
        { text: "OK", style: "cancel", onPress: () => finish(false) },
        {
          text: continueLabel,
          style: "destructive",
          onPress: () => finish(true),
        },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    );
  });
