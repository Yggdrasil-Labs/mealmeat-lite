import com.android.build.api.dsl.ManagedVirtualDevice

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
}

android {
    namespace = "io.yggdrasil.labs.mealmate.lite"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.yggdrasil.labs.mealmate.lite"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    buildFeatures {
        compose = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
        managedDevices {
            localDevices {
                create("pixel2Api27") {
                    device = "Pixel 2"
                    sdkVersion = 27
                    systemImageSource = "aosp"
                    require64Bit = true
                    testedAbi = "x86_64"
                }
                create("pixel6Api37") {
                    device = "Pixel 6"
                    sdkVersion = 37
                    systemImageSource = "google"
                    pageAlignment = ManagedVirtualDevice.PageAlignment.FORCE_16KB_PAGES
                    require64Bit = true
                    testedAbi = "x86_64"
                }
            }
        }
    }
}

dependencies {
    // Compose BOM
    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)
    androidTestImplementation(composeBom)

    // Compose UI
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.icons.extended)
    debugImplementation(libs.compose.ui.tooling)

    // AndroidX
    implementation(libs.activity.compose)
    implementation(libs.navigation.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.core.ktx)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // WorkManager
    implementation(libs.work.runtime.ktx)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Network
    implementation(libs.retrofit)
    implementation(libs.okhttp)
    implementation(libs.okhttp.sse)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.retrofit.kotlinx.serialization)

    // Unit Testing
    testImplementation(libs.junit5.api)
    testRuntimeOnly(libs.junit5.engine)
    testRuntimeOnly(libs.junit.platform.launcher)
    testImplementation(libs.turbine)
    testImplementation(libs.mockk)

    // Instrumented Testing
    androidTestImplementation(libs.androidx.test.ext)
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}

ktlint {
    version.set("1.8.0")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

detekt {
    config.setFrom(files("${rootProject.projectDir}/detekt.yml"))
    buildUponDefaultConfig = true
    // 排除 OpenAPI Generator 生成的代码
    source.setFrom(
        "src/main/java",
        "src/main/kotlin",
    )
}

// 排除生成代码目录
tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
    exclude("**/contract/generated/**")
}

// Contract model generation tasks
val contractGeneratedDir = file("src/main/java/io/yggdrasil/labs/mealmate/lite/contract/generated")

tasks.register<Exec>("generateContractModels") {
    group = "contract"
    description = "Generate Kotlin DTOs from OpenAPI spec using OpenAPI Generator"

    val outputDir =
        layout.buildDirectory
            .dir("contract-generation")
            .get()
            .asFile

    workingDir = rootProject.projectDir
    commandLine("bash", "scripts/generate-contract-models.sh", "--output-dir", outputDir.absolutePath)

    doLast {
        // Sync generated files to committed source
        val generatedSrc = file("$outputDir/src/main/kotlin/io/yggdrasil/labs/mealmate/lite/contract/generated")
        if (generatedSrc.exists()) {
            copy {
                from(generatedSrc)
                into(contractGeneratedDir)
            }
            println("Contract models synced to $contractGeneratedDir")
        } else {
            println("Warning: Generated source not found at $generatedSrc")
        }
    }
}

tasks.register<Exec>("checkContractModels") {
    group = "contract"
    description = "Check if contract models are up to date with OpenAPI spec"

    workingDir = rootProject.projectDir
    commandLine("bash", "scripts/check-contract-models.sh")
}

// 生成并格式化契约模型（完整流程）
tasks.register("generateAndFormatContractModels") {
    group = "contract"
    description = "Generate and format Kotlin DTOs from OpenAPI spec"

    dependsOn("generateContractModels")
    finalizedBy("ktlintMainSourceSetFormat")
}
