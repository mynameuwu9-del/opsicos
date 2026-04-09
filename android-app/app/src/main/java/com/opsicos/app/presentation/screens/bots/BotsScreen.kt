package com.opsicos.app.presentation.screens.bots

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController

/**
 * Bots Screen - Manage Discord bots
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BotsScreen(
    navController: NavController
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Bots") },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(
                            imageVector = androidx.compose.material.icons.Icons.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Bots Management Coming Soon",
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
