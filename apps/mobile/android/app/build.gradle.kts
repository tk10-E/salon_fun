import java.util.Base64

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val googleServicesConfig = file("google-services.json")

if (googleServicesConfig.exists()) {
    apply(plugin = "com.google.gms.google-services")
} else {
    logger.lifecycle(
        "google-services.json not found in android/app. Firebase Google Services plugin was skipped.",
    )
}

fun dartDefineMap(): Map<String, String> {
    val encodedDefines = project.findProperty("dart-defines") as String? ?: return emptyMap()
    val decoder = Base64.getDecoder()

    return encodedDefines
        .split(",")
        .mapNotNull { entry ->
            if (entry.isBlank()) {
                return@mapNotNull null
            }

            val decoded = String(decoder.decode(entry))
            val separatorIndex = decoded.indexOf('=')
            if (separatorIndex <= 0) {
                return@mapNotNull null
            }

            decoded.substring(0, separatorIndex) to decoded.substring(separatorIndex + 1)
        }
        .toMap()
}

val socialDefines = dartDefineMap()
val facebookAppId = socialDefines["FACEBOOK_APP_ID"] ?: ""
val facebookClientToken = socialDefines["FACEBOOK_CLIENT_TOKEN"] ?: ""
val facebookScheme = if (facebookAppId.isBlank()) "fb000000000000000" else "fb$facebookAppId"

android {
    namespace = "com.salonfun.salon_client"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.salonfun.salon_client"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        resValue("string", "facebook_app_id", facebookAppId)
        resValue("string", "facebook_client_token", facebookClientToken)
        resValue("string", "fb_login_protocol_scheme", facebookScheme)
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
