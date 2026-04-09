package com.opsicos.app.presentation.screens.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * API Key entry screen - First screen users see to enter their API key
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ApiKeyScreen(
    onApiKeyVerified: () -> Unit
) {
    var apiKey by remember { mutableStateOf("") }
    var isPasswordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // App Icon/Logo placeholder
        Icon(
            imageVector = Icons.Filled.Android,
            contentDescription = "Opsicos Logo",
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Welcome Text
        Text(
            text = "Welcome to Opsicos",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = "Enter your API key to get started",
            fontSize = 16.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        // API Key Input Field
        OutlinedTextField(
            value = apiKey,
            onValueChange = { 
                apiKey = it
                errorMessage = null // Clear error when user types
            },
            label = { Text("API Key") },
            placeholder = { Text("osk_personal_...") },
            singleLine = true,
            isError = errorMessage != null,
            visualTransformation = if (isPasswordVisible) {
                VisualTransformation.None
            } else {
                PasswordVisualTransformation()
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(
                onDone = {
                    if (apiKey.isNotBlank()) {
                        validateAndSaveApiKey(apiKey, onApiKeyVerified)
                    }
                }
            ),
            trailingIcon = {
                IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) {
                    Icon(
                        imageVector = if (isPasswordVisible) {
                            Icons.Filled.VisibilityOff
                        } else {
                            Icons.Filled.Visibility
                        },
                        contentDescription = if (isPasswordVisible) {
                            "Hide API Key"
                        } else {
                            "Show API Key"
                        }
                    )
                }
            },
            modifier = Modifier.fillMaxWidth()
        )
        
        // Error Message
        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                fontSize = 14.sp
            )
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Continue Button
        Button(
            onClick = {
                if (apiKey.isNotBlank()) {
                    isLoading = true
                    validateAndSaveApiKey(apiKey, onApiKeyVerified)
                }
            },
            enabled = apiKey.isNotBlank() && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Icon(
                    imageVector = Icons.Filled.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Continue",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Help Text
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            )
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.Top
            ) {
                Icon(
                    imageVector = Icons.Filled.Info,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "You can find your API key in the web dashboard under Settings or in the Android Admin Panel.",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 20.sp
                )
            }
        }
    }
}

/**
 * Validates and saves the API key
 */
private fun validateAndSaveApiKey(
    apiKey: String,
    onSuccess: () -> Unit
) {
    // TODO: Implement actual API validation
    // For now, we'll just check if it starts with the expected prefix
    if (apiKey.startsWith("osk_personal_")) {
        // Save to secure storage
        // TODO: Implement secure storage using DataStore
        onSuccess()
    }
}
