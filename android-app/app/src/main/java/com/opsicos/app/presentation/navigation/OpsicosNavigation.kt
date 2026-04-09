package com.opsicos.app.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.opsicos.app.presentation.screens.auth.ApiKeyScreen
import com.opsicos.app.presentation.screens.home.HomeScreen
import com.opsicos.app.presentation.screens.bots.BotsScreen
import com.opsicos.app.presentation.screens.playground.PlaygroundScreen
import com.opsicos.app.presentation.screens.settings.SettingsScreen

/**
 * Navigation component for the Opsicos app
 */
@Composable
fun OpsicosNavigation(
    navController: NavHostController,
    startDestination: String = Screen.ApiKey.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // API Key Entry Screen (First time setup)
        composable(route = Screen.ApiKey.route) {
            ApiKeyScreen(
                onApiKeyVerified = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.ApiKey.route) { inclusive = true }
                    }
                }
            )
        }
        
        // Home Screen (Dashboard)
        composable(route = Screen.Home.route) {
            HomeScreen(navController = navController)
        }
        
        // Bots Management Screen
        composable(route = Screen.Bots.route) {
            BotsScreen(navController = navController)
        }
        
        // AI Playground Screen
        composable(route = Screen.Playground.route) {
            PlaygroundScreen(navController = navController)
        }
        
        // Settings Screen
        composable(route = Screen.Settings.route) {
            SettingsScreen(navController = navController)
        }
    }
}

/**
 * Sealed class representing all screens in the app
 */
sealed class Screen(val route: String, val title: String) {
    object ApiKey : Screen("api_key", "API Key Setup")
    object Home : Screen("home", "Dashboard")
    object Bots : Screen("bots", "My Bots")
    object Playground : Screen("playground", "AI Playground")
    object Settings : Screen("settings", "Settings")
}
