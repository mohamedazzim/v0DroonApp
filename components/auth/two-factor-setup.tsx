"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { QRCodeSVG } from "qrcode.react"
import { Shield, Smartphone, Key, Check } from "lucide-react"

export function TwoFactorSetup() {
  const [step, setStep] = useState<"setup" | "verify" | "complete">("setup")
  const [qrCode, setQrCode] = useState("")
  const [secret, setSecret] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const generateQRCode = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("session_token")

      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (data.success) {
        setQrCode(data.qr_code)
        setSecret(data.secret)
        setStep("verify")
      }
    } catch (error) {
      console.error("Failed to generate 2FA setup:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const verifySetup = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("session_token")

      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: verificationCode,
          secret: secret,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setBackupCodes(data.backup_codes)
        setStep("complete")
      }
    } catch (error) {
      console.error("Failed to verify 2FA:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Two-Factor Authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "setup" && (
          <>
            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                Add an extra layer of security to your account by enabling two-factor authentication.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Smartphone className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">Authenticator App</p>
                  <p className="text-xs text-muted-foreground">Use Google Authenticator, Authy, or similar apps</p>
                </div>
              </div>
            </div>

            <Button onClick={generateQRCode} disabled={isLoading} className="w-full">
              {isLoading ? "Setting up..." : "Setup 2FA"}
            </Button>
          </>
        )}

        {step === "verify" && (
          <>
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app:</p>

              {qrCode && (
                <div className="flex justify-center">
                  <QRCodeSVG value={qrCode} size={200} />
                </div>
              )}

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
                <code className="text-sm font-mono break-all">{secret}</code>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Enter verification code:</label>
              <Input
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>

            <Button onClick={verifySetup} disabled={isLoading || verificationCode.length !== 6} className="w-full">
              {isLoading ? "Verifying..." : "Verify & Enable"}
            </Button>
          </>
        )}

        {step === "complete" && (
          <>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>

              <div>
                <h3 className="font-semibold text-green-600">2FA Enabled Successfully!</h3>
                <p className="text-sm text-muted-foreground">
                  Your account is now protected with two-factor authentication.
                </p>
              </div>
            </div>

            <Alert>
              <Key className="w-4 h-4" />
              <AlertDescription>
                <strong>Important:</strong> Save these backup codes in a safe place. You can use them to access your
                account if you lose your authenticator device.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-medium">Backup Codes:</p>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <Badge key={index} variant="secondary" className="font-mono text-xs">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={() => window.location.reload()}>
              Continue to Dashboard
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
