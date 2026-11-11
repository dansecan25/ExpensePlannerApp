import { useSyncExternalStore } from "react";
import { Alert, NativeModules, Platform } from "react-native";
import { Dirs, FileSystem } from "react-native-file-access";
import {
  APK_MIME_TYPE,
  LATEST_RELEASE_URL,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_DIR_NAME,
} from "../constants/appUpdates";
import { t } from "../i18n/i18n";
import { compareVersions } from "./versions";

const { AppUpdater } = NativeModules;

/** Updates come as APKs, so only Android builds with the native module can install them. */
export const isUpdaterSupported = Platform.OS === "android" && Boolean(AppUpdater);

// --- Shared state, so the startup check and the Settings screen show the same status. ---

const initialState = {
  status: "idle", // idle | checking | upToDate | available | downloading | readyToInstall | error
  currentVersion: null,
  release: null,
  progress: 0,
  error: null,
  dismissed: false,
  lastCheckedAt: 0,
};
let state = initialState;
const listeners = new Set();

const setState = patch => {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
};

const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAppUpdate = () => useSyncExternalStore(subscribe, () => state);

export const dismissUpdate = () => setState({ dismissed: true });

const getInstalledVersion = async () =>
  (await AppUpdater.getAppVersion()).versionName;

// --- GitHub Releases ---

const findApkAsset = assets =>
  (assets || []).find(
    asset =>
      asset.content_type === APK_MIME_TYPE || asset.name?.toLowerCase().endsWith(".apk"),
  );

const fetchLatestRelease = async () => {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(t("GitHub answered with status {status}.", { status: response.status }));
  }
  const release = await response.json();
  const apk = findApkAsset(release.assets);
  if (!apk) {
    return null;
  }
  return {
    version: String(release.tag_name).replace(/^v/i, ""),
    name: release.name || release.tag_name,
    notes: release.body || "",
    url: release.html_url,
    apk: {
      name: apk.name,
      url: apk.browser_download_url,
      size: apk.size,
      // GitHub reports "sha256:<hex>" for release assets.
      sha256: String(apk.digest || "").startsWith("sha256:") ? apk.digest.slice(7) : null,
    },
  };
};

/**
 * Looks for a newer published release. With `silent`, failures (for example, no internet)
 * are kept quiet and the check runs at most once per UPDATE_CHECK_INTERVAL_MS.
 */
export const checkForUpdates = async ({ silent = false } = {}) => {
  if (!isUpdaterSupported || ["checking", "downloading"].includes(state.status)) {
    return state;
  }
  if (silent && Date.now() - state.lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) {
    return state;
  }
  setState({ status: "checking", error: null });
  try {
    const currentVersion = state.currentVersion ?? (await getInstalledVersion());
    setState({ currentVersion });
    const release = await fetchLatestRelease();
    const isNewer = release && compareVersions(release.version, currentVersion) > 0;
    setState({
      status: isNewer ? "available" : "upToDate",
      currentVersion,
      release: isNewer ? release : null,
      dismissed: false,
      lastCheckedAt: Date.now(),
    });
  } catch (error) {
    console.warn("[Updates] Check failed:", error);
    setState({
      status: silent ? "idle" : "error",
      error: error instanceof Error ? error.message : String(error),
      lastCheckedAt: silent ? Date.now() : state.lastCheckedAt,
    });
  }
  return state;
};

// --- Download and install ---

const updatesDir = () => `${Dirs.CacheDir}/${UPDATE_DIR_NAME}`;

const clearOldDownloads = async () => {
  const dir = updatesDir();
  if (!(await FileSystem.exists(dir))) {
    await FileSystem.mkdir(dir);
    return;
  }
  for (const file of await FileSystem.ls(dir)) {
    await FileSystem.unlink(`${dir}/${file}`);
  }
};

const verifyDownload = async (path, apk) => {
  const { size } = await FileSystem.stat(path);
  if (apk.size && size !== apk.size) {
    throw new Error(t("The download is incomplete. Please try again."));
  }
  if (apk.sha256) {
    const hash = await FileSystem.hash(path, "SHA-256");
    if (hash.toLowerCase() !== apk.sha256.toLowerCase()) {
      throw new Error(t("The download does not match the published release. Please try again."));
    }
  }
};

export class InstallPermissionError extends Error {}

/** Opens Android's installer. Throws InstallPermissionError when the user must allow it first. */
export const installDownloadedUpdate = async () => {
  if (!state.downloadedPath) {
    return;
  }
  if (!(await AppUpdater.canInstallPackages())) {
    throw new InstallPermissionError(
      t("Allow Expense Planner to install updates, then come back and tap Install."),
    );
  }
  await AppUpdater.installApk(state.downloadedPath);
};

export const openInstallPermissionSettings = () => AppUpdater.openInstallPermissionSettings();

/** Opens the installer, first walking the user through Android's "install unknown apps" setting. */
export const installWithPrompts = async () => {
  try {
    await installDownloadedUpdate();
  } catch (error) {
    if (error instanceof InstallPermissionError) {
      Alert.alert(t("Allow updates"), error.message, [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Open settings"), onPress: openInstallPermissionSettings },
      ]);
      return;
    }
    console.warn("[Updates] Install failed:", error);
    Alert.alert(
      t("Could not install the update"),
      error instanceof Error ? error.message : t("Please try again."),
    );
  }
};

export const downloadUpdate = async () => {
  const { release } = state;
  if (!release || state.status === "downloading") {
    return;
  }
  setState({ status: "downloading", progress: 0, error: null, dismissed: false });
  try {
    await clearOldDownloads();
    const path = `${updatesDir()}/expense-planner-${release.version}.apk`;
    const result = await FileSystem.fetch(
      release.apk.url,
      { path, network: "any" },
      (bytesRead, contentLength) => {
        const total = contentLength > 0 ? contentLength : release.apk.size;
        if (total > 0) {
          setState({ progress: Math.min(1, bytesRead / total) });
        }
      },
    );
    if (!result.ok) {
      throw new Error(t("GitHub answered with status {status}.", { status: result.status }));
    }
    await verifyDownload(path, release.apk);
    setState({ status: "readyToInstall", progress: 1, downloadedPath: path });
  } catch (error) {
    console.warn("[Updates] Download failed:", error);
    setState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
