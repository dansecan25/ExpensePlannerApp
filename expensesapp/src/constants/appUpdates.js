// In-app updates come from this repository's GitHub Releases. Drafts and pre-releases are
// ignored, so a release only reaches phones once it is published.
export const RELEASES_REPOSITORY = "dansecan25/ExpensePlannerApp";
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${RELEASES_REPOSITORY}/releases/latest`;
export const RELEASES_PAGE_URL = `https://github.com/${RELEASES_REPOSITORY}/releases`;

// Checked at startup, and again when the app returns to the foreground after this long.
export const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

// Must match AppUpdaterModule.UPDATES_DIR and res/xml/update_file_paths.xml.
export const UPDATE_DIR_NAME = "updates";
export const APK_MIME_TYPE = "application/vnd.android.package-archive";
