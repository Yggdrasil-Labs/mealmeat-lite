@file:Suppress("MagicNumber")

package io.yggdrasil.labs.mealmate.lite.data.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import io.yggdrasil.labs.mealmate.lite.MealMateApp
import java.util.concurrent.TimeUnit

class MealMateSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result =
        when (val result = (applicationContext as MealMateApp).container.syncCoordinator.sync(SyncReason.Worker)) {
            is SyncRunResult.Success,
            SyncRunResult.SessionChanged,
            -> Result.success()

            is SyncRunResult.Failed -> if (result.kind == SyncFailureKind.NETWORK) Result.retry() else Result.failure()
        }

    companion object {
        const val PERIODIC_WORK_NAME = "mealmate-sync-periodic"
        const val NOW_WORK_NAME = "mealmate-sync-now"

        private fun constraints() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedulePeriodic(context: Context) {
            val request =
                PeriodicWorkRequestBuilder<MealMateSyncWorker>(30, TimeUnit.MINUTES)
                    .setConstraints(constraints())
                    .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        fun enqueueNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<MealMateSyncWorker>().setConstraints(constraints()).build()
            WorkManager.getInstance(context).enqueueUniqueWork(NOW_WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
