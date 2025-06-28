-- Phase 2: Database & Backend Enhancements
-- Enhanced database schema with proper indexing and relationships

-- Services table with comprehensive service management
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    category ENUM('photography', 'videography', 'inspection', 'surveillance', 'agriculture', 'mapping', 'delivery', 'emergency') NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    max_altitude_feet INT DEFAULT 400,
    max_distance_miles DECIMAL(5,2) DEFAULT 5.0,
    equipment_required JSON,
    features JSON,
    image_url VARCHAR(500),
    gallery_images JSON,
    is_active BOOLEAN DEFAULT TRUE,
    requires_license BOOLEAN DEFAULT FALSE,
    weather_dependent BOOLEAN DEFAULT TRUE,
    min_notice_hours INT DEFAULT 24,
    max_advance_days INT DEFAULT 90,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_active (is_active),
    INDEX idx_slug (slug),
    FULLTEXT idx_search (name, description, short_description)
);

-- Enhanced bookings table with comprehensive tracking
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    service_id INT NOT NULL,
    status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded') DEFAULT 'pending',
    
    -- Scheduling
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_minutes INT NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Location details
    location_name VARCHAR(255),
    location_address TEXT,
    location_coordinates POINT,
    location_type ENUM('residential', 'commercial', 'industrial', 'agricultural', 'public') DEFAULT 'residential',
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    additional_fees DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    
    -- Special requirements
    special_instructions TEXT,
    equipment_requests JSON,
    access_requirements TEXT,
    safety_considerations TEXT,
    
    -- Operator assignment
    assigned_operator_id INT NULL,
    operator_notes TEXT,
    
    -- Weather and conditions
    weather_conditions JSON,
    flight_conditions JSON,
    
    -- Completion details
    actual_start_time DATETIME NULL,
    actual_end_time DATETIME NULL,
    completion_notes TEXT,
    deliverables JSON,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
    
    INDEX idx_user_id (user_id),
    INDEX idx_service_id (service_id),
    INDEX idx_status (status),
    INDEX idx_scheduled_date (scheduled_date),
    INDEX idx_booking_reference (booking_reference),
    INDEX idx_location (location_coordinates),
    INDEX idx_operator (assigned_operator_id)
);

-- Operators table for drone pilots
CREATE TABLE IF NOT EXISTS operators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    operator_code VARCHAR(20) UNIQUE NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    license_type ENUM('recreational', 'commercial', 'advanced') NOT NULL,
    license_expiry DATE NOT NULL,
    certification_level ENUM('basic', 'intermediate', 'advanced', 'expert') DEFAULT 'basic',
    
    -- Personal details
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    
    -- Professional details
    experience_years DECIMAL(3,1) DEFAULT 0.0,
    specializations JSON,
    equipment_owned JSON,
    service_areas JSON,
    languages_spoken JSON,
    
    -- Availability
    is_active BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    working_hours JSON,
    blackout_dates JSON,
    
    -- Performance metrics
    total_flights INT DEFAULT 0,
    total_hours DECIMAL(8,2) DEFAULT 0.00,
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    
    -- Insurance and legal
    insurance_policy_number VARCHAR(100),
    insurance_expiry DATE,
    background_check_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    background_check_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_active (is_active),
    INDEX idx_available (is_available),
    INDEX idx_license_expiry (license_expiry),
    INDEX idx_certification (certification_level)
);

-- Payment transactions with comprehensive tracking
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    booking_id INT NOT NULL,
    user_id INT NOT NULL,
    
    -- Payment details
    payment_method ENUM('card', 'upi', 'netbanking', 'wallet', 'cash') NOT NULL,
    payment_gateway ENUM('razorpay', 'stripe', 'paypal', 'manual') NOT NULL,
    gateway_transaction_id VARCHAR(255),
    gateway_payment_id VARCHAR(255),
    
    -- Amounts
    amount DECIMAL(10,2) NOT NULL,
    gateway_fee DECIMAL(10,2) DEFAULT 0.00,
    net_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    
    -- Status tracking
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded') DEFAULT 'pending',
    failure_reason TEXT,
    
    -- Gateway response
    gateway_response JSON,
    webhook_data JSON,
    
    -- Refund details
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    refund_reason TEXT,
    refunded_at TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_booking_id (booking_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_gateway_transaction (gateway_transaction_id),
    INDEX idx_created_at (created_at)
);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    config_type ENUM('string', 'integer', 'decimal', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_key (config_key),
    INDEX idx_public (is_public)
);

-- API rate limiting table (enhanced)
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    requests INT DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_limit (identifier, endpoint, method),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_identifier (identifier),
    INDEX idx_endpoint (endpoint),
    INDEX idx_window_start (window_start),
    INDEX idx_user_id (user_id)
);

-- Database connection pool monitoring
CREATE TABLE IF NOT EXISTS connection_pool_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    active_connections INT NOT NULL,
    idle_connections INT NOT NULL,
    total_connections INT NOT NULL,
    max_connections INT NOT NULL,
    queries_per_second DECIMAL(8,2) DEFAULT 0.00,
    avg_query_time_ms DECIMAL(8,2) DEFAULT 0.00,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_recorded_at (recorded_at)
);

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, config_type, description, is_public) VALUES
('site_name', 'Drone Service Pro', 'string', 'Website name', TRUE),
('site_description', 'Professional drone services for all your aerial needs', 'string', 'Website description', TRUE),
('default_currency', 'INR', 'string', 'Default currency code', TRUE),
('tax_rate', '18.00', 'decimal', 'Default tax rate percentage', FALSE),
('booking_advance_days', '90', 'integer', 'Maximum days in advance for booking', TRUE),
('min_booking_notice_hours', '24', 'integer', 'Minimum notice required for booking', TRUE),
('max_flight_altitude_feet', '400', 'integer', 'Maximum allowed flight altitude', TRUE),
('emergency_contact', '+91-9999999999', 'string', 'Emergency contact number', TRUE),
('support_email', 'support@droneservicepro.com', 'string', 'Support email address', TRUE),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', FALSE),
('api_rate_limit_requests', '100', 'integer', 'API rate limit requests per window', FALSE),
('api_rate_limit_window_seconds', '3600', 'integer', 'API rate limit window in seconds', FALSE)
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- Insert sample services
INSERT INTO services (name, slug, description, short_description, category, price, duration_minutes, equipment_required, features, image_url) VALUES
('Aerial Photography - Basic', 'aerial-photography-basic', 'Professional aerial photography for real estate, events, and personal use. High-resolution images captured from optimal angles.', 'High-quality aerial photos for real estate and events', 'photography', 2999.00, 60, '["DJI Mini 3 Pro", "Extra batteries", "ND filters"]', '["4K photos", "RAW format", "10-15 edited photos", "Same day delivery"]', '/images/services/aerial-photography.jpg'),
('Aerial Videography - Professional', 'aerial-videography-professional', 'Cinematic aerial videography for commercials, documentaries, and special events. Includes professional editing and color grading.', 'Cinematic aerial videos with professional editing', 'videography', 4999.00, 90, '["DJI Air 2S", "Gimbal stabilizer", "Professional editing software"]', '["4K video", "Professional editing", "Color grading", "Music licensing"]', '/images/services/aerial-videography.jpg'),
('Property Inspection', 'property-inspection', 'Comprehensive property inspection using thermal imaging and high-resolution cameras. Perfect for roof inspections, solar panel checks, and building assessments.', 'Detailed property inspection with thermal imaging', 'inspection', 3499.00, 75, '["DJI Mavic 2 Enterprise", "Thermal camera", "Zoom camera"]', '["Thermal imaging", "Detailed report", "HD photos", "Damage assessment"]', '/images/services/property-inspection.jpg'),
('Agricultural Monitoring', 'agricultural-monitoring', 'Advanced crop monitoring using multispectral imaging and AI analysis. Get insights into crop health, irrigation needs, and yield predictions.', 'Crop health monitoring with AI analysis', 'agriculture', 5999.00, 120, '["Agricultural drone", "Multispectral camera", "GPS mapping"]', '["Crop health maps", "NDVI analysis", "Irrigation recommendations", "Yield predictions"]', '/images/services/agricultural-monitoring.jpg')
ON DUPLICATE KEY UPDATE name = VALUES(name);
