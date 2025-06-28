<?php
/**
 * Create Booking API
 * Phase 2: Database & Backend Enhancements
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';
require_once '../../classes/Auth.php';
require_once '../../classes/BookingManager.php';

// Apply rate limiting
applyRateLimit('create-booking', 20, 3600);

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
    
    // Get booking data
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    $serviceId = $input['service_id'] ?? '';
    $bookingData = $input['booking_data'] ?? [];
    
    if (empty($serviceId) || empty($bookingData)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Service ID and booking data are required']);
        exit();
    }
    
    // Create booking
    $bookingManager = new BookingManager();
    $result = $bookingManager->createBooking($userId, $serviceId, $bookingData);
    
    http_response_code($result['success'] ? 201 : 400);
    echo json_encode($result);
    
} catch (Exception $e) {
    error_log("Create booking API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
