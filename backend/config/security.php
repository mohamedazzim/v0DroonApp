<?php
/**
 * Security Configuration - Complete Implementation
 * Phase 1: Authentication & Security
 */

class SecurityConfig {
    // Database Configuration
    const DB_HOST = 'localhost';
    const DB_PORT = 3306;
    const DB_NAME = 'drone_booking';
    const DB_USER = 'root';
    const DB_PASS = '';
    
    // JWT Configuration
    const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
    const JWT_EXPIRY = 86400; // 24 hours
    const JWT_REFRESH_EXPIRY = 604800; // 7 days
    
    // Session Configuration
    const SESSION_LIFETIME = 86400; // 24 hours
    const SESSION_REMEMBER_LIFETIME = 2592000; // 30 days
    
    // Password Configuration
    const PASSWORD_MIN_LENGTH = 8;
    const PASSWORD_REQUIRE_UPPERCASE = true;
    const PASSWORD_REQUIRE_LOWERCASE = true;
    const PASSWORD_REQUIRE_NUMBERS = true;
    const PASSWORD_REQUIRE_SYMBOLS = true;
    const PASSWORD_HASH_ALGO = PASSWORD_ARGON2ID;
    const PASSWORD_HASH_OPTIONS = [
        'memory_cost' => 65536,
        'time_cost' => 4,
        'threads' => 3
    ];
    
    // Email Configuration
    const SMTP_HOST = 'smtp.gmail.com';
    const SMTP_PORT = 587;
    const SMTP_USERNAME = 'your-email@gmail.com';
    const SMTP_PASSWORD = 'your-app-password';
    const FROM_EMAIL = 'noreply@droneservicepro.com';
    const FROM_NAME = 'Drone Service Pro';
    
    // Application URLs
    const FRONTEND_URL = 'http://localhost:3000';
    const BACKEND_URL = 'http://localhost:8000';
    
    // File Upload Security
    const MAX_FILE_SIZE = 10485760; // 10MB
    const ALLOWED_FILE_TYPES = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];
    const UPLOAD_PATH = __DIR__ . '/../storage/uploads/';
    
    // Rate Limiting
    const RATE_LIMIT_ENABLED = true;
    const DEFAULT_RATE_LIMIT = 100;
    const LOGIN_RATE_LIMIT = 10;
    const API_RATE_LIMIT = 200;
    
    // Security Headers
    const SECURITY_HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'X-XSS-Protection' => '1; mode=block',
        'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy' => "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        'Referrer-Policy' => 'strict-origin-when-cross-origin'
    ];
    
    // Encryption
    const ENCRYPTION_METHOD = 'AES-256-CBC';
    const ENCRYPTION_KEY = 'your-32-character-encryption-key-here';
    
    // Token Expiry Times
    const EMAIL_VERIFICATION_EXPIRY = 86400; // 24 hours
    const PASSWORD_RESET_EXPIRY = 3600; // 1 hour
    const SESSION_TOKEN_EXPIRY = 86400; // 24 hours
    
    // Account Security
    const MAX_LOGIN_ATTEMPTS = 5;
    const ACCOUNT_LOCK_DURATION = 1800; // 30 minutes
    const FORCE_PASSWORD_CHANGE_DAYS = 90;
    
    public static function applySecurityHeaders() {
        foreach (self::SECURITY_HEADERS as $header => $value) {
            header("{$header}: {$value}");
        }
    }
    
    public static function validateFileUpload($file) {
        if ($file['size'] > self::MAX_FILE_SIZE) {
            return ['valid' => false, 'message' => 'File size exceeds maximum allowed size'];
        }
        
        $fileExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($fileExtension, self::ALLOWED_FILE_TYPES)) {
            return ['valid' => false, 'message' => 'File type not allowed'];
        }
        
        return ['valid' => true];
    }
    
    public static function sanitizeInput($input) {
        if (is_array($input)) {
            return array_map([self::class, 'sanitizeInput'], $input);
        }
        
        return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }
    
    public static function generateSecureToken($length = 32) {
        return bin2hex(random_bytes($length));
    }
    
    public static function encrypt($data) {
        $iv = random_bytes(openssl_cipher_iv_length(self::ENCRYPTION_METHOD));
        $encrypted = openssl_encrypt($data, self::ENCRYPTION_METHOD, self::ENCRYPTION_KEY, 0, $iv);
        return base64_encode($encrypted . '::' . $iv);
    }
    
    public static function decrypt($data) {
        $data = base64_decode($data);
        list($encrypted_data, $iv) = explode('::', $data, 2);
        return openssl_decrypt($encrypted_data, self::ENCRYPTION_METHOD, self::ENCRYPTION_KEY, 0, $iv);
    }
}
