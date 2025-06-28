<?php
/**
 * Security Logger Class - Complete Implementation
 * Phase 1: Authentication & Security
 */

require_once 'DatabaseManager.php';

class SecurityLogger {
    private $db;
    private $tableName = 'security_logs';
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
        $this->createTableIfNotExists();
    }
    
    private function createTableIfNotExists() {
        $sql = "
        CREATE TABLE IF NOT EXISTS security_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            event_type VARCHAR(100) NOT NULL,
            event_data JSON,
            ip_address VARCHAR(45),
            user_agent TEXT,
            request_uri VARCHAR(500),
            request_method VARCHAR(10),
            session_id VARCHAR(255),
            severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_user_id (user_id),
            INDEX idx_event_type (event_type),
            INDEX idx_severity (severity),
            INDEX idx_created_at (created_at),
            INDEX idx_ip_address (ip_address)
        )";
        
        try {
            $this->db->query($sql);
        } catch (Exception $e) {
            error_log("Security logs table creation failed: " . $e->getMessage());
        }
    }
    
    public function log($userId, $eventType, $eventData = [], $severity = 'medium') {
        try {
            $ipAddress = $this->getClientIP();
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
            $requestUri = $_SERVER['REQUEST_URI'] ?? '';
            $requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';
            $sessionId = session_id() ?: '';
            
            // Add timestamp and additional context to event data
            $eventData['timestamp'] = date('Y-m-d H:i:s');
            $eventData['server_time'] = time();
            
            // Add request context if available
            if (!empty($_POST)) {
                $eventData['post_data_keys'] = array_keys($_POST);
            }
            if (!empty($_GET)) {
                $eventData['get_data_keys'] = array_keys($_GET);
            }
            
            $stmt = $this->db->prepare("
                INSERT INTO security_logs 
                (user_id, event_type, event_data, ip_address, user_agent, request_uri, request_method, session_id, severity) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $eventDataJson = json_encode($eventData);
            $stmt->bind_param(
                "issssssss", 
                $userId, 
                $eventType, 
                $eventDataJson, 
                $ipAddress, 
                $userAgent, 
                $requestUri, 
                $requestMethod, 
                $sessionId, 
                $severity
            );
            
            $stmt->execute();
            
            // Log critical events to system log as well
            if ($severity === 'critical') {
                error_log("CRITICAL SECURITY EVENT: $eventType for user $userId from IP $ipAddress");
            }
            
            return true;
            
        } catch (Exception $e) {
            error_log("Security logging failed: " . $e->getMessage());
            return false;
        }
    }
    
    public function logLoginAttempt($email, $success, $failureReason = '') {
        $eventData = [
            'email' => $email,
            'success' => $success,
            'failure_reason' => $failureReason
        ];
        
        $severity = $success ? 'low' : 'medium';
        return $this->log(null, 'login_attempt', $eventData, $severity);
    }
    
    public function logSuspiciousActivity($userId, $activityType, $details = []) {
        $eventData = array_merge($details, [
            'activity_type' => $activityType,
            'flagged_as_suspicious' => true
        ]);
        
        return $this->log($userId, 'suspicious_activity', $eventData, 'high');
    }
    
    public function logDataAccess($userId, $dataType, $recordId, $action = 'read') {
        $eventData = [
            'data_type' => $dataType,
            'record_id' => $recordId,
            'action' => $action
        ];
        
        return $this->log($userId, 'data_access', $eventData, 'low');
    }
    
    public function logPermissionDenied($userId, $resource, $requiredPermission) {
        $eventData = [
            'resource' => $resource,
            'required_permission' => $requiredPermission,
            'access_denied' => true
        ];
        
        return $this->log($userId, 'permission_denied', $eventData, 'medium');
    }
    
    public function logSystemEvent($eventType, $details = [], $severity = 'medium') {
        return $this->log(null, $eventType, $details, $severity);
    }
    
    public function getSecurityEvents($userId = null, $eventType = null, $severity = null, $limit = 100, $offset = 0) {
        try {
            $whereConditions = [];
            $params = [];
            $types = '';
            
            if ($userId !== null) {
                $whereConditions[] = 'user_id = ?';
                $params[] = $userId;
                $types .= 'i';
            }
            
            if ($eventType !== null) {
                $whereConditions[] = 'event_type = ?';
                $params[] = $eventType;
                $types .= 's';
            }
            
            if ($severity !== null) {
                $whereConditions[] = 'severity = ?';
                $params[] = $severity;
                $types .= 's';
            }
            
            $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
            
            $query = "
                SELECT sl.*, u.full_name, u.email 
                FROM security_logs sl
                LEFT JOIN users u ON sl.user_id = u.id
                $whereClause
                ORDER BY sl.created_at DESC
                LIMIT ? OFFSET ?
            ";
            
            $params[] = $limit;
            $params[] = $offset;
            $types .= 'ii';
            
            $stmt = $this->db->prepare($query);
            if (!empty($params)) {
                $stmt->bind_param($types, ...$params);
            }
            $stmt->execute();
            $result = $stmt->get_result();
            
            $events = [];
            while ($row = $result->fetch_assoc()) {
                $row['event_data'] = json_decode($row['event_data'], true);
                $events[] = $row;
            }
            
            return $events;
            
        } catch (Exception $e) {
            error_log("Get security events error: " . $e->getMessage());
            return [];
        }
    }
    
    public function getSecuritySummary($days = 7) {
        try {
            $startDate = date('Y-m-d H:i:s', time() - ($days * 86400));
            
            $stmt = $this->db->prepare("
                SELECT 
                    event_type,
                    severity,
                    COUNT(*) as count,
                    DATE(created_at) as event_date
                FROM security_logs 
                WHERE created_at >= ?
                GROUP BY event_type, severity, DATE(created_at)
                ORDER BY event_date DESC, severity DESC
            ");
            $stmt->bind_param("s", $startDate);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $summary = [];
            while ($row = $result->fetch_assoc()) {
                $summary[] = $row;
            }
            
            return $summary;
            
        } catch (Exception $e) {
            error_log("Get security summary error: " . $e->getMessage());
            return [];
        }
    }
    
    public function cleanOldLogs($daysToKeep = 90) {
        try {
            $cutoffDate = date('Y-m-d H:i:s', time() - ($daysToKeep * 86400));
            
            $stmt = $this->db->prepare("DELETE FROM security_logs WHERE created_at < ?");
            $stmt->bind_param("s", $cutoffDate);
            $stmt->execute();
            
            $deletedRows = $stmt->affected_rows;
            
            if ($deletedRows > 0) {
                $this->log(null, 'security_logs_cleanup', [
                    'deleted_rows' => $deletedRows,
                    'cutoff_date' => $cutoffDate
                ], 'low');
            }
            
            return $deletedRows;
            
        } catch (Exception $e) {
            error_log("Security logs cleanup error: " . $e->getMessage());
            return 0;
        }
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
