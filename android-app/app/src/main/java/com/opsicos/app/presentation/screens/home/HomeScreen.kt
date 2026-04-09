package com.opsicos.app.presentation.screens.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.opsicos.app.presentation.navigation.Screen

/**
 * Home Screen - Main dashboard of the app
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    navController: NavController
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        text = "Opsicos Dashboard",
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    IconButton(onClick = { navController.navigate(Screen.Settings.route) }) {
                        Icon(Icons.Filled.Settings, contentDescription = "Settings")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = true,
                    onClick = { },
                    icon = { Icon(Icons.Filled.Home, contentDescription = "Home") },
                    label = { Text("Home") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = { navController.navigate(Screen.Bots.route) },
                    icon = { Icon(Icons.Filled.Android, contentDescription = "Bots") },
                    label = { Text("Bots") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = { navController.navigate(Screen.Playground.route) },
                    icon = { Icon(Icons.Filled.PlayArrow, contentDescription = "Playground") },
                    label = { Text("AI Chat") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = { navController.navigate(Screen.Settings.route) },
                    icon = { Icon(Icons.Filled.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") }
                )
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Stats Cards
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    StatsCard(
                        title = "Active Bots",
                        value = "3",
                        icon = Icons.Filled.Android,
                        modifier = Modifier.weight(1f)
                    )
                    StatsCard(
                        title = "Messages",
                        value = "1.2K",
                        icon = Icons.Filled.Message,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    StatsCard(
                        title = "Commands",
                        value = "456",
                        icon = Icons.Filled.Terminal,
                        modifier = Modifier.weight(1f)
                    )
                    StatsCard(
                        title = "API Calls",
                        value = "892",
                        icon = Icons.Filled.Api,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            
            // Quick Actions
            item {
                Text(
                    text = "Quick Actions",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }
            
            item {
                QuickActionCard(
                    title = "Create New Bot",
                    description = "Set up a new Discord bot",
                    icon = Icons.Filled.Add,
                    onClick = { navController.navigate(Screen.Bots.route) }
                )
            }
            
            item {
                QuickActionCard(
                    title = "Test AI Models",
                    description = "Try out different AI models",
                    icon = Icons.Filled.Psychology,
                    onClick = { navController.navigate(Screen.Playground.route) }
                )
            }
            
            item {
                QuickActionCard(
                    title = "View Analytics",
                    description = "Check your bot performance",
                    icon = Icons.Filled.Analytics,
                    onClick = { /* TODO: Navigate to analytics */ }
                )
            }
        }
    }
}

@Composable
fun StatsCard(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Text(
                text = title,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickActionCard(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = description,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
