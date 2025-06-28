<?php
/**
 * Rate Limiter Class
 * Phase 1: Authentication & Security
 */

require_once 'config/database.php';
require_once 'config/security.php';

class RateLimiter {
    private $db;
    private $tableName = 'rate_limits';
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->createTableIfNotExists();
    }
    
    private function createTableIfNotExists() {
        $sql = "
        CREATE TABLE IF NOT EXISTS rate_limits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            identifier VARCHAR(255) NOT NULL,
            endpoint VARCHAR(255) NOT NULL,
            requests INT DEFAULT 1,
            window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            UNIQUE KEY unique_limit (identifier, endpoint),
            INDEX idx_identifier (identifier),
            INDEX idx_endpoint (endpoint),
            INDEX idx_window_start (window_start)
        )";
        
        try {
            $this->db->getConnection()->query($sql);
        } catch (Exception $e) {
            error_log("Rate limiter table creation failed: " . $e->getMessage());
        }
    }
    
    public function isAllowed($identifier, $endpoint, $maxRequests = null, $windowSeconds = null) {
        $maxRequests = $maxRequests ?? SecurityConfig::RATE_LIMIT_REQUESTS;
        $windowSeconds = $windowSeconds ?? SecurityConfig::RATE_LIMIT_WINDOW;
        
        try {
            $conn = $this->db->getConnection();
            $conn->begin_transaction();
            
            // Clean old entries
            $this->cleanOldEntries($windowSeconds);
            
            // Get current window start
            $windowStart = date('Y-m-d H:i:s', time() - $windowSeconds);
            
            // Check existing record
            $stmt = $this->db->prepare("
                SELECT requests, window_start 
                FROM rate_limits 
                WHERE identifier = ? AND endpoint = ?
            ");
            $stmt->bind_param("ss", $identifier, $endpoint);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $row = $result->fetch_assoc();
                $currentWindowStart = strtotime($row['window_start']);
                $currentRequests = $row['requests'];
                
                // Check if we're in the same window
                if ($currentWindowStart >= strtotime($windowStart)) {
                    if ($currentRequests >= $maxRequests) {
                        $conn->rollback();
                        return [
                            'allowed' => false,
                            'requests' => $currentRequests,
                            'max_requests' => $maxRequests,
                            'reset_time' => $currentWindowStart + $windowSeconds
                        ];
                    }
                    
                    // Increment requests
                    $stmt = $this->db->prepare("
                        UPDATE rate_limits 
                        SET requests = requests + 1, updated_at = NOW() 
                        WHERE identifier = ? AND endpoint = ?
                    ");
                    $stmt->bind_param("ss", $identifier, $endpoint);
                    $stmt->execute();
                    
                    $conn->commit();
                    return [
                        'allowed' => true,
                        'requests' => $currentRequests + 1,
                        'max_requests' => $maxRequests,
                        'reset_time' => $currentWindowStart + $windowSeconds
                    ];
                } else {
                    // New window, reset counter
                    $stmt = $this->db->prepare("
                        UPDATE rate_limits 
                        SET requests = 1, window_start = NOW(), updated_at = NOW() 
                        WHERE identifier = ? AND endpoint = ?
                    ");
                    $stmt->bind_param("ss", $identifier, $endpoint);
                    $stmt->execute();
                }
            } else {
                // First request
                $stmt = $this->db->prepare("
                    INSERT INTO rate_limits (identifier, endpoint, requests, window_start) 
                    VALUES (?, ?, 1, NOW())
                ");
                $stmt->bind_param("ss", $identifier, $endpoint);
                $stmt->execute();
            }
            
            $conn->commit();
            return [
                'allowed' => true,
                'requests' => 1,
                'max_requests' => $maxRequests,
                'reset_time' => time() + $windowSeconds
            ];
            
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Rate limiter error: " . $e->getMessage());
            // Allow request on error to prevent blocking legitimate users
            return [
                'allowed' => true,
                'requests' => 0,
                'max_requests' => $maxRequests,
                'reset_time' => time() + $windowSeconds
            ];
        }
    }
    
    private function cleanOldEntries($windowSeconds) {
        try {
            $cutoff = date('Y-m-d H:i:s', time() - ($windowSeconds * 2));
            $stmt = $this->db->prepare("DELETE FROM rate_limits WHERE window_start < ?");
            $stmt->bind_param("s", $cutoff);
            $stmt->execute();
        } catch (Exception $e) {
            error_log("Rate limiter cleanup error: " . $e->getMessage());
        }
    }
    
    public function getIdentifier() {
        // Use IP + User Agent for identification
        $ip = $this->getClientIP();
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        return hash('sha256', $ip . $userAgent);
    }
    
    private function getClientIP() {
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
}
