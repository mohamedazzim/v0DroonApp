<?php
/**
 * Analytics API - Booking Analytics
 * Phase 5: Advanced Analytics & Reporting
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';
require_once '../../classes/Auth.php';
require_once '../../classes/DatabaseManager.php';

// Apply rate limiting
applyRateLimit('analytics', 50, 3600); // 50 requests per hour

// Handle preflight
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
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input');
    }
    
    // Get authorization header
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authorization required']);
        exit();
    }
    
    $token = $matches[1];
    
    // Validate session
    $auth = new Auth();
    $session = $auth->validateSession($token);
    
    if (!$session['valid']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid session']);
        exit();
    }
    
    // Check if user has admin access
    if ($session['user']['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Admin access required']);
        exit();
    }
    
    $startDate = $input['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
    $endDate = $input['end_date'] ?? date('Y-m-d');
    $metric = $input['metric'] ?? 'revenue';
    
    $db = DatabaseManager::getInstance();
    
    // Get booking statistics
    $bookingStats = $db->fetchOne("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as revenue
        FROM bookings 
        WHERE DATE(created_at) BETWEEN ? AND ?
    ", [$startDate, $endDate]);
    
    // Calculate growth (compare with previous period)
    $periodDays = (strtotime($endDate) - strtotime($startDate)) / 86400;
    $prevStartDate = date('Y-m-d', strtotime($startDate) - ($periodDays * 86400));
    $prevEndDate = date('Y-m-d', strtotime($endDate) - ($periodDays * 86400));
    
    $prevStats = $db->fetchOne("
        SELECT SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as prev_revenue
        FROM bookings 
        WHERE DATE(created_at) BETWEEN ? AND ?
    ", [$prevStartDate, $prevEndDate]);
    
    $growth = 0;
    if ($prevStats['prev_revenue'] > 0) {
        $growth = (($bookingStats['revenue'] - $prevStats['prev_revenue']) / $prevStats['prev_revenue']) * 100;
    }
    
    $bookingStats['growth'] = round($growth, 2);
    
    // Get service performance
    $services = $db->fetchAll("
        SELECT 
            s.name,
            COUNT(b.id) as bookings,
            SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as revenue,
            AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating ELSE 0 END) as rating
        FROM services s
        LEFT JOIN bookings b ON s.id = b.service_id 
            AND DATE(b.created_at) BETWEEN ? AND ?
        LEFT JOIN reviews r ON b.id = r.booking_id
        WHERE s.is_active = TRUE
        GROUP BY s.id, s.name
        ORDER BY revenue DESC
    ", [$startDate, $endDate]);
    
    // Get location distribution
    $locations = $db->fetchAll("
        SELECT 
            SUBSTRING_INDEX(location_address, ',', -1) as city,
            COUNT(*) as bookings,
            SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as revenue
        FROM bookings 
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY city
        ORDER BY bookings DESC
        LIMIT 10
    ", [$startDate, $endDate]);
    
    // Get timeline data
    $timeline = $db->fetchAll("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as bookings,
            SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as revenue
        FROM bookings 
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ", [$startDate, $endDate]);
    
    // Get customer statistics
    $customerStats = $db->fetchOne("
        SELECT 
            COUNT(DISTINCT user_id) as total,
            COUNT(DISTINCT CASE WHEN DATE(created_at) BETWEEN ? AND ? THEN user_id END) as new_customers
        FROM bookings
    ", [$startDate, $endDate]);
    
    $returningCustomers = $db->fetchOne("
        SELECT COUNT(DISTINCT user_id) as returning
        FROM bookings 
        WHERE user_id IN (
            SELECT user_id 
            FROM bookings 
            WHERE DATE(created_at) < ?
        ) AND DATE(created_at) BETWEEN ? AND ?
    ", [$startDate, $startDate, $endDate]);
    
    $customers = [
        'total' => (int)$customerStats['total'],
        'new' => (int)$customerStats['new_customers'],
        'returning' => (int)$returningCustomers['returning']
    ];
    
    $response = [
        'success' => true,
        'data' => [
            'bookings' => $bookingStats,
            'services' => $services,
            'locations' => $locations,
            'timeline' => $timeline,
            'customers' => $customers
        ]
    ];
    
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("Analytics API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Analytics data fetch failed'
    ]);
}
?>
