import com.android.build.api.dsl.ManagedVirtualDevice
import org.gradle.api.tasks.PathSensitivity

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
}

val mealMateBaseUrl = providers.gradleProperty("mealmate.baseUrl").orElse("http://10.0.2.2:3000/")

android {
    namespace = "io.yggdrasil.labs.mealmate.lite"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.yggdrasil.labs.mealmate.lite"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "MEALMATE_BASE_URL", "\"${mealMateBaseUrl.get()}\"")

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
        buildConfig = true
    }

    sourceSets {
        getByName("androidTest") {
            assets.srcDir(rootProject.file("../contracts/v1/fixtures"))
            assets.srcDir(project.file("schemas"))
        }
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
    testImplementation(libs.okhttp.mockwebserver)

    // Instrumented Testing
    androidTestImplementation(libs.androidx.test.ext)
    androidTestImplementation(libs.room.testing)
    androidTestImplementation(libs.okhttp.mockwebserver)
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}

ksp {
    arg("room.schemaLocation", project.file("schemas").absolutePath)
}

ktlint {
    version.set("1.8.0")
    // 契约生成器的输出以脚本后处理后的字节为准；生成任务与检查任务必须比较同一份
    // canonical output，而不能再由 ktlint 改写。
    filter {
        exclude("**/contract/generated/**")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
    val contractFixturesRoot = rootProject.file("../contracts/v1/fixtures")
    inputs.dir(contractFixturesRoot).withPathSensitivity(PathSensitivity.RELATIVE)
    systemProperty("mealmate.fixtures.root", contractFixturesRoot.absolutePath)
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

    // 生成脚本拒绝清理调用方传入的目录。Gradle 只在自身受控的 build staging
    // 目录上负责创建 fresh output，避免脚本拥有任意路径删除能力。
    doFirst {
        delete(outputDir)
    }

    doLast {
        // Sync generated files to committed source
        val generatedSrc = file("$outputDir/src/main/kotlin/io/yggdrasil/labs/mealmate/lite/contract/generated")
        if (generatedSrc.exists()) {
            delete(contractGeneratedDir)
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

// 生成契约模型（完整流程）。生成输出已是 canonical，不能再被 formatter 改写。
tasks.register("generateAndFormatContractModels") {
    group = "contract"
    description = "Generate canonical Kotlin DTOs from OpenAPI spec"

    dependsOn("generateContractModels")
}
