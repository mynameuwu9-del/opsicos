package com.opsicos.app

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import dagger.hilt.android.HiltAndroidApp

/**
 * Main Application class for Opsicos Android App
 * Initializes Hilt for dependency injection and configures app-wide settings
 */
@HiltAndroidApp
class OpsicosApp : Application(), ImageLoaderFactory {
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize app-wide configurations
        initializeApp()
    }
    
    private fun initializeApp() {
        // Any app-wide initialization can go here
        // For example: Analytics, Crash reporting, etc.
    }
    
    /**
     * Configure Coil image loader with caching for better performance
     */
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25) // Use 25% of available memory for image cache
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(50L * 1024 * 1024) // 50MB disk cache
                    .build()
            }
            .respectCacheHeaders(false) // Force cache images
            .crossfade(true) // Enable crossfade animation
            .build()
    }
}
