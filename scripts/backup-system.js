const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const archiver = require("archiver")

class BackupSystem {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || "./backups"
    this.dbConfig = {
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USERNAME || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_DATABASE || "drone_booking",
    }
    this.retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || "30")
  }

  async createFullBackup() {
    console.log("🔄 Starting full backup process...")

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupName = `full-backup-${timestamp}`
    const backupPath = path.join(this.backupDir, backupName)

    try {
      // Create backup directory
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true })
      }
      fs.mkdirSync(backupPath, { recursive: true })

      // Backup database
      await this.backupDatabase(backupPath)

      // Backup files
      await this.backupFiles(backupPath)

      // Create compressed archive
      const archivePath = await this.createArchive(backupPath, `${backupName}.tar.gz`)

      // Clean up temporary directory
      this.cleanupDirectory(backupPath)

      // Clean old backups
      await this.cleanOldBackups()

      console.log(`✅ Full backup completed: ${archivePath}`)
      return archivePath
    } catch (error) {
      console.error("❌ Backup failed:", error.message)
      throw error
    }
  }

  async backupDatabase(backupPath) {
    console.log("📊 Backing up database...")

    const sqlFile = path.join(backupPath, "database.sql")
    const command = `mysqldump -h ${this.dbConfig.host} -u ${this.dbConfig.user} -p${this.dbConfig.password} ${this.dbConfig.database} > ${sqlFile}`

    try {
      execSync(command, { stdio: "pipe" })
      console.log("✅ Database backup completed")
    } catch (error) {
      throw new Error(`Database backup failed: ${error.message}`)
    }
  }

  async backupFiles(backupPath) {
    console.log("📁 Backing up files...")

    const filesToBackup = [
      "./uploads",
      "./public/images",
      "./.env",
      "./package.json",
      "./next.config.mjs",
      "./tailwind.config.ts",
    ]

    const filesBackupPath = path.join(backupPath, "files")
    fs.mkdirSync(filesBackupPath, { recursive: true })

    for (const file of filesToBackup) {
      if (fs.existsSync(file)) {
        const fileName = path.basename(file)
        const destPath = path.join(filesBackupPath, fileName)

        if (fs.statSync(file).isDirectory()) {
          this.copyDirectory(file, destPath)
        } else {
          fs.copyFileSync(file, destPath)
        }
      }
    }

    console.log("✅ Files backup completed")
  }

  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    const files = fs.readdirSync(src)

    for (const file of files) {
      const srcPath = path.join(src, file)
      const destPath = path.join(dest, file)

      if (fs.statSync(srcPath).isDirectory()) {
        this.copyDirectory(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  async createArchive(sourcePath, archiveName) {
    console.log("🗜️ Creating compressed archive...")

    const archivePath = path.join(this.backupDir, archiveName)

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath)
      const archive = archiver("tar", { gzip: true })

      output.on("close", () => {
        console.log(`✅ Archive created: ${archive.pointer()} bytes`)
        resolve(archivePath)
      })

      archive.on("error", (err) => {
        reject(err)
      })

      archive.pipe(output)
      archive.directory(sourcePath, false)
      archive.finalize()
    })
  }

  cleanupDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
  }

  async cleanOldBackups() {
    console.log("🧹 Cleaning old backups...")

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays)

    const files = fs.readdirSync(this.backupDir)
    let deletedCount = 0

    for (const file of files) {
      const filePath = path.join(this.backupDir, file)
      const stats = fs.statSync(filePath)

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath)
        deletedCount++
        console.log(`🗑️ Deleted old backup: ${file}`)
      }
    }

    console.log(`✅ Cleaned ${deletedCount} old backups`)
  }

  async restoreFromBackup(backupPath) {
    console.log(`🔄 Starting restore from: ${backupPath}`)

    try {
      // Extract archive
      const extractPath = path.join(this.backupDir, "restore-temp")
      await this.extractArchive(backupPath, extractPath)

      // Restore database
      await this.restoreDatabase(path.join(extractPath, "database.sql"))

      // Restore files
      await this.restoreFiles(path.join(extractPath, "files"))

      // Cleanup
      this.cleanupDirectory(extractPath)

      console.log("✅ Restore completed successfully")
    } catch (error) {
      console.error("❌ Restore failed:", error.message)
      throw error
    }
  }

  async extractArchive(archivePath, extractPath) {
    console.log("📦 Extracting archive...")

    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true })
    }

    const command = `tar -xzf ${archivePath} -C ${extractPath}`
    execSync(command)

    console.log("✅ Archive extracted")
  }

  async restoreDatabase(sqlFile) {
    console.log("📊 Restoring database...")

    if (!fs.existsSync(sqlFile)) {
      throw new Error("Database backup file not found")
    }

    const command = `mysql -h ${this.dbConfig.host} -u ${this.dbConfig.user} -p${this.dbConfig.password} ${this.dbConfig.database} < ${sqlFile}`

    try {
      execSync(command, { stdio: "pipe" })
      console.log("✅ Database restored")
    } catch (error) {
      throw new Error(`Database restore failed: ${error.message}`)
    }
  }

  async restoreFiles(filesPath) {
    console.log("📁 Restoring files...")

    if (!fs.existsSync(filesPath)) {
      console.log("⚠️ No files to restore")
      return
    }

    const files = fs.readdirSync(filesPath)

    for (const file of files) {
      const srcPath = path.join(filesPath, file)
      const destPath = path.join("./", file)

      if (fs.statSync(srcPath).isDirectory()) {
        this.copyDirectory(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }

    console.log("✅ Files restored")
  }

  async scheduleBackups() {
    console.log("⏰ Setting up backup schedule...")

    // Daily backup at 2 AM
    const schedule = require("node-cron")

    schedule.schedule("0 2 * * *", async () => {
      console.log("🕐 Running scheduled backup...")
      try {
        await this.createFullBackup()
      } catch (error) {
        console.error("❌ Scheduled backup failed:", error.message)
        // Send alert notification
        await this.sendBackupAlert("Backup Failed", error.message)
      }
    })

    console.log("✅ Backup schedule configured")
  }

  async sendBackupAlert(subject, message) {
    // Send email alert or notification
    console.log(`🚨 ALERT: ${subject} - ${message}`)

    // Example: Send to monitoring service
    try {
      if (process.env.WEBHOOK_URL) {
        const response = await fetch(process.env.WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 Backup Alert: ${subject}\n${message}`,
            timestamp: new Date().toISOString(),
          }),
        })
      }
    } catch (error) {
      console.error("Failed to send backup alert:", error.message)
    }
  }

  async getBackupStatus() {
    const backups = []

    if (fs.existsSync(this.backupDir)) {
      const files = fs.readdirSync(this.backupDir)

      for (const file of files) {
        if (file.endsWith(".tar.gz")) {
          const filePath = path.join(this.backupDir, file)
          const stats = fs.statSync(filePath)

          backups.push({
            name: file,
            size: this.formatBytes(stats.size),
            created: stats.mtime,
            path: filePath,
          })
        }
      }
    }

    return {
      totalBackups: backups.length,
      latestBackup: backups.length > 0 ? backups.sort((a, b) => b.created - a.created)[0] : null,
      backups: backups.sort((a, b) => b.created - a.created),
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }
}

// CLI interface
if (require.main === module) {
  const backup = new BackupSystem()
  const command = process.argv[2]

  switch (command) {
    case "create":
      backup.createFullBackup().catch(console.error)
      break
    case "restore":
      const backupPath = process.argv[3]
      if (!backupPath) {
        console.error("Please provide backup path")
        process.exit(1)
      }
      backup.restoreFromBackup(backupPath).catch(console.error)
      break
    case "schedule":
      backup.scheduleBackups().catch(console.error)
      break
    case "status":
      backup
        .getBackupStatus()
        .then((status) => {
          console.log("📊 Backup Status:")
          console.log(`Total backups: ${status.totalBackups}`)
          if (status.latestBackup) {
            console.log(`Latest backup: ${status.latestBackup.name} (${status.latestBackup.size})`)
            console.log(`Created: ${status.latestBackup.created}`)
          }
        })
        .catch(console.error)
      break
    default:
      console.log("Usage: node backup-system.js [create|restore|schedule|status]")
      console.log("  create - Create a new backup")
      console.log("  restore <path> - Restore from backup")
      console.log("  schedule - Start backup scheduler")
      console.log("  status - Show backup status")
  }
}

module.exports = BackupSystem
