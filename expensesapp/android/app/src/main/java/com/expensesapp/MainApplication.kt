package com.expensesapp

import android.app.Application
import com.alpha0010.fs.FileAccessPackage
import com.expensesapp.updates.AppUpdaterPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // FileAccess is required for writing database backups on Android.
          if (none { it is FileAccessPackage }) {
            add(FileAccessPackage())
          }
          // Installs updates downloaded from GitHub Releases.
          add(AppUpdaterPackage())
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
