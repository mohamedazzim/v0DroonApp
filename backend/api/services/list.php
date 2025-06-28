<?php
/**
 * Services List API with Enhanced Features
 * Phase 2: Database & Backend Enhancements
 */

require_once '../../middleware/cors.php';
require_once '../../middleware/rate-limit.php';
require_once '../../classes/DatabaseManager.php';
require_once '../../classes/ConfigManager.php';

// Apply rate limiting
applyRateLimit('services-list', 50, 3600);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    $db = DatabaseManager::getInstance();
    $config = ConfigManager::getInstance();
    
    // Get query parameters
    $category = $_GET['category'] ?? '';
    $search = $_GET['search'] ?? '';
    $minPrice = $_GET['min_price'] ?? 0;
    $maxPrice = $_GET['max_price'] ?? 999999;
    $sortBy = $_GET['sort_by'] ?? 'name';
    $sortOrder = $_GET['sort_order'] ?? 'ASC';
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(50, max(1, (int)($_GET['limit'] ?? 10)));
    $offset = ($page - 1) * $limit;
    
    // Validate sort parameters
    $allowedSortFields = ['name', 'price', 'duration_minutes', 'created_at'];
    $sortBy = in_array($sortBy, $allowedSortFields) ? $sortBy : 'name';
    $sortOrder = strtoupper($sortOrder) === 'DESC' ? 'DESC' : 'ASC';
    
    // Build query
    $whereConditions = ['is_active = TRUE'];
    $params = [];
    $types = '';
    
    if (!empty($category)) {
        $whereConditions[] = 'category = ?';
        $params[] = $category;
        $types .= 's';
    }
    
    if (!empty($search)) {
        $whereConditions[] = 'MATCH(name, description, short_description) AGAINST(? IN NATURAL LANGUAGE MODE)';
        $params[] = $search;
        $types .= 's';
    }
    
    if ($minPrice > 0) {
        $whereConditions[] = 'price >= ?';
        $params[] = $minPrice;
        $types .= 'd';
    }
    
    if ($maxPrice < 999999) {
        $whereConditions[] = 'price <= ?';
        $params[] = $maxPrice;
        $types .= 'd';
    }
    
    $whereClause = implode(' AND ', $whereConditions);
    
    // Get total count for pagination
    $countQuery = "SELECT COUNT(*) as total FROM services WHERE $whereClause";
    $countStmt = $db->prepare($countQuery);
    if (!empty($params)) {
        $countStmt->bind_param($types, ...$params);
    }
    $countStmt->execute();
    $totalResult = $countStmt->get_result();
    $total = $totalResult->fetch_assoc()['total'];
    
    // Get services
    $query = "
        SELECT 
            id, name, slug, description, short_description, category, 
            price, duration_minutes, max_altitude_feet, max_distance_miles,
            equipment_required, features, image_url, gallery_images,
            requires_license, weather_dependent, min_notice_hours, max_advance_days,
            created_at, updated_at
        FROM services 
        WHERE $whereClause 
        ORDER BY $sortBy $sortOrder 
        LIMIT ? OFFSET ?
    ";
    
    $stmt = $db->prepare($query);
    $params[] = $limit;
    $params[] = $offset;
    $types .= 'ii';
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    
    $services = [];
    while ($row = $result->fetch_assoc()) {
        // Parse JSON fields
        $row['equipment_required'] = json_decode($row['equipment_required'], true) ?? [];
        $row['features'] = json_decode($row['features'], true) ?? [];
        $row['gallery_images'] = json_decode($row['gallery_images'], true) ?? [];
        
        // Format price
        $row['formatted_price'] = '₹' . number_format($row['price'], 2);
        
        // Calculate duration display
        $hours = floor($row['duration_minutes'] / 60);
        $minutes = $row['duration_minutes'] % 60;
        $row['duration_display'] = $hours > 0 ? "{$hours}h {$minutes}m" : "{$minutes}m";
        
        $services[] = $row;
    }
    
    // Calculate pagination info
    $totalPages = ceil($total / $limit);
    $hasNext = $page < $totalPages;
    $hasPrev = $page > 1;
    
    echo json_encode([
        'success' => true,
        'data' => [
            'services' => $services,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $totalPages,
                'total_items' => $total,
                'items_per_page' => $limit,
                'has_next' => $hasNext,
                'has_previous' => $hasPrev
            ],
            'filters' => [
                'category' => $category,
                'search' => $search,
                'min_price' => $minPrice,
                'max_price' => $maxPrice,
                'sort_by' => $sortBy,
                'sort_order' => $sortOrder
            ]
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Services list API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
}
?>
