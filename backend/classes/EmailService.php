<?php
/**
 * Email Service Class - Complete Implementation
 * Phase 1: Authentication & Security
 */

require_once 'config/security.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class EmailService {
    private $mailer;
    private $config;
    
    public function __construct() {
        $this->config = [
            'host' => $_ENV['SMTP_HOST'] ?? SecurityConfig::SMTP_HOST,
            'port' => $_ENV['SMTP_PORT'] ?? SecurityConfig::SMTP_PORT,
            'username' => $_ENV['SMTP_USERNAME'] ?? SecurityConfig::SMTP_USERNAME,
            'password' => $_ENV['SMTP_PASSWORD'] ?? SecurityConfig::SMTP_PASSWORD,
            'from_email' => $_ENV['FROM_EMAIL'] ?? SecurityConfig::FROM_EMAIL,
            'from_name' => $_ENV['FROM_NAME'] ?? SecurityConfig::FROM_NAME,
        ];
        
        $this->initializeMailer();
    }
    
    private function initializeMailer() {
        $this->mailer = new PHPMailer(true);
        
        try {
            // Server settings
            $this->mailer->isSMTP();
            $this->mailer->Host = $this->config['host'];
            $this->mailer->SMTPAuth = true;
            $this->mailer->Username = $this->config['username'];
            $this->mailer->Password = $this->config['password'];
            $this->mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $this->mailer->Port = $this->config['port'];
            
            // Default sender
            $this->mailer->setFrom($this->config['from_email'], $this->config['from_name']);
            
            // Enable HTML
            $this->mailer->isHTML(true);
            
        } catch (Exception $e) {
            error_log("Email service initialization failed: " . $e->getMessage());
        }
    }
    
    public function sendVerificationEmail($email, $fullName, $verificationToken) {
        try {
            $verificationUrl = SecurityConfig::FRONTEND_URL . "/verify-email?token=" . $verificationToken;
            
            $subject = "Verify Your Email - Drone Service Pro";
            $htmlBody = $this->getVerificationEmailTemplate($fullName, $verificationUrl);
            $textBody = $this->getVerificationEmailText($fullName, $verificationUrl);
            
            return $this->sendEmail($email, $fullName, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log("Verification email send failed: " . $e->getMessage());
            return false;
        }
    }
    
    public function sendWelcomeEmail($email, $fullName) {
        try {
            $subject = "Welcome to Drone Service Pro!";
            $htmlBody = $this->getWelcomeEmailTemplate($fullName);
            $textBody = $this->getWelcomeEmailText($fullName);
            
            return $this->sendEmail($email, $fullName, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log("Welcome email send failed: " . $e->getMessage());
            return false;
        }
    }
    
    public function sendPasswordResetEmail($email, $fullName, $resetToken) {
        try {
            $resetUrl = SecurityConfig::FRONTEND_URL . "/reset-password?token=" . $resetToken;
            
            $subject = "Reset Your Password - Drone Service Pro";
            $htmlBody = $this->getPasswordResetEmailTemplate($fullName, $resetUrl);
            $textBody = $this->getPasswordResetEmailText($fullName, $resetUrl);
            
            return $this->sendEmail($email, $fullName, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log("Password reset email send failed: " . $e->getMessage());
            return false;
        }
    }
    
    public function sendPasswordResetConfirmation($email, $fullName) {
        try {
            $subject = "Password Reset Successful - Drone Service Pro";
            $htmlBody = $this->getPasswordResetConfirmationTemplate($fullName);
            $textBody = $this->getPasswordResetConfirmationText($fullName);
            
            return $this->sendEmail($email, $fullName, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log("Password reset confirmation email send failed: " . $e->getMessage());
            return false;
        }
    }
    
    public function sendBookingConfirmation($email, $fullName, $bookingData) {
        try {
            $subject = "Booking Confirmed - " . $bookingData['booking_reference'];
            $htmlBody = $this->getBookingConfirmationTemplate($fullName, $bookingData);
            $textBody = $this->getBookingConfirmationText($fullName, $bookingData);
            
            return $this->sendEmail($email, $fullName, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log("Booking confirmation email send failed: " . $e->getMessage());
            return false;
        }
    }
    
    private function sendEmail($email, $name, $subject, $htmlBody, $textBody) {
        try {
            // Clear previous recipients
            $this->mailer->clearAddresses();
            $this->mailer->clearAttachments();
            
            // Set recipient
            $this->mailer->addAddress($email, $name);
            
            // Set content
            $this->mailer->Subject = $subject;
            $this->mailer->Body = $htmlBody;
            $this->mailer->AltBody = $textBody;
            
            // Send email
            $result = $this->mailer->send();
            
            if ($result) {
                error_log("Email sent successfully to: " . $email);
                return true;
            } else {
                error_log("Email send failed to: " . $email);
                return false;
            }
            
        } catch (Exception $e) {
            error_log("Email send error: " . $e->getMessage());
            return false;
        }
    }
    
    private function getVerificationEmailTemplate($fullName, $verificationUrl) {
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Verify Your Email</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🚁 Drone Service Pro</h1>
                    <h2>Verify Your Email Address</h2>
                </div>
                <div class='content'>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    
                    <p>Thank you for registering with Drone Service Pro! To complete your registration and start booking our professional drone services, please verify your email address.</p>
                    
                    <div style='text-align: center;'>
                        <a href='{$verificationUrl}' class='button'>Verify Email Address</a>
                    </div>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style='word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;'>{$verificationUrl}</p>
                    
                    <p><strong>This verification link will expire in 24 hours.</strong></p>
                    
                    <p>If you didn't create an account with us, please ignore this email.</p>
                    
                    <p>Best regards,<br>The Drone Service Pro Team</p>
                </div>
                <div class='footer'>
                    <p>© 2024 Drone Service Pro. All rights reserved.</p>
                    <p>Professional drone services for all your aerial needs.</p>
                </div>
            </div>
        </body>
        </html>";
    }
    
    private function getVerificationEmailText($fullName, $verificationUrl) {
        return "
        Hello {$fullName},
        
        Thank you for registering with Drone Service Pro!
        
        To complete your registration, please verify your email address by clicking the link below:
        {$verificationUrl}
        
        This verification link will expire in 24 hours.
        
        If you didn't create an account with us, please ignore this email.
        
        Best regards,
        The Drone Service Pro Team
        
        © 2024 Drone Service Pro. All rights reserved.
        ";
    }
    
    private function getWelcomeEmailTemplate($fullName) {
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Welcome to Drone Service Pro</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #667eea; }
                .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🚁 Welcome to Drone Service Pro!</h1>
                </div>
                <div class='content'>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    
                    <p>Welcome to Drone Service Pro! Your email has been verified and your account is now active. You can now access all our professional drone services.</p>
                    
                    <h3>What you can do now:</h3>
                    
                    <div class='feature'>
                        <h4>📸 Aerial Photography & Videography</h4>
                        <p>Professional aerial shots for real estate, events, and commercial projects.</p>
                    </div>
                    
                    <div class='feature'>
                        <h4>🔍 Property Inspections</h4>
                        <p>Detailed inspections with thermal imaging and high-resolution cameras.</p>
                    </div>
                    
                    <div class='feature'>
                        <h4>🌾 Agricultural Monitoring</h4>
                        <p>Advanced crop monitoring with AI analysis and health insights.</p>
                    </div>
                    
                    <div style='text-align: center;'>
                        <a href='" . SecurityConfig::FRONTEND_URL . "/services' class='button'>Browse Services</a>
                    </div>
                    
                    <p>If you have any questions, our support team is here to help at <a href='mailto:support@droneservicepro.com'>support@droneservicepro.com</a></p>
                    
                    <p>Best regards,<br>The Drone Service Pro Team</p>
                </div>
                <div class='footer'>
                    <p>© 2024 Drone Service Pro. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>";
    }
    
    private function getWelcomeEmailText($fullName) {
        return "
        Hello {$fullName},
        
        Welcome to Drone Service Pro! Your email has been verified and your account is now active.
        
        You can now access all our professional drone services:
        - Aerial Photography & Videography
        - Property Inspections
        - Agricultural Monitoring
        - And much more!
        
        Visit our services page: " . SecurityConfig::FRONTEND_URL . "/services
        
        If you have any questions, contact us at support@droneservicepro.com
        
        Best regards,
        The Drone Service Pro Team
        ";
    }
    
    private function getPasswordResetEmailTemplate($fullName, $resetUrl) {
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Reset Your Password</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🚁 Drone Service Pro</h1>
                    <h2>Reset Your Password</h2>
                </div>
                <div class='content'>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    
                    <p>We received a request to reset your password for your Drone Service Pro account.</p>
                    
                    <div style='text-align: center;'>
                        <a href='{$resetUrl}' class='button'>Reset Password</a>
                    </div>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style='word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;'>{$resetUrl}</p>
                    
                    <div class='warning'>
                        <strong>⚠️ Important:</strong>
                        <ul>
                            <li>This reset link will expire in 1 hour</li>
                            <li>If you didn't request this reset, please ignore this email</li>
                            <li>Your password will remain unchanged until you create a new one</li>
                        </ul>
                    </div>
                    
                    <p>For security reasons, if you continue to receive these emails without requesting them, please contact our support team immediately.</p>
                    
                    <p>Best regards,<br>The Drone Service Pro Team</p>
                </div>
                <div class='footer'>
                    <p>© 2024 Drone Service Pro. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>";
    }
    
    private function getPasswordResetEmailText($fullName, $resetUrl) {
        return "
        Hello {$fullName},
        
        We received a request to reset your password for your Drone Service Pro account.
        
        Click the link below to reset your password:
        {$resetUrl}
        
        This reset link will expire in 1 hour.
        
        If you didn't request this reset, please ignore this email.
        
        Best regards,
        The Drone Service Pro Team
        ";
    }
    
    private function getPasswordResetConfirmationTemplate($fullName) {
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Password Reset Successful</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #00b894 0%, #00a085 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; color: #155724; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🚁 Drone Service Pro</h1>
                    <h2>✅ Password Reset Successful</h2>
                </div>
                <div class='content'>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    
                    <div class='success'>
                        <strong>✅ Success!</strong> Your password has been successfully reset.
                    </div>
                    
                    <p>Your Drone Service Pro account password has been successfully updated. You can now log in with your new password.</p>
                    
                    <p><strong>Security Notice:</strong> For your security, all active sessions have been terminated. You'll need to log in again on all devices.</p>
                    
                    <p>If you didn't make this change, please contact our support team immediately at <a href='mailto:support@droneservicepro.com'>support@droneservicepro.com</a></p>
                    
                    <p>Best regards,<br>The Drone Service Pro Team</p>
                </div>
                <div class='footer'>
                    <p>© 2024 Drone Service Pro. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>";
    }
    
    private function getPasswordResetConfirmationText($fullName) {
        return "
        Hello {$fullName},
        
        Your Drone Service Pro account password has been successfully reset.
        
        For your security, all active sessions have been terminated. You'll need to log in again on all devices.
        
        If you didn't make this change, please contact support@droneservicepro.com immediately.
        
        Best regards,
        The Drone Service Pro Team
        ";
    }
    
    private function getBookingConfirmationTemplate($fullName, $bookingData) {
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Booking Confirmed</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #00b894 0%, #00a085 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .booking-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
                .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🚁 Booking Confirmed!</h1>
                    <h2>Reference: {$bookingData['booking_reference']}</h2>
                </div>
                <div class='content'>
                    <p>Hello <strong>{$fullName}</strong>,</p>
                    
                    <p>Great news! Your drone service booking has been confirmed. Here are your booking details:</p>
                    
                    <div class='booking-details'>
                        <h3>Booking Details</h3>
                        <div class='detail-row'>
                            <strong>Service:</strong>
                            <span>{$bookingData['service_name']}</span>
                        </div>
                        <div class='detail-row'>
                            <strong>Date & Time:</strong>
                            <span>{$bookingData['scheduled_date']} at {$bookingData['scheduled_time']}</span>
                        </div>
                        <div class='detail-row'>
                            <strong>Location:</strong>
                            <span>{$bookingData['location_name']}</span>
                        </div>
                        <div class='detail-row'>
                            <strong>Duration:</strong>
                            <span>{$bookingData['duration_display']}</span>
                        </div>
                        <div class='detail-row'>
                            <strong>Total Amount:</strong>
                            <span><strong>₹{$bookingData['total_amount']}</strong></span>
                        </div>
                    </div>
                    
                    <p><strong>What's Next?</strong></p>
                    <ul>
                        <li>Our team will contact you 24 hours before your scheduled service</li>
                        <li>Please ensure the location is accessible and safe for drone operations</li>
                        <li>Weather conditions will be monitored and you'll be notified of any changes</li>
                    </ul>
                    
                    <p>You can view and manage your booking in your account dashboard.</p>
                    
                    <p>If you have any questions, contact us at <a href='mailto:support@droneservicepro.com'>support@droneservicepro.com</a></p>
                    
                    <p>Best regards,<br>The Drone Service Pro Team</p>
                </div>
                <div class='footer'>
                    <p>© 2024 Drone Service Pro. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>";
    }
    
    private function getBookingConfirmationText($fullName, $bookingData) {
        return "
        Hello {$fullName},
        
        Your drone service booking has been confirmed!
        
        Booking Reference: {$bookingData['booking_reference']}
        Service: {$bookingData['service_name']}
        Date & Time: {$bookingData['scheduled_date']} at {$bookingData['scheduled_time']}
        Location: {$bookingData['location_name']}
        Total Amount: ₹{$bookingData['total_amount']}
        
        Our team will contact you 24 hours before your scheduled service.
        
        Best regards,
        The Drone Service Pro Team
        ";
    }
}
