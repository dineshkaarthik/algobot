package com.algonit.algo.core.di

import android.content.Context
import com.algonit.algo.core.storage.ConversationCache
import com.algonit.algo.core.storage.PreferencesManager
import com.algonit.algo.core.storage.SecureStorage
import com.algonit.algo.features.auth.data.BiometricAuthManager
import com.algonit.algo.features.growth.data.repository.GrowthRepositoryImpl
import com.algonit.algo.features.growth.domain.repository.GrowthRepository
import com.algonit.algo.ui.theme.DarkModeManager
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideSecureStorage(
        @ApplicationContext context: Context
    ): SecureStorage {
        return SecureStorage(context)
    }

    @Provides
    @Singleton
    fun providePreferencesManager(
        @ApplicationContext context: Context
    ): PreferencesManager {
        return PreferencesManager(context)
    }

    @Provides
    @Singleton
    fun provideConversationCache(): ConversationCache {
        return ConversationCache()
    }

    @Provides
    @Singleton
    fun provideDarkModeManager(
        @ApplicationContext context: Context
    ): DarkModeManager {
        return DarkModeManager(context)
    }

    @Provides
    @Singleton
    fun provideBiometricAuthManager(
        @ApplicationContext context: Context
    ): BiometricAuthManager {
        return BiometricAuthManager(context)
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindGrowthRepository(
        impl: GrowthRepositoryImpl
    ): GrowthRepository
}
