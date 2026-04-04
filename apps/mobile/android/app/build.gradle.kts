import java.util.Base64
import java.util.Properties

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
val keyProperties = Properties()
val keyPropertiesFile = rootProject.file("key.properties")

if (keyPropertiesFile.exists()) {
    keyPropertiesFile.inputStream().use(keyProperties::load)
}

fun keyProperty(name: String): String? = keyProperties.getProperty(name)?.trim()?.takeIf { it.isNotEmpty() }

val releaseStoreFile = keyProperty("storeFile")
val hasReleaseSigning =
    releaseStoreFile != null &&
    keyProperty("storePassword") != null &&
    keyProperty("keyAlias") != null &&
    keyProperty("keyPassword") != null

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

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(releaseStoreFile!!)
                storePassword = keyProperty("storePassword")
                keyAlias = keyProperty("keyAlias")
                keyPassword = keyProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig =
                if (hasReleaseSigning) {
                    signingConfigs.getByName("release")
                } else {
                    logger.lifecycle(
                        "key.properties not found or incomplete in android/. " +
                            "Release builds will use the debug signing key until a production keystore is configured.",
                    )
                    signingConfigs.getByName("debug")
                }
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
