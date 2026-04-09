package com.opsicos.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.navigation.compose.rememberNavController
import com.google.accompanist.systemuicontroller.rememberSystemUiController
import com.opsicos.app.presentation.navigation.OpsicosNavigation
import com.opsicos.app.presentation.theme.OpsicosTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Main Activity - Entry point of the Opsicos Android App
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        // Install splash screen before super.onCreate
        installSplashScreen()
        
        super.onCreate(savedInstanceState)
        
        // Enable edge-to-edge display
        WindowCompat.setDecorFitsSystemWindows(window, false)
        
        setContent {
            OpsicosTheme {
                // Remember system UI controller for status bar customization
                val systemUiController = rememberSystemUiController()
                val useDarkIcons = false // We'll use dark theme by default
                
                // Set status bar color
                SideEffect {
                    systemUiController.setSystemBarsColor(
                        color = androidx.compose.ui.graphics.Color.Transparent,
                        darkIcons = useDarkIcons
                    )
                }
                
                // Main app surface
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    OpsicosNavigation(navController = navController)
                }
            }
        }
    }
}
