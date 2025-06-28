<?php
/**
 * Configuration Manager - Complete Implementation
 * Phase 2: Database & Backend Enhancements
 */

require_once 'DatabaseManager.php';

class ConfigManager {
    private static $instance = null;
    private $db;
    private $cache = [];
    private $cacheExpiry = 3600; // 1 hour
    
    private function __construct() {
        $this->db = DatabaseManager::getInstance();
        $this->createConfigTable();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function createConfigTable() {
        $sql = "
        CREATE TABLE IF NOT EXISTS app_config (
            id INT AUTO_INCREMENT PRIMARY KEY,
            config_key VARCHAR(255) UNIQUE NOT NULL,
            config_value TEXT,
            config_type ENUM('string', 'integer', 'float', 'boolean', 'json') DEFAULT 'string',
            description TEXT,
            is_public BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            INDEX idx_config_key (config_key),
            INDEX idx_is_public (is_public)
        )";
        
        try {
            $this->db->query($sql);
            $this->seedDefaultConfig();
        } catch (Exception $e) {
            error_log("Config table creation failed: " . $e->getMessage());
        }
    }
    
    private function seedDefaultConfig() {
        $defaultConfigs = [
            [
                'key' => 'site_name',
                'value' => 'Drone Service Pro',
                'type' => 'string',
                'description' => 'Website name',
                'is_public' => true
            ],
            [
                'key' => 'site_description',
                'value' => 'Professional drone services for all your aerial needs',
                'type' => 'string',
                'description' => 'Website description',
                'is_public' => true
            ],
            [
                'key' => 'support_email',
                'value' => 'support@droneservicepro.com',
                'type' => 'string',
                'description' => 'Support email address',
                'is_public' => true
            ],
            [
                'key' => 'support_phone',
                'value' => '+91-9999999999',
                'type' => 'string',
                'description' => 'Support phone number',
                'is_public' => true
            ],
            [
                'key' => 'company_address',
                'value' => '123 Business District, Tech City, India',
                'type' => 'string',
                'description' => 'Company address',
                'is_public' => true
            ],
            [
                'key' => 'max_booking_advance_days',
                'value' => '90',
                'type' => 'integer',
                'description' => 'Maximum days in advance for booking',
                'is_public' => false
            ],
            [
                'key' => 'cancellation_fee_percentage',
                'value' => '25',
                'type' => 'float',
                'description' => 'Cancellation fee percentage for last-minute cancellations',
                'is_public' => false
            ],
            [
                'key' => 'tax_rate',
                'value' => '18',
                'type' => 'float',
                'description' => 'Tax rate percentage (GST)',
                'is_public' => false
            ],
            [
                'key' => 'payment_gateway_enabled',
                'value' => 'true',
                'type' => 'boolean',
                'description' => 'Enable payment gateway',
                'is_public' => false
            ],
            [
                'key' => 'email_notifications_enabled',
                'value' => 'true',
                'type' => 'boolean',
                'description' => 'Enable email notifications',
                'is_public' => false
            ],
            [
                'key' => 'maintenance_mode',
                'value' => 'false',
                'type' => 'boolean',
                'description' => 'Enable maintenance mode',
                'is_public' => true
            ],
            [
                'key' => 'social_links',
                'value' => '{"facebook":"","twitter":"","instagram":"","linkedin":""}',
                'type' => 'json',
                'description' => 'Social media links',
                'is_public' => true
            ],
            [
                'key' => 'business_hours',
                'value' => '{"monday":"09:00-18:00","tuesday":"09:00-18:00","wednesday":"09:00-18:00","thursday":"09:00-18:00","friday":"09:00-18:00","saturday":"10:00-16:00","sunday":"closed"}',
                'type' => 'json',
                'description' => 'Business operating hours',
                'is_public' => true
            ]
        ];
        
        foreach ($defaultConfigs as $config) {
            try {
                $existing = $this->db->fetchOne("SELECT id FROM app_config WHERE config_key = ?", [$config['key']]);
                if (!$existing) {
                    $this->db->insert('app_config', [
                        'config_key' => $config['key'],
                        'config_value' => $config['value'],
                        'config_type' => $config['type'],
                        'description' => $config['description'],
                        'is_public' => $config['is_public']
                    ]);
                }
            } catch (Exception $e) {
                error_log("Failed to seed config {$config['key']}: " . $e->getMessage());
            }
        }
    }
    
    public function get($key, $default = null) {
        try {
            // Check cache first
            if (isset($this->cache[$key]) && $this->cache[$key]['expires'] > time()) {
                return $this->cache[$key]['value'];
            }
            
            $config = $this->db->fetchOne("
                SELECT config_value, config_type 
                FROM app_config 
                WHERE config_key = ?
            ", [$key]);
            
            if (!$config) {
                return $default;
            }
            
            $value = $this->parseConfigValue($config['config_value'], $config['config_type']);
            
            // Cache the value
            $this->cache[$key] = [
                'value' => $value,
                'expires' => time() + $this->cacheExpiry
            ];
            
            return $value;
            
        } catch (Exception $e) {
            error_log("Get config error: " . $e->getMessage());
            return $default;
        }
    }
    
    public function set($key, $value, $type = 'string', $description = '', $isPublic = false) {
        try {
            $configValue = $this->formatConfigValue($value, $type);
            
            $existing = $this->db->fetchOne("SELECT id FROM app_config WHERE config_key = ?", [$key]);
            
            if ($existing) {
                $this->db->update('app_config', [
                    'config_value' => $configValue,
                    'config_type' => $type,
                    'description' => $description,
                    'is_public' => $isPublic
                ], 'config_key = ?', [$key]);
            } else {
                $this->db->insert('app_config', [
                    'config_key' => $key,
                    'config_value' => $configValue,
                    'config_type' => $type,
                    'description' => $description,
                    'is_public' => $isPublic
                ]);
            }
            
            // Clear cache
            unset($this->cache[$key]);
            
            return true;
            
        } catch (Exception $e) {
            error_log("Set config error: " . $e->getMessage());
            return false;
        }
    }
    
    public function getPublicConfig() {
        try {
            $configs = $this->db->fetchAll("
                SELECT config_key, config_value, config_type 
                FROM app_config 
                WHERE is_public = TRUE
            ");
            
            $result = [];
            foreach ($configs as $config) {
                $result[$config['config_key']] = $this->parseConfigValue(
                    $config['config_value'], 
                    $config['config_type']
                );
            }
            
            return $result;
            
        } catch (Exception $e) {
            error_log("Get public config error: " . $e->getMessage());
            return [];
        }
    }
    
    public function getAllConfig() {
        try {
            $configs = $this->db->fetchAll("
                SELECT config_key, config_value, config_type, description, is_public, updated_at
                FROM app_config 
                ORDER BY config_key
            ");
            
            $result = [];
            foreach ($configs as $config) {
                $result[$config['config_key']] = [
                    'value' => $this->parseConfigValue($config['config_value'], $config['config_type']),
                    'type' => $config['config_type'],
                    'description' => $config['description'],
                    'is_public' => (bool)$config['is_public'],
                    'updated_at' => $config['updated_at']
                ];
            }
            
            return $result;
            
        } catch (Exception $e) {
            error_log("Get all config error: " . $e->getMessage());
            return [];
        }
    }
    
    public function delete($key) {
        try {
            $affected = $this->db->delete('app_config', 'config_key = ?', [$key]);
            
            if ($affected > 0) {
                unset($this->cache[$key]);
                return true;
            }
            
            return false;
            
        } catch (Exception $e) {
            error_log("Delete config error: " . $e->getMessage());
            return false;
        }
    }
    
    public function clearCache() {
        $this->cache = [];
    }
    
    private function parseConfigValue($value, $type) {
        switch ($type) {
            case 'integer':
                return (int)$value;
            case 'float':
                return (float)$value;
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN);
            case 'json':
                return json_decode($value, true) ?? [];
            case 'string':
            default:
                return $value;
        }
    }
    
    private function formatConfigValue($value, $type) {
        switch ($type) {
            case 'json':
                return json_encode($value);
            case 'boolean':
                return $value ? 'true' : 'false';
            default:
                return (string)$value;
        }
    }
}
