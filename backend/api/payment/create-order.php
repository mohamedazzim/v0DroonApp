<?php
/**
 * Create Payment Order API
 * Phase 3: Payment System Integration
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';
require_once '../../classes/Auth.php';
require_once '../../classes/PaymentManager.php';

// Apply rate limiting
applyRateLimit('create-payment-order', 10, 3600);

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
    
    $bookingId = $input['booking_id'] ?? '';
    $paymentMethodId = $input['payment_method_id'] ?? null;
    
    if (empty($bookingId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Booking ID is required']);
        exit();
    }
    
    // Create payment order
    $paymentManager = new PaymentManager();
    $result = $paymentManager->createPaymentOrder($bookingId, $userId, $paymentMethodId);
    
    http_response_code($result['success'] ? 201 : 400);
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("Create payment order API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
