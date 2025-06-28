<?php
/**
 * Invoice Manager with PDF Generation
 * Phase 3: Payment System Integration
 */

require_once 'DatabaseManager.php';
require_once 'ConfigManager.php';

class InvoiceManager {
    private $db;
    private $config;
    private $invoiceDir;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
        $this->config = ConfigManager::getInstance();
        $this->invoiceDir = __DIR__ . '/../storage/invoices/';
        
        // Create invoice directory if it doesn't exist
        if (!is_dir($this->invoiceDir)) {
            mkdir($this->invoiceDir, 0755, true);
        }
    }
    
    public function generateInvoice($bookingId, $transactionId = null) {
        try {
            // Get booking and transaction details
            $invoiceData = $this->getInvoiceData($bookingId, $transactionId);
            if (!$invoiceData) {
                return ['success' => false, 'message' => 'Invoice data not found'];
            }
            
            // Generate invoice number
            $invoiceNumber = $this->generateInvoiceNumber();
            
            // Prepare line items
            $lineItems = [
                [
                    'description' => $invoiceData['service_name'],
                    'quantity' => 1,
                    'unit_price' => $invoiceData['base_price'],
                    'total' => $invoiceData['base_price']
                ]
            ];
            
            // Add additional fees if any
            if ($invoiceData['additional_fees'] > 0) {
                $lineItems[] = [
                    'description' => 'Additional Fees',
                    'quantity' => 1,
                    'unit_price' => $invoiceData['additional_fees'],
                    'total' => $invoiceData['additional_fees']
                ];
            }
            
            // Calculate tax details
            $taxDetails = [
                [
                    'name' => 'GST',
                    'rate' => 18.00,
                    'amount' => $invoiceData['tax_amount']
                ]
            ];
            
            $transaction = $this->db->beginTransaction();
            
            try {
                // Create invoice record
                $stmt = $transaction->prepare("
                    INSERT INTO invoices (
                        invoice_number, booking_id, user_id, transaction_id,
                        invoice_date, due_date, status, subtotal, tax_amount,
                        discount_amount, total_amount, currency, line_items, tax_details
                    ) VALUES (?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 
                             'draft', ?, ?, ?, ?, ?, ?, ?)
                ");
                
                $subtotal = $invoiceData['base_price'] + $invoiceData['additional_fees'] - $invoiceData['discount_amount'];
                $lineItemsJson = json_encode($lineItems);
                $taxDetailsJson = json_encode($taxDetails);
                
                $stmt->bind_param("siiiiddddsss",
                    $invoiceNumber, $bookingId, $invoiceData['user_id'], $transactionId,
                    $subtotal, $invoiceData['tax_amount'], $invoiceData['discount_amount'],
                    $invoiceData['total_amount'], $invoiceData['currency'],
                    $lineItemsJson, $taxDetailsJson
                );
                
                $stmt->execute();
                $invoiceId = $stmt->insert_id;
                
                // Generate PDF
                $pdfPath = $this->generateInvoicePDF($invoiceId, $invoiceData, $lineItems, $taxDetails);
                
                // Update invoice with PDF path
                $stmt = $transaction->prepare("
                    UPDATE invoices 
                    SET pdf_path = ?, pdf_url = ?, status = 'sent', sent_at = NOW()
                    WHERE id = ?
                ");
                
                $pdfUrl = '/api/invoices/download/' . $invoiceId;
                $stmt->bind_param("ssi", $pdfPath, $pdfUrl, $invoiceId);
                $stmt->execute();
                
                $transaction->commit();
                
                return [
                    'success' => true,
                    'data' => [
                        'invoice_id' => $invoiceId,
                        'invoice_number' => $invoiceNumber,
                        'pdf_url' => $pdfUrl,
                        'total_amount' => $invoiceData['total_amount']
                    ]
                ];
                
            } catch (Exception $e) {
                $transaction->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            error_log("Generate invoice error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Invoice generation failed'];
        }
    }
    
    public function getInvoice($invoiceId, $userId = null) {
        try {
            $query = "
                SELECT i.*, b.booking_reference, u.full_name, u.email, u.phone,
                       s.name as service_name, s.category as service_category
                FROM invoices i
                JOIN bookings b ON i.booking_id = b.id
                JOIN users u ON i.user_id = u.id
                JOIN services s ON b.service_id = s.id
                WHERE i.id = ?
            ";
            
            $params = [$invoiceId];
            $types = "i";
            
            if ($userId !== null) {
                $query .= " AND i.user_id = ?";
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
            
            $invoice = $result->fetch_assoc();
            
            // Parse JSON fields
            $invoice['line_items'] = json_decode($invoice['line_items'], true) ?? [];
            $invoice['tax_details'] = json_decode($invoice['tax_details'], true) ?? [];
            
            return $invoice;
            
        } catch (Exception $e) {
            error_log("Get invoice error: " . $e->getMessage());
            return null;
        }
    }
    
    public function downloadInvoicePDF($invoiceId, $userId = null) {
        try {
            $invoice = $this->getInvoice($invoiceId, $userId);
            if (!$invoice) {
                return null;
            }
            
            if (!file_exists($invoice['pdf_path'])) {
                // Regenerate PDF if not found
                $this->regenerateInvoicePDF($invoiceId);
                $invoice = $this->getInvoice($invoiceId, $userId);
            }
            
            return $invoice['pdf_path'];
            
        } catch (Exception $e) {
            error_log("Download invoice PDF error: " . $e->getMessage());
            return null;
        }
    }
    
    private function getInvoiceData($bookingId, $transactionId) {
        try {
            $query = "
                SELECT b.*, u.full_name, u.email, u.phone, u.id as user_id,
                       s.name as service_name, s.category as service_category
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                JOIN services s ON b.service_id = s.id
                WHERE b.id = ?
            ";
            
            $stmt = $this->db->prepare($query);
            $stmt->bind_param("i", $bookingId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            return $result->num_rows > 0 ? $result->fetch_assoc() : null;
            
        } catch (Exception $e) {
            return null;
        }
    }
    
    private function generateInvoiceNumber() {
        $prefix = 'INV';
        $year = date('Y');
        $month = date('m');
        
        // Get next sequence number for this month
        $stmt = $this->db->prepare("
            SELECT COUNT(*) + 1 as next_seq 
            FROM invoices 
            WHERE invoice_number LIKE ? 
        ");
        $pattern = $prefix . $year . $month . '%';
        $stmt->bind_param("s", $pattern);
        $stmt->execute();
        $nextSeq = $stmt->get_result()->fetch_assoc()['next_seq'];
        
        return $prefix . $year . $month . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
    }
    
    private function generateInvoicePDF($invoiceId, $invoiceData, $lineItems, $taxDetails) {
        try {
            $filename = 'invoice_' . $invoiceId . '_' . time() . '.pdf';
            $filepath = $this->invoiceDir . $filename;
            
            // Generate HTML content for PDF
            $htmlContent = $this->generateInvoiceHTML($invoiceData, $lineItems, $taxDetails);
            
            // For now, we'll create a simple text-based PDF
            // In production, you would use a library like TCPDF or DomPDF
            $this->createSimplePDF($htmlContent, $filepath);
            
            return $filepath;
            
        } catch (Exception $e) {
            error_log("Generate invoice PDF error: " . $e->getMessage());
            return null;
        }
    }
    
    private function generateInvoiceHTML($invoiceData, $lineItems, $taxDetails) {
        $companyName = $this->config->get('site_name', 'Drone Service Pro');
        $companyAddress = $this->config->get('company_address', 'Your Company Address');
        $companyPhone = $this->config->get('support_phone', '+91-9999999999');
        $companyEmail = $this->config->get('support_email', 'support@droneservicepro.com');
        
        $html = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <title>Invoice - {$invoiceData['booking_reference']}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .company-info { margin-bottom: 20px; }
                .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .customer-info { margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f5f5f5; }
                .total-section { text-align: right; margin-top: 20px; }
                .total-row { font-weight: bold; font-size: 18px; }
                .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class='header'>
                <h1>🚁 {$companyName}</h1>
                <h2>INVOICE</h2>
            </div>
            
            <div class='company-info'>
                <strong>{$companyName}</strong><br>
                {$companyAddress}<br>
                Phone: {$companyPhone}<br>
                Email: {$companyEmail}
            </div>
            
            <div class='invoice-details'>
                <div>
                    <strong>Invoice Number:</strong> {$invoiceData['invoice_number']}<br>
                    <strong>Invoice Date:</strong> " . date('d/m/Y') . "<br>
                    <strong>Due Date:</strong> " . date('d/m/Y', strtotime('+30 days')) . "
                </div>
                <div>
                    <strong>Booking Reference:</strong> {$invoiceData['booking_reference']}<br>
                    <strong>Service Date:</strong> {$invoiceData['scheduled_date']}<br>
                    <strong>Service Time:</strong> {$invoiceData['scheduled_time']}
                </div>
            </div>
            
            <div class='customer-info'>
                <h3>Bill To:</h3>
                <strong>{$invoiceData['full_name']}</strong><br>
                Email: {$invoiceData['email']}<br>
                Phone: {$invoiceData['phone']}<br>
                Location: {$invoiceData['location_name']}<br>
                {$invoiceData['location_address']}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>";
        
        foreach ($lineItems as $item) {
            $html .= "
                    <tr>
                        <td>{$item['description']}</td>
                        <td>{$item['quantity']}</td>
                        <td>₹" . number_format($item['unit_price'], 2) . "</td>
                        <td>₹" . number_format($item['total'], 2) . "</td>
                    </tr>";
        }
        
        $subtotal = $invoiceData['base_price'] + $invoiceData['additional_fees'] - $invoiceData['discount_amount'];
        
        $html .= "
                </tbody>
            </table>
            
            <div class='total-section'>
                <table style='width: 300px; margin-left: auto;'>
                    <tr>
                        <td><strong>Subtotal:</strong></td>
                        <td>₹" . number_format($subtotal, 2) . "</td>
                    </tr>";
        
        if ($invoiceData['discount_amount'] > 0) {
            $html .= "
                    <tr>
                        <td><strong>Discount:</strong></td>
                        <td>-₹" . number_format($invoiceData['discount_amount'], 2) . "</td>
                    </tr>";
        }
        
        foreach ($taxDetails as $tax) {
            $html .= "
                    <tr>
                        <td><strong>{$tax['name']} ({$tax['rate']}%):</strong></td>
                        <td>₹" . number_format($tax['amount'], 2) . "</td>
                    </tr>";
        }
        
        $html .= "
                    <tr class='total-row'>
                        <td><strong>Total Amount:</strong></td>
                        <td>₹" . number_format($invoiceData['total_amount'], 2) . "</td>
                    </tr>
                </table>
            </div>
            
            <div class='footer'>
                <p>Thank you for choosing {$companyName}!</p>
                <p>For any queries, contact us at {$companyEmail} or {$companyPhone}</p>
            </div>
        </body>
        </html>";
        
        return $html;
    }
    
    private function createSimplePDF($htmlContent, $filepath) {
        // For demonstration, we'll save as HTML
        // In production, use a proper PDF library like TCPDF or DomPDF
        file_put_contents($filepath, $htmlContent);
        return true;
    }
    
    private function regenerateInvoicePDF($invoiceId) {
        // Implementation to regenerate PDF if needed
        return true;
    }
}
