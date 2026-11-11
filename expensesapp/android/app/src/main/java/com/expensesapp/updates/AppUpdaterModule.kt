package com.expensesapp.updates

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * Native half of the in-app updater: reports the installed version and hands a downloaded
 * APK to Android's package installer. Downloading and checking GitHub happen in JavaScript.
 */
class AppUpdaterModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName() = NAME

  @ReactMethod
  fun getAppVersion(promise: Promise) {
    try {
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      promise.resolve(
          Arguments.createMap().apply {
            putString("versionName", info.versionName ?: "0")
            putDouble("versionCode", info.longVersionCode.toDouble())
          })
    } catch (error: Exception) {
      promise.reject("E_VERSION", error)
    }
  }

  /** Whether the user allowed this app to install other apps (Android 8+ per-app setting). */
  @ReactMethod
  fun canInstallPackages(promise: Promise) {
    promise.resolve(context.packageManager.canRequestPackageInstalls())
  }

  @ReactMethod
  fun openInstallPermissionSettings(promise: Promise) {
    try {
      val intent =
          Intent(
                  Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                  Uri.parse("package:${context.packageName}"))
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("E_SETTINGS", error)
    }
  }

  /** Opens the system installer for an APK downloaded into the cache's updates folder. */
  @ReactMethod
  fun installApk(path: String, promise: Promise) {
    try {
      val updatesDir = File(context.cacheDir, UPDATES_DIR).canonicalFile
      val apk = File(path).canonicalFile
      if (apk.parentFile != updatesDir || !apk.isFile || apk.extension != "apk") {
        promise.reject("E_PATH", "The update file is not in the updates folder.")
        return
      }
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", apk)
      val intent =
          Intent(Intent.ACTION_VIEW)
              .setDataAndType(uri, "application/vnd.android.package-archive")
              .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("E_INSTALL", error)
    }
  }

  companion object {
    const val NAME = "AppUpdater"
    /** Must match the path in res/xml/update_file_paths.xml and UPDATE_DIR in JavaScript. */
    const val UPDATES_DIR = "updates"
  }
}
