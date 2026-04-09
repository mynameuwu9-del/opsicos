package com.opsicos.app.presentation.screens.playground

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
 * Playground Screen - Test AI models
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaygroundScreen(
    navController: NavController
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("AI Playground") },
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
                text = "AI Playground Coming Soon",
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
