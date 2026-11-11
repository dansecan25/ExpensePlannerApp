import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomButton from "../customButton/customButton";
import CustomText from "../customText/customText";
import { getColors } from "../../utils/color-picker";
import { useTheme } from "../../utils/themeContext";
import { t, useLanguage } from "../../i18n/i18n";
import {
  dismissUpdate,
  downloadUpdate,
  installWithPrompts,
  useAppUpdate,
} from "../../utils/appUpdater";

const VISIBLE_STATUSES = ["available", "downloading", "readyToInstall"];

/** Floating card shown above every screen when a newer release is found. */
export default function UpdateBanner() {
  useLanguage();
  useTheme();
  const insets = useSafeAreaInsets();
  const { status, release, progress, dismissed } = useAppUpdate();

  if (!release || dismissed || !VISIBLE_STATUSES.includes(status)) {
    return null;
  }

  const message = {
    available: t("Version {version} is available.", { version: release.version }),
    downloading: t("Downloading update... {percent}%", {
      percent: Math.round(progress * 100),
    }),
    readyToInstall: t("Version {version} is ready to install.", { version: release.version }),
  }[status];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { backgroundColor: getColors("surface"), borderColor: getColors("border") },
        { bottom: insets.bottom + 16 },
      ]}
    >
      <CustomText type="body3" text={message} style={{ color: getColors("secondaryText") }} />
      {status === "downloading" ? (
        <View style={[styles.track, { backgroundColor: getColors("border") }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: getColors("accent") },
            ]}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <CustomButton text={t("Later")} type="ghost" onPress={dismissUpdate} fontSize={14} />
          <CustomButton
            text={status === "readyToInstall" ? t("Install") : t("Update")}
            onPress={status === "readyToInstall" ? installWithPrompts : downloadUpdate}
            fontSize={14}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
