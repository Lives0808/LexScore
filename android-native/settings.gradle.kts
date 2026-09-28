// 原生安卓版（Kotlin + Jetpack Compose）
//
// 与 android/（Capacitor 套壳版）并列存在，两者共用同一份评分引擎源码，
// 区别只在于 UI 层：这里是真原生 Compose，不带 WebView。

pluginManagement {
    repositories {
        // 国内镜像优先，官方源回落
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/public") }
        maven { url = uri("https://maven.aliyun.com/repository/gradle-plugin") }
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/public") }
        google()
        mavenCentral()
    }
}

rootProject.name = "LexScore"
include(":app")
