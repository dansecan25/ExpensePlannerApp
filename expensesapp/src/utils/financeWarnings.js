import { Alert } from "react-native";
import { formatDisplayDate } from "./dateFormatting";
import { accountLabel, t } from "../i18n/i18n";

const formatAmount = (amount, currency) =>
  `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || ""}`.trim();

export const confirmProjectedNegativeBalance = (
  risk,
  currency,
  continueLabel = t("Add anyways"),
) =>
  new Promise(resolve => {
    const details = [];
    if (risk.negativeAccount) {
      details.push(
        t("{account} is projected to be {amount} on {date}.", {
          account: accountLabel(risk.negativeAccount.accountName),
          amount: formatAmount(risk.negativeAccount.balance, currency),
          date: formatDisplayDate(risk.negativeAccount.date),
        }),
      );
    }
    if (risk.negativeDate) {
      const totalBalance = risk.projection.balances.find(
        entry => entry.date === risk.negativeDate,
      )?.balance;
      details.push(
        t("The combined balance is projected to be {amount} on {date}.", {
          amount: formatAmount(totalBalance, currency),
          date: formatDisplayDate(risk.negativeDate),
        }),
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
      t("Negative balance projected"),
      `${details.join("\n")}\n\n${t("Continue only if you have a contingency plan.")}`,
      [
        { text: t("OK"), style: "cancel", onPress: () => finish(false) },
        {
          text: continueLabel,
          style: "destructive",
          onPress: () => finish(true),
        },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    );
  });
