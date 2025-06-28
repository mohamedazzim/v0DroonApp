-- Phase 3: Payment System Integration
-- Enhanced payment and invoice management

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    method_type ENUM('card', 'upi', 'netbanking', 'wallet') NOT NULL,
    provider VARCHAR(50) NOT NULL,
    
    -- Card details (encrypted)
    card_last_four VARCHAR(4),
    card_brand VARCHAR(20),
    card_expiry_month INT,
    card_expiry_year INT,
    
    -- UPI details
    upi_id VARCHAR(255),
    
    -- Wallet details
    wallet_provider VARCHAR(50),
    
    -- Gateway details
    gateway_customer_id VARCHAR(255),
    gateway_method_id VARCHAR(255),
    
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_method_type (method_type),
    INDEX idx_default (is_default),
    INDEX idx_active (is_active)
);

-- Enhanced payment transactions
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_method_id INT NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS invoice_url VARCHAR(500) NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500) NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255) NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255) NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(500) NULL;

ALTER TABLE payment_transactions ADD FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE payment_transactions ADD INDEX idx_invoice_number (invoice_number);
ALTER TABLE payment_transactions ADD INDEX idx_razorpay_order (razorpay_order_id);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    booking_id INT NOT NULL,
    user_id INT NOT NULL,
    transaction_id INT NULL,
    
    -- Invoice details
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
    
    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'INR',
    
    -- Invoice content
    line_items JSON NOT NULL,
    tax_details JSON,
    notes TEXT,
    terms_conditions TEXT,
    
    -- File paths
    pdf_path VARCHAR(500),
    pdf_url VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    paid_at TIMESTAMP NULL,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id) ON DELETE SET NULL,
    
    INDEX idx_booking_id (booking_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_invoice_date (invoice_date),
    INDEX idx_invoice_number (invoice_number)
);

-- Payment webhooks log
CREATE TABLE IF NOT EXISTS payment_webhooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    webhook_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payment_id VARCHAR(255),
    order_id VARCHAR(255),
    signature VARCHAR(500),
    payload JSON NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processing_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    INDEX idx_webhook_id (webhook_id),
    INDEX idx_event_type (event_type),
    INDEX idx_payment_id (payment_id),
    INDEX idx_processed (processed),
    INDEX idx_created_at (created_at)
);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    refund_id VARCHAR(255) UNIQUE NOT NULL,
    transaction_id INT NOT NULL,
    booking_id INT NOT NULL,
    user_id INT NOT NULL,
    
    -- Refund details
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_type ENUM('full', 'partial', 'cancellation_fee') NOT NULL,
    
    -- Gateway details
    gateway_refund_id VARCHAR(255),
    gateway_response JSON,
    
    -- Status
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    failure_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_booking_id (booking_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_refund_id (refund_id)
);

-- Discount coupons
CREATE TABLE IF NOT EXISTS discount_coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Discount details
    discount_type ENUM('percentage', 'fixed_amount') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    max_discount_amount DECIMAL(10,2) NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0.00,
    
    -- Usage limits
    usage_limit INT NULL,
    usage_count INT DEFAULT 0,
    user_usage_limit INT DEFAULT 1,
    
    -- Validity
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Applicable services
    applicable_services JSON,
    applicable_categories JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_code (code),
    INDEX idx_active (is_active),
    INDEX idx_valid_from (valid_from),
    INDEX idx_valid_until (valid_until)
);

-- Coupon usage tracking
CREATE TABLE IF NOT EXISTS coupon_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coupon_id INT NOT NULL,
    user_id INT NOT NULL,
    booking_id INT NOT NULL,
    transaction_id INT NULL,
    
    discount_amount DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (coupon_id) REFERENCES discount_coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_user_coupon_booking (user_id, coupon_id, booking_id),
    INDEX idx_coupon_id (coupon_id),
    INDEX idx_user_id (user_id),
    INDEX idx_booking_id (booking_id)
);

-- Insert sample discount coupons
INSERT INTO discount_coupons (code, name, description, discount_type, discount_value, max_discount_amount, min_order_amount, valid_from, valid_until, applicable_categories) VALUES
('WELCOME10', 'Welcome Discount', 'Get 10% off on your first booking', 'percentage', 10.00, 500.00, 1000.00, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), '["photography", "videography"]'),
('SAVE500', 'Flat ₹500 Off', 'Get flat ₹500 off on bookings above ₹3000', 'fixed_amount', 500.00, NULL, 3000.00, NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), '[]'),
('INSPECT20', 'Inspection Special', 'Get 20% off on property inspections', 'percentage', 20.00, 1000.00, 2000.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 MONTH), '["inspection"]')
ON DUPLICATE KEY UPDATE name = VALUES(name);
