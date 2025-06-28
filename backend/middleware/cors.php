<?php
/**
 * CORS Middleware - Complete Implementation
 * Phase 1: Authentication & Security
 */

require_once '../config/security.php';

function handleCORS() {
    $allowedOrigins = [
        'http://localhost:3000',
        'https://localhost:3000',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000'
    ];
    
    // Add production domains from environment
    if (!empty($_ENV['ALLOWED_ORIGINS'])) {
        $envOrigins = explode(',', $_ENV['ALLOWED_ORIGINS']);
        $allowedOrigins = array_merge($allowedOrigins, array_map('trim', $envOrigins));
    }
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // Check if origin is allowed
    if (in_array($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: {$origin}");
    } else {
        // For development, allow localhost variations
        if (preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/', $origin)) {
            header("Access-Control-Allow-Origin: {$origin}");
        }
    }
    
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
    header('Access-Control-Max-Age: 86400'); // 24 hours
    
    // Handle preflight requests
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}

// Apply CORS headers
handleCORS();
