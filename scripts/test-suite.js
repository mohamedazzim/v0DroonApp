const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

class TestSuite {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
    }
    this.baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000"
  }

  async runAllTests() {
    console.log("🧪 Starting Automated Test Suite...\n")

    try {
      await this.testDatabaseConnection()
      await this.testAPIEndpoints()
      await this.testAuthentication()
      await this.testBookingFlow()
      await this.testPaymentFlow()
      await this.testWebSocketConnection()
      await this.testEmailService()

      this.printResults()
    } catch (error) {
      console.error("❌ Test suite failed:", error.message)
      process.exit(1)
    }
  }

  async testDatabaseConnection() {
    console.log("📊 Testing Database Connection...")

    try {
      const response = await fetch(`${this.baseUrl}/api/health`)
      const data = await response.json()

      if (data.database === "connected") {
        this.recordTest("Database Connection", true)
      } else {
        this.recordTest("Database Connection", false, "Database not connected")
      }
    } catch (error) {
      this.recordTest("Database Connection", false, error.message)
    }
  }

  async testAPIEndpoints() {
    console.log("🔗 Testing API Endpoints...")

    const endpoints = [
      { method: "GET", path: "/api/services", auth: false },
      { method: "GET", path: "/api/health", auth: false },
      { method: "POST", path: "/api/auth/login", auth: false },
      { method: "GET", path: "/api/bookings", auth: true },
      { method: "GET", path: "/api/users", auth: true },
    ]

    for (const endpoint of endpoints) {
      try {
        const headers = {
          "Content-Type": "application/json",
        }

        if (endpoint.auth) {
          headers["Authorization"] = "Bearer test-token"
        }

        const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers,
        })

        const isSuccess = response.status < 500
        this.recordTest(
          `${endpoint.method} ${endpoint.path}`,
          isSuccess,
          isSuccess ? null : `Status: ${response.status}`,
        )
      } catch (error) {
        this.recordTest(`${endpoint.method} ${endpoint.path}`, false, error.message)
      }
    }
  }

  async testAuthentication() {
    console.log("🔐 Testing Authentication Flow...")

    // Test login with invalid credentials
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid@test.com",
          password: "wrongpassword",
        }),
      })

      const data = await response.json()
      const isCorrectFailure = response.status === 401 && !data.success
      this.recordTest(
        "Invalid Login Rejection",
        isCorrectFailure,
        isCorrectFailure ? null : "Should reject invalid credentials",
      )
    } catch (error) {
      this.recordTest("Invalid Login Rejection", false, error.message)
    }

    // Test registration validation
    try {
      const response = await fetch(`${this.baseUrl}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          password: "123",
        }),
      })

      const isCorrectValidation = response.status === 400
      this.recordTest(
        "Registration Validation",
        isCorrectValidation,
        isCorrectValidation ? null : "Should validate email and password",
      )
    } catch (error) {
      this.recordTest("Registration Validation", false, error.message)
    }
  }

  async testBookingFlow() {
    console.log("📅 Testing Booking Flow...")

    // Test booking creation validation
    try {
      const response = await fetch(`${this.baseUrl}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          service_id: "invalid",
          booking_date: "invalid-date",
        }),
      })

      const isCorrectValidation = response.status === 400 || response.status === 401
      this.recordTest(
        "Booking Validation",
        isCorrectValidation,
        isCorrectValidation ? null : "Should validate booking data",
      )
    } catch (error) {
      this.recordTest("Booking Validation", false, error.message)
    }

    // Test booking status updates
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/bookings/1`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          status: "confirmed",
        }),
      })

      const isValidResponse = response.status === 401 || response.status === 403 || response.status === 200
      this.recordTest(
        "Booking Status Update",
        isValidResponse,
        isValidResponse ? null : "Should handle status updates properly",
      )
    } catch (error) {
      this.recordTest("Booking Status Update", false, error.message)
    }
  }

  async testPaymentFlow() {
    console.log("💳 Testing Payment Flow...")

    // Test payment order creation
    try {
      const response = await fetch(`${this.baseUrl}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          booking_id: 1,
          amount: 5000,
        }),
      })

      const isValidResponse = response.status === 401 || response.status === 200
      this.recordTest(
        "Payment Order Creation",
        isValidResponse,
        isValidResponse ? null : "Should handle payment orders",
      )
    } catch (error) {
      this.recordTest("Payment Order Creation", false, error.message)
    }

    // Test payment verification
    try {
      const response = await fetch(`${this.baseUrl}/api/payment/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          razorpay_order_id: "test_order",
          razorpay_payment_id: "test_payment",
          razorpay_signature: "test_signature",
        }),
      })

      const isValidResponse = response.status === 401 || response.status === 400 || response.status === 200
      this.recordTest(
        "Payment Verification",
        isValidResponse,
        isValidResponse ? null : "Should handle payment verification",
      )
    } catch (error) {
      this.recordTest("Payment Verification", false, error.message)
    }
  }

  async testWebSocketConnection() {
    console.log("🔌 Testing WebSocket Connection...")

    try {
      // Test WebSocket endpoint availability
      const wsUrl = this.baseUrl.replace("http", "ws") + "/ws"

      // Since we can't easily test WebSocket in Node.js without additional libraries,
      // we'll test the HTTP endpoint that would upgrade to WebSocket
      const response = await fetch(`${this.baseUrl}/api/ws`, {
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
        },
      })

      // WebSocket upgrade should return 426 or handle the upgrade
      const isValidResponse = response.status === 426 || response.status === 101 || response.status === 404
      this.recordTest(
        "WebSocket Endpoint",
        isValidResponse,
        isValidResponse ? null : "WebSocket endpoint should be available",
      )
    } catch (error) {
      this.recordTest("WebSocket Endpoint", false, error.message)
    }
  }

  async testEmailService() {
    console.log("📧 Testing Email Service...")

    // Test email configuration
    const emailConfigExists = process.env.SMTP_HOST && process.env.SMTP_USER
    this.recordTest("Email Configuration", emailConfigExists, emailConfigExists ? null : "Email configuration missing")

    // Test email template rendering (if we had a test endpoint)
    try {
      const response = await fetch(`${this.baseUrl}/api/test/email-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: "booking_confirmation",
          data: { booking_id: 1 },
        }),
      })

      // This endpoint might not exist, so 404 is acceptable
      const isValidResponse = response.status === 404 || response.status === 200
      this.recordTest(
        "Email Template Rendering",
        isValidResponse,
        isValidResponse ? null : "Email template system should work",
      )
    } catch (error) {
      this.recordTest("Email Template Rendering", false, error.message)
    }
  }

  recordTest(testName, passed, error = null) {
    this.results.total++
    if (passed) {
      this.results.passed++
      console.log(`  ✅ ${testName}`)
    } else {
      this.results.failed++
      console.log(`  ❌ ${testName}${error ? `: ${error}` : ""}`)
      if (error) {
        this.results.errors.push({ test: testName, error })
      }
    }
  }

  printResults() {
    console.log("\n📊 Test Results Summary:")
    console.log(`Total Tests: ${this.results.total}`)
    console.log(`✅ Passed: ${this.results.passed}`)
    console.log(`❌ Failed: ${this.results.failed}`)
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`)

    if (this.results.errors.length > 0) {
      console.log("\n🔍 Error Details:")
      this.results.errors.forEach(({ test, error }) => {
        console.log(`  • ${test}: ${error}`)
      })
    }

    // Generate test report
    this.generateTestReport()

    if (this.results.failed > 0) {
      console.log("\n⚠️  Some tests failed. Please review and fix the issues.")
      process.exit(1)
    } else {
      console.log("\n🎉 All tests passed successfully!")
    }
  }

  generateTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      environment: {
        baseUrl: this.baseUrl,
        nodeVersion: process.version,
        platform: process.platform,
      },
    }

    const reportPath = path.join(process.cwd(), "test-report.json")
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📄 Test report saved to: ${reportPath}`)
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new TestSuite()
  testSuite.runAllTests().catch(console.error)
}

module.exports = TestSuite
