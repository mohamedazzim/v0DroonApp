-- Enhanced database schema with payment tracking

-- Update bookings table to include payment information
ALTER TABLE bookings ADD COLUMN payment_type ENUM('advance', 'full') DEFAULT 'advance';
ALTER TABLE bookings ADD COLUMN payment_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN payment_status ENUM('pending', 'paid', 'partial') DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN advance_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE bookings ADD COLUMN remaining_amount DECIMAL(10, 2) DEFAULT 0.00;

-- Create payments table for detailed payment tracking
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_type ENUM('advance', 'full', 'remaining') NOT NULL,
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- Add indexes for better performance
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_razorpay_payment_id ON payments(razorpay_payment_id);

-- Update users table to store additional info
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive', 'suspended') DEFAULT 'active';
