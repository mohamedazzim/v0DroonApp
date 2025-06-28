-- Create database and tables for drone booking app

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_per_hour DECIMAL(10, 2) NOT NULL,
    icon VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    service_id INT NOT NULL,
    location VARCHAR(500) NOT NULL,
    booking_date DATE NOT NULL,
    time_slot TIME NOT NULL,
    duration_hours INT NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
    custom_needs TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Insert default services
INSERT INTO services (name, description, price_per_hour, icon) VALUES
('Drone for Videography', 'Professional aerial videography for events, real estate, and commercial projects', 150.00, 'video'),
('Drone for Photoshoot', 'High-quality aerial photography for weddings, portraits, and landscapes', 120.00, 'camera'),
('Drone for Agriculture', 'Crop monitoring, field mapping, and precision agriculture services', 200.00, 'wheat'),
('Drone for Surveillance', 'Security monitoring and surveillance for properties and events', 180.00, 'shield'),
('Drone for Inspection', 'Infrastructure inspection for buildings, towers, and industrial facilities', 220.00, 'search'),
('Drone for Custom Needs', 'Customized drone services tailored to your specific requirements', 175.00, 'settings');
