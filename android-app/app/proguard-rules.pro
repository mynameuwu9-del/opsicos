# Opsicos Android App ProGuard Rules

# Keep source file names and line numbers for better crash reports
-keepattributes SourceFile,LineNumberTable

# Keep annotations
-keepattributes *Annotation*

# Retrofit
-keepattributes Signature
-keepattributes Exceptions
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class sun.misc.Unsafe { *; }
-keep class com.google.gson.stream.** { *; }

# Keep data models
-keep class com.opsicos.app.data.model.** { *; }
-keep class com.opsicos.app.data.remote.dto.** { *; }

# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.lifecycle.HiltViewModel

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# Compose
-keep class androidx.compose.runtime.** { *; }
-keep class androidx.compose.ui.** { *; }

# Navigation
-keep class androidx.navigation.** { *; }

# Keep R8 from removing app classes
-keep class com.opsicos.app.** { *; }

# Security Crypto
-keep class androidx.security.crypto.** { *; }

# WebSocket
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}
