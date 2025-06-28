<?php
/**
 * Payment Manager with Razorpay Integration
 * Phase 3: Payment System Integration
 */

require_once 'DatabaseManager.php';
require_once 'ConfigManager.php';
require_once 'SecurityLogger.php';
require_once 'EmailService.php';

class PaymentManager {
    private $db;
    private $config;
    private $logger;
    private $emailService;
    private $razorpayKeyId;
    private $razorpayKeySecret;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
        $this->config = ConfigManager::getInstance();
        $this->logger = new SecurityLogger();
        $this->emailService = new EmailService();
        
        $this->razorpayKeyId = $_ENV['RAZORPAY_KEY_ID'] ?? '';
        $this->razorpayKeySecret = $_ENV['RAZORPAY_KEY_SECRET'] ?? '';
        
        if (empty($this->razorpayKeyId) || empty($this->razorpayKeySecret)) {
            throw new Exception('Razorpay credentials not configured');
        }
    }
    
    public function createPaymentOrder($bookingId, $userId, $paymentMethodId = null) {
        try {
            // Get booking details
            $booking = $this->getBookingDetails($bookingId, $userId);
            if (!$booking) {
                return ['success' => false, 'message' => 'Booking not found'];
            }
            
            if ($booking['status'] !== 'pending') {
                return ['success' => false, 'message' => 'Booking is not in pending status'];
            }
            
            // Create Razorpay order
            $orderData = [
                'amount' => $booking['total_amount'] * 100, // Convert to paise
                'currency' => $booking['currency'],
                'receipt' => 'booking_' . $bookingId . '_' . time(),
                'notes' => [
                    'booking_id' => $bookingId,
                    'user_id' => $userId,
                    'service_name' => $booking['service_name']
                ]
            ];
            
            $razorpayOrder = $this->createRazorpayOrder($orderData);
            if (!$razorpayOrder) {
                return ['success' => false, 'message' => 'Failed to create payment order'];
            }
            
            // Create transaction record
            $transactionId = $this->createTransactionRecord($bookingId, $userId, $razorpayOrder, $paymentMethodId);
            
            if (!$transactionId) {
                return ['success' => false, 'message' => 'Failed to create transaction record'];
            }
            
            // Generate invoice
            $invoice = $this->generateInvoice($bookingId, $transactionId);
            
            return [
                'success' => true,
                'data' => [
                    'transaction_id' => $transactionId,
                    'razorpay_order_id' => $razorpayOrder['id'],
                    'amount' => $razorpayOrder['amount'],
                    'currency' => $razorpayOrder['currency'],
                    'key_id' => $this->razorpayKeyId,
                    'invoice' => $invoice
                ]
            ];
            
        } catch (Exception $e) {
            error_log("Create payment order error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Payment order creation failed'];
        }
    }
    
    public function verifyPayment($razorpayOrderId, $razorpayPaymentId, $razorpaySignature) {
        try {
            // Verify signature
            $expectedSignature = hash_hmac('sha256', $razorpayOrderId . '|' . $razorpayPaymentId, $this->razorpayKeySecret);
            
            if (!hash_equals($expectedSignature, $razorpaySignature)) {
                $this->logger->log(null, 'payment_verification_failed', [
                    'razorpay_order_id' => $razorpayOrderId,
                    'razorpay_payment_id' => $razorpayPaymentId,
                    'reason' => 'signature_mismatch'
                ], 'high');
                
                return ['success' => false, 'message' => 'Payment verification failed'];
            }
            
            // Get transaction details
            $transaction = $this->getTransactionByRazorpayOrderId($razorpayOrderId);
            if (!$transaction) {
                return ['success' => false, 'message' => 'Transaction not found'];
            }
            
            // Get payment details from Razorpay
            $paymentDetails = $this->getRazorpayPaymentDetails($razorpayPaymentId);
            if (!$paymentDetails) {
                return ['success' => false, 'message' => 'Failed to fetch payment details'];
            }
            
            $dbTransaction = $this->db->beginTransaction();
            
            try {
                // Update transaction status
                $stmt = $dbTransaction->prepare("
                    UPDATE payment_transactions 
                    SET status = 'completed',
                        razorpay_payment_id = ?,
                        razorpay_signature = ?,
                        gateway_response = ?,
                        processed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = ?
                ");
                
                $gatewayResponse = json_encode($paymentDetails);
                $stmt->bind_param("sssi", $razorpayPaymentId, $razorpaySignature, $gatewayResponse, $transaction['id']);
                $stmt->execute();
                
                // Update booking status to confirmed
                $stmt = $dbTransaction->prepare("
                    UPDATE bookings 
                    SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
                    WHERE id = ?
                ");
                $stmt->bind_param("i", $transaction['booking_id']);
                $stmt->execute();
                
                // Update invoice status
                $stmt = $dbTransaction->prepare("
                    UPDATE invoices 
                    SET status = 'paid', paid_at = NOW(), paid_amount = total_amount, updated_at = NOW()
                    WHERE transaction_id = ?
                ");
                $stmt->bind_param("i", $transaction['id']);
                $stmt->execute();
                
                $dbTransaction->commit();
                
                // Log successful payment
                $this->logger->log($transaction['user_id'], 'payment_completed', [
                    'transaction_id' => $transaction['id'],
                    'booking_id' => $transaction['booking_id'],
                    'amount' => $transaction['amount'],
                    'razorpay_payment_id' => $razorpayPaymentId
                ], 'low');
                
                // Send confirmation email
                $this->sendPaymentConfirmationEmail($transaction);
                
                return [
                    'success' => true,
                    'message' => 'Payment verified successfully',
                    'data' => [
                        'transaction_id' => $transaction['id'],
                        'booking_id' => $transaction['booking_id'],
                        'status' => 'completed'
                    ]
                ];
                
            } catch (Exception $e) {
                $dbTransaction->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            error_log("Payment verification error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Payment verification failed'];
        }
    }
    
    public function processRefund($transactionId, $refundAmount, $reason, $userId = null) {
        try {
            // Get transaction details
            $transaction = $this->getTransactionById($transactionId);
            if (!$transaction) {
                return ['success' => false, 'message' => 'Transaction not found'];
            }
            
            if ($userId && $transaction['user_id'] != $userId) {
                return ['success' => false, 'message' => 'Access denied'];
            }
            
            if ($transaction['status'] !== 'completed') {
                return ['success' => false, 'message' => 'Transaction is not completed'];
            }
            
            if ($refundAmount > $transaction['amount']) {
                return ['success' => false, 'message' => 'Refund amount cannot exceed transaction amount'];
            }
            
            // Check if already refunded
            $existingRefund = $this->getRefundByTransactionId($transactionId);
            if ($existingRefund) {
                return ['success' => false, 'message' => 'Refund already processed for this transaction'];
            }
            
            // Create refund with Razorpay
            $refundData = [
                'amount' => $refundAmount * 100, // Convert to paise
                'notes' => [
                    'reason' => $reason,
                    'transaction_id' => $transactionId,
                    'booking_id' => $transaction['booking_id']
                ]
            ];
            
            $razorpayRefund = $this->createRazorpayRefund($transaction['razorpay_payment_id'], $refundData);
            if (!$razorpayRefund) {
                return ['success' => false, 'message' => 'Failed to process refund with payment gateway'];
            }
            
            $dbTransaction = $this->db->beginTransaction();
            
            try {
                // Create refund record
                $stmt = $dbTransaction->prepare("
                    INSERT INTO refunds (
                        refund_id, transaction_id, booking_id, user_id,
                        refund_amount, refund_reason, refund_type,
                        gateway_refund_id, gateway_response, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
                ");
                
                $refundId = 'REF_' . time() . '_' . $transactionId;
                $refundType = ($refundAmount == $transaction['amount']) ? 'full' : 'partial';
                $gatewayResponse = json_encode($razorpayRefund);
                
                $stmt->bind_param("siisdssss", 
                    $refundId, $transactionId, $transaction['booking_id'], $transaction['user_id'],
                    $refundAmount, $reason, $refundType,
                    $razorpayRefund['id'], $gatewayResponse
                );
                $stmt->execute();
                
                // Update transaction
                $stmt = $dbTransaction->prepare("
                    UPDATE payment_transactions 
                    SET status = 'refunded', refund_amount = ?, refunded_at = NOW(), updated_at = NOW()
                    WHERE id = ?
                ");
                $stmt->bind_param("di", $refundAmount, $transactionId);
                $stmt->execute();
                
                // Update booking status if full refund
                if ($refundType === 'full') {
                    $stmt = $dbTransaction->prepare("
                        UPDATE bookings 
                        SET status = 'refunded', updated_at = NOW()
                        WHERE id = ?
                    ");
                    $stmt->bind_param("i", $transaction['booking_id']);
                    $stmt->execute();
                }
                
                $dbTransaction->commit();
                
                // Log refund
                $this->logger->log($transaction['user_id'], 'refund_processed', [
                    'refund_id' => $refundId,
                    'transaction_id' => $transactionId,
                    'refund_amount' => $refundAmount,
                    'refund_type' => $refundType
                ], 'medium');
                
                // Send refund confirmation email
                $this->sendRefundConfirmationEmail($transaction, $refundAmount, $reason);
                
                return [
                    'success' => true,
                    'message' => 'Refund processed successfully',
                    'data' => [
                        'refund_id' => $refundId,
                        'refund_amount' => $refundAmount,
                        'refund_type' => $refundType
                    ]
                ];
                
            } catch (Exception $e) {
                $dbTransaction->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            error_log("Process refund error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Refund processing failed'];
        }
    }
    
    public function applyCoupon($couponCode, $bookingAmount, $serviceCategory, $userId) {
        try {
            // Get coupon details
            $stmt = $this->db->prepare("
                SELECT * FROM discount_coupons 
                WHERE code = ? AND is_active = TRUE 
                AND valid_from <= NOW() AND valid_until >= NOW()
            ");
            $stmt->bind_param("s", $couponCode);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows === 0) {
                return ['success' => false, 'message' => 'Invalid or expired coupon code'];
            }
            
            $coupon = $result->fetch_assoc();
            
            // Check minimum order amount
            if ($bookingAmount < $coupon['min_order_amount']) {
                return ['success' => false, 'message' => "Minimum order amount of ₹{$coupon['min_order_amount']} required"];
            }
            
            // Check usage limits
            if ($coupon['usage_limit'] && $coupon['usage_count'] >= $coupon['usage_limit']) {
                return ['success' => false, 'message' => 'Coupon usage limit exceeded'];
            }
            
            // Check user usage limit
            $stmt = $this->db->prepare("
                SELECT COUNT(*) as user_usage FROM coupon_usage WHERE coupon_id = ? AND user_id = ?
            ");
            $stmt->bind_param("ii", $coupon['id'], $userId);
            $stmt->execute();
            $userUsage = $stmt->get_result()->fetch_assoc()['user_usage'];
            
            if ($userUsage >= $coupon['user_usage_limit']) {
                return ['success' => false, 'message' => 'You have already used this coupon'];
            }
            
            // Check applicable services/categories
            $applicableCategories = json_decode($coupon['applicable_categories'], true) ?? [];
            if (!empty($applicableCategories) && !in_array($serviceCategory, $applicableCategories)) {
                return ['success' => false, 'message' => 'Coupon not applicable for this service category'];
            }
            
            // Calculate discount
            $discountAmount = 0;
            if ($coupon['discount_type'] === 'percentage') {
                $discountAmount = ($bookingAmount * $coupon['discount_value']) / 100;
                if ($coupon['max_discount_amount'] && $discountAmount > $coupon['max_discount_amount']) {
                    $discountAmount = $coupon['max_discount_amount'];
                }
            } else {
                $discountAmount = $coupon['discount_value'];
            }
            
            // Ensure discount doesn't exceed booking amount
            $discountAmount = min($discountAmount, $bookingAmount);
            
            return [
                'success' => true,
                'data' => [
                    'coupon_id' => $coupon['id'],
                    'coupon_code' => $coupon['code'],
                    'coupon_name' => $coupon['name'],
                    'discount_amount' => $discountAmount,
                    'discount_type' => $coupon['discount_type'],
                    'discount_value' => $coupon['discount_value']
                ]
            ];
            
        } catch (Exception $e) {
            error_log("Apply coupon error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to apply coupon'];
        }
    }
    
    private function createRazorpayOrder($orderData) {
        try {
            $url = 'https://api.razorpay.com/v1/orders';
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Basic ' . base64_encode($this->razorpayKeyId . ':' . $this->razorpayKeySecret)
            ]);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200) {
                return json_decode($response, true);
            } else {
                error_log("Razorpay order creation failed: " . $response);
                return null;
            }
            
        } catch (Exception $e) {
            error_log("Razorpay order creation error: " . $e->getMessage());
            return null;
        }
    }
    
    private function getRazorpayPaymentDetails($paymentId) {
        try {
            $url = "https://api.razorpay.com/v1/payments/{$paymentId}";
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Basic ' . base64_encode($this->razorpayKeyId . ':' . $this->razorpayKeySecret)
            ]);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200) {
                return json_decode($response, true);
            } else {
                error_log("Razorpay payment fetch failed: " . $response);
                return null;
            }
            
        } catch (Exception $e) {
            error_log("Razorpay payment fetch error: " . $e->getMessage());
            return null;
        }
    }
    
    private function createRazorpayRefund($paymentId, $refundData) {
        try {
            $url = "https://api.razorpay.com/v1/payments/{$paymentId}/refund";
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($refundData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Basic ' . base64_encode($this->razorpayKeyId . ':' . $this->razorpayKeySecret)
            ]);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200) {
                return json_decode($response, true);
            } else {
                error_log("Razorpay refund creation failed: " . $response);
                return null;
            }
            
        } catch (Exception $e) {
            error_log("Razorpay refund creation error: " . $e->getMessage());
            return null;
        }
    }
    
    private function createTransactionRecord($bookingId, $userId, $razorpayOrder, $paymentMethodId) {
        try {
            $transactionId = 'TXN_' . time() . '_' . $bookingId;
            
            $stmt = $this->db->prepare("
                INSERT INTO payment_transactions (
                    transaction_id, booking_id, user_id, payment_method_id,
                    payment_method, payment_gateway, amount, currency,
                    status, razorpay_order_id, gateway_response
                ) VALUES (?, ?, ?, ?, 'card', 'razorpay', ?, ?, 'pending', ?, ?)
            ");
            
            $amount = $razorpayOrder['amount'] / 100; // Convert from paise
            $gatewayResponse = json_encode($razorpayOrder);
            
            $stmt->bind_param("siiiidss", 
                $transactionId, $bookingId, $userId, $paymentMethodId,
                $amount, $razorpayOrder['currency'], $razorpayOrder['id'], $gatewayResponse
            );
            
            $stmt->execute();
            return $this->db->getConnection()->insert_id;
            
        } catch (Exception $e) {
            error_log("Create transaction record error: " . $e->getMessage());
            return null;
        }
    }
    
    private function getBookingDetails($bookingId, $userId) {
        try {
            $stmt = $this->db->prepare("
                SELECT b.*, s.name as service_name, s.category as service_category
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                WHERE b.id = ? AND b.user_id = ?
            ");
            $stmt->bind_param("ii", $bookingId, $userId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            return $result->num_rows > 0 ? $result->fetch_assoc() : null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    private function getTransactionByRazorpayOrderId($orderId) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM payment_transactions WHERE razorpay_order_id = ?");
            $stmt->bind_param("s", $orderId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            return $result->num_rows > 0 ? $result->fetch_assoc() : null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    private function getTransactionById($transactionId) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM payment_transactions WHERE id = ?");
            $stmt->bind_param("i", $transactionId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            return $result->num_rows > 0 ? $result->fetch_assoc() : null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    private function getRefundByTransactionId($transactionId) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM refunds WHERE transaction_id = ?");
            $stmt->bind_param("i", $transactionId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            return $result->num_rows > 0 ? $result->fetch_assoc() : null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    private function generateInvoice($bookingId, $transactionId) {
        // This will be implemented in the InvoiceManager class
        return [
            'invoice_number' => 'INV_' . time() . '_' . $bookingId,
            'invoice_url' => '/invoices/download/' . $transactionId
        ];
    }
    
    private function sendPaymentConfirmationEmail($transaction) {
        // Implementation will use EmailService to send confirmation
        try {
            // Get user and booking details for email
            $stmt = $this->db->prepare("
                SELECT u.email, u.full_name, b.booking_reference, s.name as service_name
                FROM users u
                JOIN bookings b ON u.id = b.user_id
                JOIN services s ON b.service_id = s.id
                WHERE u.id = ? AND b.id = ?
            ");
            $stmt->bind_param("ii", $transaction['user_id'], $transaction['booking_id']);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $data = $result->fetch_assoc();
                // Send email using EmailService
                // Implementation details...
            }
        } catch (Exception $e) {
            error_log("Send payment confirmation email error: " . $e->getMessage());
        }
    }
    
    private function sendRefundConfirmationEmail($transaction, $refundAmount, $reason) {
        // Implementation will use EmailService to send refund confirmation
        try {
            // Similar to payment confirmation but for refunds
            // Implementation details...
        } catch (Exception $e) {
            error_log("Send refund confirmation email error: " . $e->getMessage());
        }
    }
}
