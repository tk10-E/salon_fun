import java.util.Properties
import org.gradle.api.GradleException

plugins {
    id("com.android.application")
    id("kotlin-android")
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

val keyProperties = Properties()
val keyPropertiesFile = rootProject.file("key.properties")
val envProperties = Properties()
val envPropertiesFile = rootProject.file("../.env.production")

if (keyPropertiesFile.exists()) {
    keyPropertiesFile.inputStream().use(keyProperties::load)
}

if (envPropertiesFile.exists()) {
    envPropertiesFile.inputStream().use(envProperties::load)
}

fun keyProperty(name: String): String? =
    keyProperties.getProperty(name)?.trim()?.takeIf { it.isNotEmpty() }

fun envProperty(name: String): String? =
    System.getenv(name)?.trim()?.takeIf { it.isNotEmpty() }
        ?: envProperties.getProperty(name)?.trim()?.takeIf { it.isNotEmpty() }

fun buildProperty(name: String): String? = keyProperty(name) ?: envProperty(name)

val releaseStoreFile = keyProperty("storeFile")
val releaseStorePath = releaseStoreFile?.let(rootProject::file)
val hasReleaseSigning =
    releaseStorePath?.exists() == true &&
        keyProperty("storePassword") != null &&
        keyProperty("keyAlias") != null &&
        keyProperty("keyPassword") != null
val allowDebugSigningForRelease =
    providers.gradleProperty("allowDebugSigningForRelease").orNull == "true" ||
        (System.getenv("ALLOW_DEBUG_SIGNING_FOR_RELEASE")?.trim()?.lowercase() == "true")
val releaseSigningHelp =
    "Configure apps/mobile/android/key.properties para publicar ou use " +
        "--android-project-arg=allowDebugSigningForRelease=true apenas para smoke test local."
val releaseSigningDetails =
    when {
        releaseStoreFile == null -> releaseSigningHelp
        releaseStorePath == null || !releaseStorePath.exists() ->
            "A keystore configurada nao foi encontrada em '${releaseStorePath?.path}'. " +
                "Revise apps/mobile/android/key.properties. $releaseSigningHelp"
        else -> releaseSigningHelp
    }

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
        minSdk = maxOf(flutter.minSdkVersion, 21)
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = releaseStorePath
                storePassword = keyProperty("storePassword")
                keyAlias = keyProperty("keyAlias")
                keyPassword = keyProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            when {
                hasReleaseSigning -> {
                    signingConfig = signingConfigs.getByName("release")
                }
                allowDebugSigningForRelease -> {
                    logger.lifecycle(
                        "Release build usando assinatura debug por override local. $releaseSigningDetails",
                    )
                    signingConfig = signingConfigs.getByName("debug")
                }
                else -> {
                    throw GradleException(
                        "Release signing nao configurado. $releaseSigningDetails",
                    )
                }
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
