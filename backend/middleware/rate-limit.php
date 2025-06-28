<?php
/**
 * Rate Limiting Middleware - Complete Implementation
 * Phase 1: Authentication & Security
 */

require_once __DIR__ . '/../classes/DatabaseManager.php';

function applyRateLimit($action, $maxAttempts, $timeWindow, $identifier = null) {
    try {
        $db = DatabaseManager::getInstance();
        
        // Create rate limit table if not exists
        $db->query("
            CREATE TABLE IF NOT EXISTS rate_limits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                identifier VARCHAR(255) NOT NULL,
                action VARCHAR(100) NOT NULL,
                attempts INT DEFAULT 1,
                window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                UNIQUE KEY unique_identifier_action (identifier, action),
                INDEX idx_window_start (window_start),
                INDEX idx_action (action)
            )
        ");
        
        // Get identifier (IP address if not provided)
        if ($identifier === null) {
            $identifier = getRealIpAddr();
        }
        
        $windowStart = date('Y-m-d H:i:s', time() - $timeWindow);
        
        // Clean old entries
        $db->query("DELETE FROM rate_limits WHERE window_start < '{$windowStart}'");
        
        // Check current rate limit
        $current = $db->fetchOne("
            SELECT attempts, window_start 
            FROM rate_limits 
            WHERE identifier = ? AND action = ? AND window_start >= ?
        ", [$identifier, $action, $windowStart]);
        
        if ($current) {
            if ($current['attempts'] >= $maxAttempts) {
                // Rate limit exceeded
                http_response_code(429);
                header('Retry-After: ' . $timeWindow);
                echo json_encode([
                    'success' => false,
                    'message' => 'Rate limit exceeded. Please try again later.',
                    'retry_after' => $timeWindow
                ]);
                exit();
            } else {
                // Increment attempts
                $db->query("
                    UPDATE rate_limits 
                    SET attempts = attempts + 1, updated_at = NOW() 
                    WHERE identifier = ? AND action = ?
                ", [$identifier, $action]);
            }
        } else {
            // First attempt in this window
            $db->insert('rate_limits', [
                'identifier' => $identifier,
                'action' => $action,
                'attempts' => 1,
                'window_start' => date('Y-m-d H:i:s')
            ]);
        }
        
        // Add rate limit headers
        $remaining = max(0, $maxAttempts - ($current['attempts'] ?? 0) - 1);
        header("X-RateLimit-Limit: {$maxAttempts}");
        header("X-RateLimit-Remaining: {$remaining}");
        header("X-RateLimit-Reset: " . (time() + $timeWindow));
        
    } catch (Exception $e) {
        error_log("Rate limiting error: " . $e->getMessage());
        // Continue without rate limiting if there's an error
    }
}

function getRealIpAddr() {
    $ipKeys = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];
    
    foreach ($ipKeys as $key) {
        if (!empty($_SERVER[$key])) {
            $ips = explode(',', $_SERVER[$key]);
            $ip = trim($ips[0]);
            
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $ip;
            }
        }
    }
    
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function getRateLimitStatus($action, $identifier = null) {
    try {
        $db = DatabaseManager::getInstance();
        
        if ($identifier === null) {
            $identifier = getRealIpAddr();
        }
        
        $current = $db->fetchOne("
            SELECT attempts, window_start 
            FROM rate_limits 
            WHERE identifier = ? AND action = ?
        ", [$identifier, $action]);
        
        return $current ?: ['attempts' => 0, 'window_start' => null];
        
    } catch (Exception $e) {
        error_log("Get rate limit status error: " . $e->getMessage());
        return ['attempts' => 0, 'window_start' => null];
    }
}
