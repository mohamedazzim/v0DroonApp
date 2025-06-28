<?php
/**
 * Razorpay Webhook Handler
 * Phase 3: Payment System Integration
 */

require_once '../../classes/DatabaseManager.php';
require_once '../../classes/PaymentManager.php';
require_once '../../classes/SecurityLogger.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit();
}

try {
    $db = DatabaseManager::getInstance();
    $logger = new SecurityLogger();
    
    // Get webhook payload
    $payload = file_get_contents('php://input');
    $signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
    
    if (empty($payload) || empty($signature)) {
        http_response_code(400);
        exit();
    }
    
    // Verify webhook signature
    $webhookSecret = $_ENV['RAZORPAY_WEBHOOK_SECRET'] ?? '';
    $expectedSignature = hash_hmac('sha256', $payload, $webhookSecret);
    
    if (!hash_equals($expectedSignature, $signature)) {
        $logger->log(null, 'webhook_signature_mismatch', [
            'source' => 'razorpay',
            'signature_received' => $signature
        ], 'high');
        
        http_response_code(400);
        exit();
    }
    
    $data = json_decode($payload, true);
    
    if (!$data) {
        http_response_code(400);
        exit();
    }
    
    // Log webhook
    $stmt = $db->prepare("
        INSERT INTO payment_webhooks (webhook_id, event_type, payment_id, order_id, signature, payload)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    
    $webhookId = $data['id'] ?? uniqid();
    $eventType = $data['event'] ?? '';
    $paymentId = $data['payload']['payment']['entity']['id'] ?? '';
    $orderId = $data['payload']['payment']['entity']['order_id'] ?? '';
    
    $stmt->bind_param("ssssss", $webhookId, $eventType, $paymentId, $orderId, $signature, $payload);
    $stmt->execute();
    
    // Process webhook based on event type
    switch ($eventType) {
        case 'payment.captured':
            // Payment successful - already handled in verify endpoint
            break;
            
        case 'payment.failed':
            // Handle failed payment
            $this->handleFailedPayment($data);
            break;
            
        case 'refund.processed':
            // Handle refund processed
            $this->handleRefundProcessed($data);
            break;
            
        default:
            // Log unknown event
            $logger->log(null, 'webhook_unknown_event', [
                'event_type' => $eventType,
                'webhook_id' => $webhookId
            ], 'medium');
    }
    
    // Mark webhook as processed
    $stmt = $db->prepare("UPDATE payment_webhooks SET processed = TRUE, processed_at = NOW() WHERE webhook_id = ?");
    $stmt->bind_param("s", $webhookId);
    $stmt->execute();
    
    http_response_code(200);
    echo json_encode(['status' => 'success']);
    
} catch (Exception $e) {
    error_log("Webhook processing error: " . $e->getMessage());
    http_response_code(500);
}

function handleFailedPayment($data) {
    // Implementation for handling failed payments
}

function handleRefundProcessed($data) {
    // Implementation for handling processed refunds
}
?>
