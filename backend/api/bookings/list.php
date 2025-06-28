<?php
/**
 * List User Bookings API
 * Phase 2: Database & Backend Enhancements
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';
require_once '../../classes/Auth.php';
require_once '../../classes/BookingManager.php';

// Apply rate limiting
applyRateLimit('list-bookings', 100, 3600);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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
    
    // Get query parameters
    $status = $_GET['status'] ?? null;
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(50, max(1, (int)($_GET['limit'] ?? 10)));
    
    // Get user bookings
    $bookingManager = new BookingManager();
    $result = $bookingManager->getUserBookings($userId, $status, $page, $limit);
    
    echo json_encode([
        'success' => true,
        'data' => $result
    ]);
    
} catch (Exception $e) {
    error_log("List bookings API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
