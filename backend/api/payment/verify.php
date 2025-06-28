<?php
/**
 * Verify Payment API
 * Phase 3: Payment System Integration
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';
require_once '../../classes/PaymentManager.php';

// Apply rate limiting
applyRateLimit('verify-payment', 20, 3600);

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
    // Get request data
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    $razorpayOrderId = $input['razorpay_order_id'] ?? '';
    $razorpayPaymentId = $input['razorpay_payment_id'] ?? '';
    $razorpaySignature = $input['razorpay_signature'] ?? '';
    
    if (empty($razorpayOrderId) || empty($razorpayPaymentId) || empty($razorpaySignature)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'All payment parameters are required']);
        exit();
    }
    
    // Verify payment
    $paymentManager = new PaymentManager();
    $result = $paymentManager->verifyPayment($razorpayOrderId, $razorpayPaymentId, $razorpaySignature);
    
    http_response_code($result['success'] ? 200 : 400);
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("Verify payment API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
