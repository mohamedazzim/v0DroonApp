<?php
/**
 * Booking Manager - Complete Implementation
 * Phase 2: Database & Backend Enhancements
 */

require_once 'DatabaseManager.php';
require_once 'SecurityLogger.php';
require_once 'EmailService.php';

class BookingManager {
    private $db;
    private $logger;
    private $emailService;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
        $this->logger = new SecurityLogger();
        $this->emailService = new EmailService();
    }
    
    public function createBooking($userId, $serviceId, $bookingData) {
        try {
            // Validate service exists
            $service = $this->db->fetchOne("SELECT * FROM services WHERE id = ? AND is_active = TRUE", [$serviceId]);
            if (!$service) {
                return ['success' => false, 'message' => 'Service not found or not available'];
            }
            
            // Validate required fields
            $requiredFields = ['scheduled_date', 'scheduled_time', 'location_name', 'location_address'];
            foreach ($requiredFields as $field) {
                if (empty($bookingData[$field])) {
                    return ['success' => false, 'message' => "Field {$field} is required"];
                }
            }
            
            // Validate date and time
            $scheduledDateTime = $bookingData['scheduled_date'] . ' ' . $bookingData['scheduled_time'];
            if (strtotime($scheduledDateTime) <= time()) {
                return ['success' => false, 'message' => 'Booking date and time must be in the future'];
            }
            
            // Check availability
            if (!$this->checkAvailability($serviceId, $scheduledDateTime, $bookingData['duration'] ?? 60)) {
                return ['success' => false, 'message' => 'Selected time slot is not available'];
            }
            
            // Calculate pricing
            $pricing = $this->calculatePricing($service, $bookingData);
            
            // Generate booking reference
            $bookingReference = $this->generateBookingReference();
            
            $this->db->beginTransaction();
            
            try {
                // Create booking
                $bookingId = $this->db->insert('bookings', [
                    'booking_reference' => $bookingReference,
                    'user_id' => $userId,
                    'service_id' => $serviceId,
                    'status' => 'pending',
                    'scheduled_date' => $bookingData['scheduled_date'],
                    'scheduled_time' => $bookingData['scheduled_time'],
                    'duration' => $bookingData['duration'] ?? 60,
                    'location_name' => $bookingData['location_name'],
                    'location_address' => $bookingData['location_address'],
                    'location_coordinates' => $bookingData['location_coordinates'] ?? null,
                    'special_requirements' => $bookingData['special_requirements'] ?? '',
                    'base_price' => $pricing['base_price'],
                    'additional_fees' => $pricing['additional_fees'],
                    'discount_amount' => $pricing['discount_amount'],
                    'tax_amount' => $pricing['tax_amount'],
                    'total_amount' => $pricing['total_amount'],
                    'currency' => 'INR',
                    'booking_details' => json_encode($bookingData)
                ]);
                
                $this->db->commit();
                
                // Log booking creation
                $this->logger->log($userId, 'booking_created', [
                    'booking_id' => $bookingId,
                    'booking_reference' => $bookingReference,
                    'service_id' => $serviceId,
                    'total_amount' => $pricing['total_amount']
                ], 'low');
                
                // Send booking confirmation email
                $this->sendBookingConfirmationEmail($bookingId);
                
                return [
                    'success' => true,
                    'message' => 'Booking created successfully',
                    'data' => [
                        'booking_id' => $bookingId,
                        'booking_reference' => $bookingReference,
                        'total_amount' => $pricing['total_amount'],
                        'pricing_breakdown' => $pricing
                    ]
                ];
                
            } catch (Exception $e) {
                $this->db->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            error_log("Create booking error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Booking creation failed'];
        }
    }
    
    public function getBooking($bookingId, $userId = null) {
        try {
            $query = "
                SELECT b.*, s.name as service_name, s.category as service_category,
                       u.full_name as customer_name, u.email as customer_email
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                JOIN users u ON b.user_id = u.id
                WHERE b.id = ?
            ";
            
            $params = [$bookingId];
            $types = "i";
            
            if ($userId !== null) {
                $query .= " AND b.user_id = ?";
                $params[] = $userId;
                $types .= "i";
            }
            
            $stmt = $this->db->prepare($query);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows === 0) {
                return null;
            }
            
            $booking = $result->fetch_assoc();
            
            // Parse JSON fields
            $booking['equipment_requests'] = json_decode($booking['equipment_requests'], true) ?? [];
            $booking['weather_conditions'] = json_decode($booking['weather_conditions'], true) ?? [];
            $booking['flight_conditions'] = json_decode($booking['flight_conditions'], true) ?? [];
            $booking['deliverables'] = json_decode($booking['deliverables'], true) ?? [];
            
            // Format location coordinates
            if ($booking['location_coordinates']) {
                $coords = $this->parsePoint($booking['location_coordinates']);
                $booking['latitude'] = $coords['lat'];
                $booking['longitude'] = $coords['lng'];
            }
            
            return $booking;
            
        } catch (Exception $e) {
            error_log("Get booking error: " . $e->getMessage());
            return null;
        }
    }
    
    public function getUserBookings($userId, $status = null, $page = 1, $limit = 10) {
        try {
            $offset = ($page - 1) * $limit;
            
            $whereClause = "b.user_id = ?";
            $params = [$userId];
            
            if ($status) {
                $whereClause .= " AND b.status = ?";
                $params[] = $status;
            }
            
            // Get total count
            $totalQuery = "SELECT COUNT(*) as total FROM bookings b WHERE {$whereClause}";
            $total = $this->db->fetchOne($totalQuery, $params)['total'];
            
            // Get bookings
            $query = "
                SELECT b.*, s.name as service_name, s.category as service_category,
                       s.description as service_description
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                WHERE {$whereClause}
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?
            ";
            
            $params[] = $limit;
            $params[] = $offset;
            
            $bookings = $this->db->fetchAll($query, $params);
            
            // Parse JSON fields
            foreach ($bookings as &$booking) {
                $booking['booking_details'] = json_decode($booking['booking_details'], true) ?? [];
            }
            
            return [
                'bookings' => $bookings,
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $limit,
                    'total' => $total,
                    'total_pages' => ceil($total / $limit)
                ]
            ];
            
        } catch (Exception $e) {
            error_log("Get user bookings error: " . $e->getMessage());
            return ['bookings' => [], 'pagination' => []];
        }
    }
    
    public function getBookingDetails($bookingId, $userId = null) {
        try {
            $query = "
                SELECT b.*, s.name as service_name, s.category as service_category,
                       s.description as service_description, s.features,
                       u.full_name, u.email, u.phone
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                JOIN users u ON b.user_id = u.id
                WHERE b.id = ?
            ";
            
            $params = [$bookingId];
            
            if ($userId !== null) {
                $query .= " AND b.user_id = ?";
                $params[] = $userId;
            }
            
            $booking = $this->db->fetchOne($query, $params);
            
            if (!$booking) {
                return null;
            }
            
            // Parse JSON fields
            $booking['booking_details'] = json_decode($booking['booking_details'], true) ?? [];
            $booking['service_features'] = json_decode($booking['features'], true) ?? [];
            
            // Get payment transactions
            $booking['transactions'] = $this->db->fetchAll("
                SELECT * FROM payment_transactions 
                WHERE booking_id = ? 
                ORDER BY created_at DESC
            ", [$bookingId]);
            
            return $booking;
            
        } catch (Exception $e) {
            error_log("Get booking details error: " . $e->getMessage());
            return null;
        }
    }
    
    public function updateBookingStatus($bookingId, $status, $userId = null) {
        try {
            $validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'];
            if (!in_array($status, $validStatuses)) {
                return ['success' => false, 'message' => 'Invalid status'];
            }
            
            $whereClause = "id = ?";
            $params = [$bookingId];
            
            if ($userId !== null) {
                $whereClause .= " AND user_id = ?";
                $params[] = $userId;
            }
            
            $updateData = [
                'status' => $status,
                'updated_at' => date('Y-m-d H:i:s')
            ];
            
            // Add status-specific timestamps
            switch ($status) {
                case 'confirmed':
                    $updateData['confirmed_at'] = date('Y-m-d H:i:s');
                    break;
                case 'completed':
                    $updateData['completed_at'] = date('Y-m-d H:i:s');
                    break;
                case 'cancelled':
                    $updateData['cancelled_at'] = date('Y-m-d H:i:s');
                    break;
            }
            
            $affected = $this->db->update('bookings', $updateData, $whereClause, array_slice($params, 1));
            
            if ($affected > 0) {
                // Log status change
                $booking = $this->getBookingDetails($bookingId);
                $this->logger->log($booking['user_id'], 'booking_status_changed', [
                    'booking_id' => $bookingId,
                    'old_status' => $booking['status'],
                    'new_status' => $status
                ], 'low');
                
                return ['success' => true, 'message' => 'Booking status updated'];
            } else {
                return ['success' => false, 'message' => 'Booking not found or no changes made'];
            }
            
        } catch (Exception $e) {
            error_log("Update booking status error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Status update failed'];
        }
    }
    
    public function cancelBooking($bookingId, $userId, $reason = '') {
        try {
            $booking = $this->getBookingDetails($bookingId, $userId);
            if (!$booking) {
                return ['success' => false, 'message' => 'Booking not found'];
            }
            
            if (!in_array($booking['status'], ['pending', 'confirmed'])) {
                return ['success' => false, 'message' => 'Booking cannot be cancelled in current status'];
            }
            
            // Check cancellation policy
            $scheduledDateTime = strtotime($booking['scheduled_date'] . ' ' . $booking['scheduled_time']);
            $hoursUntilBooking = ($scheduledDateTime - time()) / 3600;
            
            $cancellationFee = 0;
            if ($hoursUntilBooking < 24) {
                $cancellationFee = $booking['total_amount'] * 0.25; // 25% cancellation fee
            }
            
            $this->db->beginTransaction();
            
            try {
                // Update booking status
                $this->db->update('bookings', [
                    'status' => 'cancelled',
                    'cancelled_at' => date('Y-m-d H:i:s'),
                    'cancellation_reason' => $reason,
                    'cancellation_fee' => $cancellationFee
                ], 'id = ?', [$bookingId]);
                
                $this->db->commit();
                
                // Log cancellation
                $this->logger->log($userId, 'booking_cancelled', [
                    'booking_id' => $bookingId,
                    'reason' => $reason,
                    'cancellation_fee' => $cancellationFee,
                    'hours_until_booking' => $hoursUntilBooking
                ], 'medium');
                
                return [
                    'success' => true,
                    'message' => 'Booking cancelled successfully',
                    'data' => [
                        'cancellation_fee' => $cancellationFee,
                        'refund_amount' => $booking['total_amount'] - $cancellationFee
                    ]
                ];
                
            } catch (Exception $e) {
                $this->db->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            error_log("Cancel booking error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Booking cancellation failed'];
        }
    }
    
    private function checkAvailability($serviceId, $scheduledDateTime, $duration) {
        try {
            $startTime = date('Y-m-d H:i:s', strtotime($scheduledDateTime));
            $endTime = date('Y-m-d H:i:s', strtotime($scheduledDateTime) + ($duration * 60));
            
            $conflictingBookings = $this->db->fetchOne("
                SELECT COUNT(*) as count
                FROM bookings
                WHERE service_id = ?
                AND status IN ('confirmed', 'in_progress')
                AND (
                    (scheduled_date = DATE(?) AND scheduled_time < TIME(?) AND 
                     ADDTIME(scheduled_time, SEC_TO_TIME(duration * 60)) > TIME(?))
                    OR
                    (scheduled_date = DATE(?) AND scheduled_time < TIME(?) AND 
                     scheduled_time >= TIME(?))
                )
            ", [
                $serviceId,
                $startTime, $endTime, $startTime,
                $startTime, $endTime, $startTime
            ])['count'];
            
            return $conflictingBookings == 0;
            
        } catch (Exception $e) {
            error_log("Check availability error: " . $e->getMessage());
            return false;
        }
    }
    
    private function calculatePricing($service, $bookingData) {
        $basePrice = $service['base_price'];
        $additionalFees = 0;
        $discountAmount = 0;
        
        // Calculate duration-based pricing
        $duration = $bookingData['duration'] ?? 60;
        if ($duration > 60) {
            $extraHours = ceil(($duration - 60) / 60);
            $additionalFees += $extraHours * ($basePrice * 0.5); // 50% of base price per extra hour
        }
        
        // Add location-based fees
        if (!empty($bookingData['location_coordinates'])) {
            // Calculate distance-based fees (simplified)
            $additionalFees += 200; // Base travel fee
        }
        
        // Add special requirements fees
        if (!empty($bookingData['special_requirements'])) {
            $additionalFees += 500; // Special requirements fee
        }
        
        // Apply coupon discount if provided
        if (!empty($bookingData['coupon_code'])) {
            // This would integrate with PaymentManager's applyCoupon method
            // For now, simplified calculation
            $discountAmount = min($basePrice * 0.1, 1000); // Max 10% or ₹1000
        }
        
        $subtotal = $basePrice + $additionalFees - $discountAmount;
        $taxAmount = $subtotal * 0.18; // 18% GST
        $totalAmount = $subtotal + $taxAmount;
        
        return [
            'base_price' => $basePrice,
            'additional_fees' => $additionalFees,
            'discount_amount' => $discountAmount,
            'subtotal' => $subtotal,
            'tax_amount' => $taxAmount,
            'total_amount' => $totalAmount,
            'currency' => 'INR'
        ];
    }
    
    private function generateBookingReference() {
        $prefix = 'BK';
        $timestamp = time();
        $random = str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
        return $prefix . $timestamp . $random;
    }
    
    private function sendBookingConfirmationEmail($bookingId) {
        try {
            $booking = $this->getBookingDetails($bookingId);
            if ($booking) {
                $this->emailService->sendBookingConfirmation(
                    $booking['email'],
                    $booking['full_name'],
                    $booking
                );
            }
        } catch (Exception $e) {
            error_log("Send booking confirmation email error: " . $e->getMessage());
        }
    }
    
    private function parsePoint($pointData) {
        // Parse MySQL POINT data
        if (preg_match('/POINT$$([0-9.-]+) ([0-9.-]+)$$/', $pointData, $matches)) {
            return ['lng' => (float)$matches[1], 'lat' => (float)$matches[2]];
        }
        return ['lng' => 0, 'lat' => 0];
    }
}
