<?php
/**
 * Authentication Class - Complete Implementation
 * Phase 1: Authentication & Security
 */

require_once 'DatabaseManager.php';
require_once 'SecurityLogger.php';
require_once 'EmailService.php';
require_once 'config/security.php';

class Auth {
    private $db;
    private $logger;
    private $emailService;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
        $this->logger = new SecurityLogger();
        $this->emailService = new EmailService();
    }
    
    public function register($email, $password, $fullName, $phone) {
        try {
            // Validate input
            if (!$this->validateEmail($email)) {
                return ['success' => false, 'message' => 'Invalid email format'];
            }
            
            if (!$this->validatePassword($password)) {
                return ['success' => false, 'message' => 'Password must be at least 8 characters with uppercase, lowercase, number and special character'];
            }
            
            if (strlen($fullName) < 2) {
                return ['success' => false, 'message' => 'Full name must be at least 2 characters'];
            }
            
            if (!$this->validatePhone($phone)) {
                return ['success' => false, 'message' => 'Invalid phone number format'];
            }
            
            // Check if user already exists
            $existingUser = $this->db->fetchOne("SELECT id FROM users WHERE email = ?", [$email]);
            if ($existingUser) {
                return ['success' => false, 'message' => 'Email already registered'];
            }
            
            // Hash password
            $hashedPassword = password_hash($password, PASSWORD_ARGON2ID, [
                'memory_cost' => 65536,
                'time_cost' => 4,
                'threads' => 3
            ]);
            
            // Generate verification token
            $verificationToken = bin2hex(random_bytes(32));
            $verificationExpiry = date('Y-m-d H:i:s', time() + 86400); // 24 hours
            
            $this->db->beginTransaction();
            
            try {
                // Insert user
                $userId = $this->db->insert('users', [
                    'email' => $email,
                    'password_hash' => $hashedPassword,
                    'full_name' => $fullName,
                    'phone' => $phone,
                    'email_verification_token' => $verificationToken,
                    'email_verification_expires' => $verificationExpiry,
                    'status' => 'pending_verification',
                    'role' => 'customer'
                ]);
                
                $this->db->commit();
                
                // Send verification email
                $emailSent = $this->emailService->sendVerificationEmail($email, $fullName, $verificationToken);
                
                // Log registration
                $this->logger->log($userId, 'user_registered', [
                    'email' => $email,
                    'verification_email_sent' => $emailSent
                ], 'low');
                
                return [
                    'success' => true,
                    'message' => 'Registration successful. Please check your email for verification.',
                    'data' => [
                        'user_id' => $userId,
                        'email_sent' => $emailSent
                    ]
                ];
                
            } catch (Exception $e) {
                $this->db->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            error_log("Registration error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Registration failed'];
        }
    }
    
    public function login($email, $password, $rememberMe = false) {
        try {
            // Rate limiting check
            if (!$this->checkLoginRateLimit($email)) {
                return ['success' => false, 'message' => 'Too many login attempts. Please try again later.'];
            }
            
            // Get user
            $user = $this->db->fetchOne("
                SELECT id, email, password_hash, full_name, phone, status, role, 
                       failed_login_attempts, last_failed_login, locked_until
                FROM users WHERE email = ?
            ", [$email]);
            
            if (!$user) {
                $this->logger->logLoginAttempt($email, false, 'user_not_found');
                return ['success' => false, 'message' => 'Invalid email or password'];
            }
            
            // Check if account is locked
            if ($user['locked_until'] && strtotime($user['locked_until']) > time()) {
                $this->logger->logLoginAttempt($email, false, 'account_locked');
                return ['success' => false, 'message' => 'Account is temporarily locked. Please try again later.'];
            }
            
            // Verify password
            if (!password_verify($password, $user['password_hash'])) {
                $this->handleFailedLogin($user['id'], $email);
                return ['success' => false, 'message' => 'Invalid email or password'];
            }
            
            // Check account status
            if ($user['status'] !== 'active') {
                $this->logger->logLoginAttempt($email, false, 'account_not_active');
                return ['success' => false, 'message' => 'Account not activated. Please verify your email.'];
            }
            
            // Reset failed login attempts
            $this->db->update('users', [
                'failed_login_attempts' => 0,
                'last_failed_login' => null,
                'locked_until' => null,
                'last_login' => date('Y-m-d H:i:s')
            ], 'id = ?', [$user['id']]);
            
            // Create session
            $sessionToken = $this->createSession($user['id'], $rememberMe);
            
            // Log successful login
            $this->logger->log($user['id'], 'user_login', [
                'email' => $email,
                'remember_me' => $rememberMe
            ], 'low');
            
            return [
                'success' => true,
                'message' => 'Login successful',
                'data' => [
                    'session_token' => $sessionToken,
                    'user' => [
                        'id' => $user['id'],
                        'email' => $user['email'],
                        'full_name' => $user['full_name'],
                        'phone' => $user['phone'],
                        'role' => $user['role']
                    ]
                ]
            ];
            
        } catch (Exception $e) {
            error_log("Login error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Login failed'];
        }
    }
    
    public function verifyEmail($token) {
        try {
            $user = $this->db->fetchOne("
                SELECT id, email, full_name, email_verification_expires 
                FROM users 
                WHERE email_verification_token = ? AND status = 'pending_verification'
            ", [$token]);
            
            if (!$user) {
                return ['success' => false, 'message' => 'Invalid verification token'];
            }
            
            if (strtotime($user['email_verification_expires']) < time()) {
                return ['success' => false, 'message' => 'Verification token has expired'];
            }
            
            // Update user status
            $this->db->update('users', [
                'status' => 'active',
                'email_verified_at' => date('Y-m-d H:i:s'),
                'email_verification_token' => null,
                'email_verification_expires' => null
            ], 'id = ?', [$user['id']]);
            
            // Send welcome email
            $this->emailService->sendWelcomeEmail($user['email'], $user['full_name']);
            
            // Log verification
            $this->logger->log($user['id'], 'email_verified', [
                'email' => $user['email']
            ], 'low');
            
            return [
                'success' => true,
                'message' => 'Email verified successfully'
            ];
            
        } catch (Exception $e) {
            error_log("Email verification error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Email verification failed'];
        }
    }
    
    public function forgotPassword($email) {
        try {
            $user = $this->db->fetchOne("
                SELECT id, email, full_name, status 
                FROM users WHERE email = ?
            ", [$email]);
            
            if (!$user) {
                // Don't reveal if email exists
                return ['success' => true, 'message' => 'If the email exists, a reset link has been sent'];
            }
            
            if ($user['status'] !== 'active') {
                return ['success' => false, 'message' => 'Account not activated'];
            }
            
            // Generate reset token
            $resetToken = bin2hex(random_bytes(32));
            $resetExpiry = date('Y-m-d H:i:s', time() + 3600); // 1 hour
            
            // Update user with reset token
            $this->db->update('users', [
                'password_reset_token' => $resetToken,
                'password_reset_expires' => $resetExpiry
            ], 'id = ?', [$user['id']]);
            
            // Send reset email
            $emailSent = $this->emailService->sendPasswordResetEmail($user['email'], $user['full_name'], $resetToken);
            
            // Log password reset request
            $this->logger->log($user['id'], 'password_reset_requested', [
                'email' => $email,
                'email_sent' => $emailSent
            ], 'medium');
            
            return [
                'success' => true,
                'message' => 'If the email exists, a reset link has been sent'
            ];
            
        } catch (Exception $e) {
            error_log("Forgot password error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Password reset request failed'];
        }
    }
    
    public function resetPassword($token, $newPassword) {
        try {
            if (!$this->validatePassword($newPassword)) {
                return ['success' => false, 'message' => 'Password must be at least 8 characters with uppercase, lowercase, number and special character'];
            }
            
            $user = $this->db->fetchOne("
                SELECT id, email, full_name, password_reset_expires 
                FROM users 
                WHERE password_reset_token = ?
            ", [$token]);
            
            if (!$user) {
                return ['success' => false, 'message' => 'Invalid reset token'];
            }
            
            if (strtotime($user['password_reset_expires']) < time()) {
                return ['success' => false, 'message' => 'Reset token has expired'];
            }
            
            // Hash new password
            $hashedPassword = password_hash($newPassword, PASSWORD_ARGON2ID, [
                'memory_cost' => 65536,
                'time_cost' => 4,
                'threads' => 3
            ]);
            
            $this->db->beginTransaction();
            
            try {
                // Update password
                $this->db->update('users', [
                    'password_hash' => $hashedPassword,
                    'password_reset_token' => null,
                    'password_reset_expires' => null,
                    'password_changed_at' => date('Y-m-d H:i:s')
                ], 'id = ?', [$user['id']]);
                
                // Invalidate all sessions
                $this->db->update('user_sessions', [
                    'status' => 'expired'
                ], 'user_id = ?', [$user['id']]);
                
                $this->db->commit();
                
                // Send confirmation email
                $this->emailService->sendPasswordResetConfirmation($user['email'], $user['full_name']);
                
                // Log password reset
                $this->logger->log($user['id'], 'password_reset_completed', [
                    'email' => $user['email']
                ], 'medium');
                
                return [
                    'success' => true,
                    'message' => 'Password reset successfully'
                ];
                
            } catch (Exception $e) {
                $this->db->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            error_log("Reset password error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Password reset failed'];
        }
    }
    
    public function validateSession($sessionToken) {
        try {
            $session = $this->db->fetchOne("
                SELECT s.*, u.id as user_id, u.email, u.full_name, u.phone, u.role, u.status
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_token = ? AND s.status = 'active' AND s.expires_at > NOW()
            ", [$sessionToken]);
            
            if (!$session) {
                return ['valid' => false, 'message' => 'Invalid or expired session'];
            }
            
            if ($session['status'] !== 'active') {
                return ['valid' => false, 'message' => 'User account not active'];
            }
            
            // Update last activity
            $this->db->update('user_sessions', [
                'last_activity' => date('Y-m-d H:i:s')
            ], 'id = ?', [$session['id']]);
            
            return [
                'valid' => true,
                'user' => [
                    'id' => $session['user_id'],
                    'email' => $session['email'],
                    'full_name' => $session['full_name'],
                    'phone' => $session['phone'],
                    'role' => $session['role']
                ]
            ];
            
        } catch (Exception $e) {
            error_log("Session validation error: " . $e->getMessage());
            return ['valid' => false, 'message' => 'Session validation failed'];
        }
    }
    
    public function logout($sessionToken) {
        try {
            $session = $this->db->fetchOne("
                SELECT id, user_id FROM user_sessions WHERE session_token = ?
            ", [$sessionToken]);
            
            if ($session) {
                $this->db->update('user_sessions', [
                    'status' => 'logged_out',
                    'logged_out_at' => date('Y-m-d H:i:s')
                ], 'id = ?', [$session['id']]);
                
                $this->logger->log($session['user_id'], 'user_logout', [], 'low');
            }
            
            return ['success' => true, 'message' => 'Logged out successfully'];
            
        } catch (Exception $e) {
            error_log("Logout error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Logout failed'];
        }
    }
    
    private function createSession($userId, $rememberMe = false) {
        $sessionToken = bin2hex(random_bytes(32));
        $expiryHours = $rememberMe ? 720 : 24; // 30 days or 24 hours
        $expiresAt = date('Y-m-d H:i:s', time() + ($expiryHours * 3600));
        
        $this->db->insert('user_sessions', [
            'user_id' => $userId,
            'session_token' => $sessionToken,
            'expires_at' => $expiresAt,
            'ip_address' => $this->getClientIP(),
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'status' => 'active'
        ]);
        
        return $sessionToken;
    }
    
    private function handleFailedLogin($userId, $email) {
        $failedAttempts = $this->db->fetchOne("
            SELECT failed_login_attempts FROM users WHERE id = ?
        ", [$userId])['failed_login_attempts'] ?? 0;
        
        $failedAttempts++;
        $updateData = [
            'failed_login_attempts' => $failedAttempts,
            'last_failed_login' => date('Y-m-d H:i:s')
        ];
        
        // Lock account after 5 failed attempts
        if ($failedAttempts >= 5) {
            $updateData['locked_until'] = date('Y-m-d H:i:s', time() + 1800); // 30 minutes
        }
        
        $this->db->update('users', $updateData, 'id = ?', [$userId]);
        
        $this->logger->logLoginAttempt($email, false, 'invalid_password');
    }
    
    private function checkLoginRateLimit($email) {
        // Simple rate limiting - max 10 attempts per hour per IP
        $ip = $this->getClientIP();
        $attempts = $this->db->fetchOne("
            SELECT COUNT(*) as count 
            FROM security_logs 
            WHERE event_type = 'login_attempt' 
            AND ip_address = ? 
            AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ", [$ip])['count'] ?? 0;
        
        return $attempts < 10;
    }
    
    private function validateEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    private function validatePassword($password) {
        return strlen($password) >= 8 &&
               preg_match('/[A-Z]/', $password) &&
               preg_match('/[a-z]/', $password) &&
               preg_match('/[0-9]/', $password) &&
               preg_match('/[^A-Za-z0-9]/', $password);
    }
    
    private function validatePhone($phone) {
        return preg_match('/^[+]?[0-9]{10,15}$/', $phone);
    }
    
    private function getClientIP() {
        $ipKeys = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'];
        
        foreach ($ipKeys as $key) {
            if (!empty($_SERVER[$key])) {
                $ips = explode(',', $_SERVER[$key]);
                $ip = trim($ips[0]);
                
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
}
