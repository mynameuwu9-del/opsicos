#!/bin/bash

# Build script for Opsicos Android App
# This script builds the APK for release

echo "🚀 Building Opsicos Android App..."

# Check if we're in the right directory
if [ ! -f "build.gradle.kts" ]; then
    echo "❌ Error: build.gradle.kts not found. Please run this script from the android-app directory."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean

# Build the release APK
echo "🔨 Building release APK..."
./gradlew assembleRelease

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Find the APK file
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
    
    if [ -f "$APK_PATH" ]; then
        # Copy APK to downloads folder
        cp "$APK_PATH" "downloads/opsicos-latest.apk"
        
        # Calculate file size
        SIZE=$(du -h "downloads/opsicos-latest.apk" | cut -f1)
        
        # Generate SHA-256 hash
        if command -v sha256sum &> /dev/null; then
            sha256sum "downloads/opsicos-latest.apk" > "downloads/opsicos-latest.apk.sha256"
            HASH=$(cat "downloads/opsicos-latest.apk.sha256" | cut -d' ' -f1)
            echo "📦 APK Details:"
            echo "   - Location: android-app/downloads/opsicos-latest.apk"
            echo "   - Size: $SIZE"
            echo "   - SHA-256: $HASH"
        else
            echo "⚠️ sha256sum not found, skipping hash generation"
            echo "📦 APK saved to: android-app/downloads/opsicos-latest.apk"
            echo "   - Size: $SIZE"
        fi
        
        echo ""
        echo "🎉 APK is ready for distribution!"
        echo "📱 Users can download it from: https://your-domain.com/download-app"
    else
        echo "❌ Error: APK file not found at expected location"
        exit 1
    fi
else
    echo "❌ Build failed! Please check the error messages above."
    exit 1
fi
