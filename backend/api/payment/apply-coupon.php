<?php
/**
 * Apply Coupon API
 * Phase 3: Payment System Integration
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';
require_once '../../classes/Auth.php';
require_once '../../classes/PaymentManager.php';

// Apply rate limiting
applyRateLimit('apply-coupon', 30, 3600);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    // Validate session
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authorization required']);
        exit();
    }
    
    $sessionToken = substr($authHeader, 7);
    $auth = new Auth();
    $sessionResult = $auth->validateSession($sessionToken);
    
    if (!$sessionResult['valid']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid session']);
        exit();
    }
    
    $userId = $sessionResult['user']['id'];
    
    // Get request data
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    $couponCode = trim($input['coupon_code'] ?? '');
    $bookingAmount = $input['booking_amount'] ?? 0;
    $serviceCategory = $input['service_category'] ?? '';
    
    if (empty($couponCode) || $bookingAmount <= 0 || empty($serviceCategory)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Coupon code, booking amount, and service category are required']);
        exit();
    }
    
    // Apply coupon
    $paymentManager = new PaymentManager();
    $result = $paymentManager->applyCoupon($couponCode, $bookingAmount, $serviceCategory, $userId);
    
    http_response_code($result['success'] ? 200 : 400);
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("Apply coupon API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
