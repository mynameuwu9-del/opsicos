package com.opsicos.app.presentation.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Opsicos Brand Colors
private val OpsicosRed = Color(0xFF8B0000) // Deep Red
private val OpsicosRedDark = Color(0xFF660000) // Darker Red
private val DiscordBlurple = Color(0xFF5865F2)
private val DiscordBlurpleDark = Color(0xFF4752C4)

// Light Color Scheme
private val LightColorScheme = lightColorScheme(
    primary = OpsicosRed,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDAD5),
    onPrimaryContainer = Color(0xFF410000),
    secondary = DiscordBlurple,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE1E0FF),
    onSecondaryContainer = Color(0xFF1A1B4B),
    tertiary = Color(0xFF775652),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFDAD5),
    onTertiaryContainer = Color(0xFF2C1512),
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    background = Color(0xFFFFFBFF),
    onBackground = Color(0xFF201A19),
    surface = Color(0xFFFFFBFF),
    onSurface = Color(0xFF201A19),
    surfaceVariant = Color(0xFFF5DDDA),
    onSurfaceVariant = Color(0xFF534341),
    outline = Color(0xFF857371),
    inverseOnSurface = Color(0xFFFBEEEC),
    inverseSurface = Color(0xFF362F2E)
)

// Dark Color Scheme
private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFFFB4A9),
    onPrimary = Color(0xFF690000),
    primaryContainer = OpsicosRedDark,
    onPrimaryContainer = Color(0xFFFFDAD5),
    secondary = Color(0xFFC3C1FF),
    onSecondary = Color(0xFF2C2D62),
    secondaryContainer = DiscordBlurpleDark,
    onSecondaryContainer = Color(0xFFE1E0FF),
    tertiary = Color(0xFFEFBDB7),
    onTertiary = Color(0xFF442925),
    tertiaryContainer = Color(0xFF5D3F3B),
    onTertiaryContainer = Color(0xFFFFDAD5),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF000000),
    onBackground = Color(0xFFEDE0DE),
    surface = Color(0xFF1A1A1A),
    onSurface = Color(0xFFEDE0DE),
    surfaceVariant = Color(0xFF534341),
    onSurfaceVariant = Color(0xFFD8C2BE),
    outline = Color(0xFFA08C8A),
    inverseOnSurface = Color(0xFF201A19),
    inverseSurface = Color(0xFFEDE0DE)
)

/**
 * Opsicos Theme
 */
@Composable
fun OpsicosTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Disable dynamic theming for consistent branding
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            // We're not using dynamic colors to maintain brand consistency
            if (darkTheme) DarkColorScheme else LightColorScheme
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

/**
 * Typography configuration
 */
val Typography = Typography(
    // You can customize typography here if needed
)
