package io.yggdrasil.labs.mealmate.lite.data.remote

import io.yggdrasil.labs.mealmate.lite.contract.contractJson
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.BootstrapRequest
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.BootstrapResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.DeviceListResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ErrorResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.LogoutResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.ModelListResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RegisterRequest
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RegisterResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RevokeDeviceResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.RotateFamilyCodeResponse
import io.yggdrasil.labs.mealmate.lite.contract.generated.models.SyncResponse
import kotlinx.serialization.Serializable
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.Response as RetrofitResponse

@Serializable
data class SuccessEnvelope<T>(
    val success: Boolean,
    val data: T,
)

interface MealMateApi {
    @GET("api/v1/sync")
    suspend fun sync(
        @Query("cursor") cursor: String?,
        @Query("limit") limit: Int = 100,
        @Header("Authorization") authorization: String? = null,
    ): RetrofitResponse<SuccessEnvelope<SyncResponse>>

    @GET("api/v1/models")
    suspend fun listModels(): RetrofitResponse<ModelListResponse>

    @POST("api/v1/auth/bootstrap")
    @Headers("Content-Type: application/json")
    suspend fun bootstrap(
        @Body request: BootstrapRequest,
    ): RetrofitResponse<SuccessEnvelope<BootstrapResponse>>

    @POST("api/v1/auth/register")
    @Headers("Content-Type: application/json")
    suspend fun register(
        @Body request: RegisterRequest,
    ): RetrofitResponse<SuccessEnvelope<RegisterResponse>>

    @POST("api/v1/auth/logout")
    suspend fun logout(): RetrofitResponse<SuccessEnvelope<LogoutResponse>>

    @GET("api/v1/auth/devices")
    suspend fun listDevices(): RetrofitResponse<SuccessEnvelope<DeviceListResponse>>

    @DELETE("api/v1/auth/devices/{id}")
    suspend fun revokeDevice(
        @Path("id") id: String,
    ): RetrofitResponse<SuccessEnvelope<RevokeDeviceResponse>>

    @POST("api/v1/auth/family-code/rotate")
    suspend fun rotateFamilyCode(): RetrofitResponse<SuccessEnvelope<RotateFamilyCodeResponse>>
}

class RetrofitModelCatalogClient(
    private val api: MealMateApi,
) : io.yggdrasil.labs.mealmate.lite.data.models.ModelCatalogClient {
    override suspend fun listModels(): ModelListResponse = api.listModels().requireBody()
}

fun createMealMateApi(
    baseUrl: String,
    tokenProvider: () -> String?,
): MealMateApi {
    val contentType = "application/json".toMediaType()
    val client =
        OkHttpClient
            .Builder()
            .addInterceptor(BearerTokenInterceptor(tokenProvider))
            .build()
    return Retrofit
        .Builder()
        .baseUrl(baseUrl.ensureTrailingSlash())
        .client(client)
        .addConverterFactory(contractJson.asConverterFactory(contentType))
        .build()
        .create(MealMateApi::class.java)
}

class ApiCallException(
    val statusCode: Int,
    val errorCode: String? = null,
    message: String,
) : IllegalStateException(message)

private fun <T> RetrofitResponse<T>.requireBody(): T {
    if (!isSuccessful) return apiFailure(asApiCallException())
    return body() ?: apiFailure(ApiCallException(code(), message = "MealMate API returned an empty body"))
}

suspend fun <T> RetrofitResponse<SuccessEnvelope<T>>.requireSuccessData(): T {
    if (!isSuccessful) return apiFailure(asApiCallException())
    val envelope =
        body() ?: return apiFailure(
            ApiCallException(code(), message = "MealMate API returned an empty body"),
        )
    if (!envelope.success) {
        return apiFailure(ApiCallException(code(), message = "MealMate API rejected the request"))
    }
    return envelope.data
}

private fun apiFailure(error: ApiCallException): Nothing = throw error

private fun <T> RetrofitResponse<T>.asApiCallException(): ApiCallException {
    val error =
        errorBody()
            ?.use { body ->
                runCatching { contractJson.decodeFromString<ErrorResponse>(body.string()) }.getOrNull()
            }
    return ApiCallException(
        statusCode = code(),
        errorCode = error?.errCode,
        message = error?.errMessage ?: "MealMate API request failed: ${code()}",
    )
}

private class BearerTokenInterceptor(
    private val tokenProvider: () -> String?,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider()
        val request =
            chain
                .request()
                .newBuilder()
                .apply {
                    if (chain.request().header("Authorization") == null && !token.isNullOrBlank()) {
                        header("Authorization", "Bearer $token")
                    }
                }.build()
        return chain.proceed(request)
    }
}

private fun String.ensureTrailingSlash(): String = if (endsWith('/')) this else "$this/"
