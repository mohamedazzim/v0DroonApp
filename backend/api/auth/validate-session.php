<?php
/**
 * Session Validation API
 * Phase 1: Authentication & Security
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';

// Apply rate limiting
applyRateLimit('validate-session', 200, 3600);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

require_once '../../classes/Auth.php';

try {
    // Get session token from Authorization header
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['valid' => false, 'message' => 'Invalid authorization header']);
        exit();
    }
    
    $sessionToken = substr($authHeader, 7);
    
    if (empty($sessionToken)) {
        http_response_code(401);
        echo json_encode(['valid' => false, 'message' => 'Session token is required']);
        exit();
    }
    
    $auth = new Auth();
    $result = $auth->validateSession($sessionToken);
    
    http_response_code($result['valid'] ? 200 : 401);
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("Session validation API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['valid' => false, 'message' => 'Internal server error']);
}
?>
