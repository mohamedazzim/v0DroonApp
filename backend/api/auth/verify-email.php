<?php
/**
 * Email Verification API
 * Phase 1: Authentication & Security
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';

// Apply rate limiting (10 verification attempts per hour)
applyRateLimit('verify-email', 10, 3600);

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
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    $token = trim($input['token'] ?? '');
    
    if (empty($token)) {
        echo json_encode(['success' => false, 'message' => 'Verification token is required']);
        exit();
    }
    
    $auth = new Auth();
    $result = $auth->verifyEmail($token);
    
    http_response_code($result['success'] ? 200 : 400);
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("Email verification API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
