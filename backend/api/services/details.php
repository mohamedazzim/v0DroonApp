<?php
/**
 * Service Details API
 * Phase 2: Database & Backend Enhancements
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';
require_once '../../classes/DatabaseManager.php';

// Apply rate limiting
applyRateLimit('service-details', 100, 3600);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    $serviceId = $_GET['id'] ?? '';
    $slug = $_GET['slug'] ?? '';
    
    if (empty($serviceId) && empty($slug)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Service ID or slug is required']);
        exit();
    }
    
    $db = DatabaseManager::getInstance();
    
    // Build query based on provided parameter
    if (!empty($serviceId)) {
        $query = "SELECT * FROM services WHERE id = ? AND is_active = TRUE";
        $param = $serviceId;
    } else {
        $query = "SELECT * FROM services WHERE slug = ? AND is_active = TRUE";
        $param = $slug;
    }
    
    $stmt = $db->prepare($query);
    $stmt->bind_param("s", $param);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Service not found']);
        exit();
    }
    
    $service = $result->fetch_assoc();
    
    // Parse JSON fields
    $service['equipment_required'] = json_decode($service['equipment_required'], true) ?? [];
    $service['features'] = json_decode($service['features'], true) ?? [];
    $service['gallery_images'] = json_decode($service['gallery_images'], true) ?? [];
    
    // Format price
    $service['formatted_price'] = '₹' . number_format($service['price'], 2);
    
    // Calculate duration display
    $hours = floor($service['duration_minutes'] / 60);
    $minutes = $service['duration_minutes'] % 60;
    $service['duration_display'] = $hours > 0 ? "{$hours}h {$minutes}m" : "{$minutes}m";
    
    // Add booking availability info
    $service['booking_info'] = [
        'min_notice_hours' => $service['min_notice_hours'],
        'max_advance_days' => $service['max_advance_days'],
        'earliest_booking' => date('Y-m-d H:i:s', time() + ($service['min_notice_hours'] * 3600)),
        'latest_booking' => date('Y-m-d H:i:s', time() + ($service['max_advance_days'] * 86400))
    ];
    
    echo json_encode([
        'success' => true,
        'data' => $service
    ]);
    
} catch (Exception $e) {
    error_log("Service details API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
