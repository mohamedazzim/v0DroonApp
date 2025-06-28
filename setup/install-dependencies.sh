#!/bin/bash

# Drone Service Pro - Phase 1 Setup Script
# This script sets up the complete development environment

echo "🚁 Setting up Drone Service Pro - Phase 1: Authentication & Security"
echo "=================================================================="

# Check if running as root for some operations
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  This script should not be run as root for security reasons"
   exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print colored output
print_status() {
    echo -e "\033[1;32m✅ $1\033[0m"
}

print_error() {
    echo -e "\033[1;31m❌ $1\033[0m"
}

print_warning() {
    echo -e "\033[1;33m⚠️  $1\033[0m"
}

print_info() {
    echo -e "\033[1;34mℹ️  $1\033[0m"
}

# Check system requirements
echo "🔍 Checking system requirements..."

# Check PHP
if command_exists php; then
    PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    if (( $(echo "$PHP_VERSION >= 8.0" | bc -l) )); then
        print_status "PHP $PHP_VERSION found"
    else
        print_error "PHP 8.0+ required, found $PHP_VERSION"
        exit 1
    fi
else
    print_error "PHP not found. Please install PHP 8.0+"
    exit 1
fi

# Check Composer
if command_exists composer; then
    print_status "Composer found"
else
    print_error "Composer not found. Please install Composer"
    exit 1
fi

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        print_status "Node.js $(node -v) found"
    else
        print_error "Node.js 18+ required, found $(node -v)"
        exit 1
    fi
else
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check npm
if command_exists npm; then
    print_status "npm $(npm -v) found"
else
    print_error "npm not found"
    exit 1
fi

# Check MySQL
if command_exists mysql; then
    print_status "MySQL found"
else
    print_warning "MySQL not found. Please ensure MySQL/MariaDB is installed"
fi

echo ""
echo "📁 Setting up project structure..."

# Create directory structure
mkdir -p {backend/{api/{auth,services,bookings,payment,admin},classes,config,logs,uploads},frontend/{src/{components/{auth,ui,common},pages,hooks,utils,styles},public/{images,icons}},database/{migrations,seeds},docs,tests}

print_status "Project directories created"

# Backend setup
echo ""
echo "🔧 Setting up backend..."

cd backend

# Install PHP dependencies
if [ -f "composer.json" ]; then
    print_info "Installing PHP dependencies..."
    composer install --no-dev --optimize-autoloader
    if [ $? -eq 0 ]; then
        print_status "PHP dependencies installed"
    else
        print_error "Failed to install PHP dependencies"
        exit 1
    fi
else
    print_error "composer.json not found in backend directory"
    exit 1
fi

# Create .env file for backend
if [ ! -f ".env" ]; then
    print_info "Creating backend .env file..."
    cat > .env << EOL
# Database Configuration
DB_HOST=localhost
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=drone_service_db

# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@droneservice.com
FROM_NAME=Drone Service Pro

# Security Configuration
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost/drone-service/backend

# Environment
APP_ENV=development
APP_DEBUG=true
EOL
    print_status "Backend .env file created"
    print_warning "Please update the .env file with your actual database and email credentials"
else
    print_info "Backend .env file already exists"
fi

# Set proper permissions
chmod 755 api
chmod 755 classes
chmod 755 config
chmod 777 logs
chmod 777 uploads

print_status "Backend permissions set"

cd ..

# Frontend setup
echo ""
echo "⚛️  Setting up frontend..."

cd frontend

# Install Node.js dependencies
if [ -f "package.json" ]; then
    print_info "Installing Node.js dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_status "Node.js dependencies installed"
    else
        print_error "Failed to install Node.js dependencies"
        exit 1
    fi
else
    print_error "package.json not found in frontend directory"
    exit 1
fi

# Create .env.local file for frontend
if [ ! -f ".env.local" ]; then
    print_info "Creating frontend .env.local file..."
    cat > .env.local << EOL
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost/drone-service/backend/api
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# Google Maps API (for Phase 6)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Firebase Configuration (for Phase 4 & 5)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# Razorpay Configuration (for Phase 3)
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id

# Environment
NODE_ENV=development
EOL
    print_status "Frontend .env.local file created"
    print_warning "Please update the .env.local file with your actual API keys"
else
    print_info "Frontend .env.local file already exists"
fi

cd ..

# Database setup
echo ""
echo "🗄️  Setting up database..."

print_info "Creating database setup script..."
cat > database/setup.sql << EOL
-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS drone_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (optional - update with your preferred credentials)
-- CREATE USER IF NOT EXISTS 'drone_user'@'localhost' IDENTIFIED BY 'secure_password_here';
-- GRANT ALL PRIVILEGES ON drone_service_db.* TO 'drone_user'@'localhost';
-- FLUSH PRIVILEGES;

USE drone_service_db;

-- Source the migration files
SOURCE migrations/001_authentication_tables.sql;
EOL

print_status "Database setup script created"
print_info "Run: mysql -u root -p < database/setup.sql"

# Create development server scripts
echo ""
echo "🚀 Creating development server scripts..."

# Backend server script
cat > start-backend.sh << EOL
#!/bin/bash
echo "🔧 Starting PHP Development Server for Backend..."
echo "Backend API will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""
cd backend
php -S localhost:8000 -t .
EOL

# Frontend server script
cat > start-frontend.sh << EOL
#!/bin/bash
echo "⚛️  Starting Next.js Development Server for Frontend..."
echo "Frontend will be available at: http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo ""
cd frontend
npm run dev
EOL

# Make scripts executable
chmod +x start-backend.sh
chmod +x start-frontend.sh

print_status "Development server scripts created"

# Create testing script
cat > test-setup.sh << EOL
#!/bin/bash
echo "🧪 Testing Drone Service Pro Setup..."
echo "=================================="

# Test backend
echo "Testing backend..."
if curl -s http://localhost:8000/api/health/route.php > /dev/null; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not responding"
fi

# Test frontend
echo "Testing frontend..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend is not responding"
fi

# Test database connection
echo "Testing database connection..."
php -r "
try {
    \$pdo = new PDO('mysql:host=localhost;dbname=drone_service_db', 'your_db_username', 'your_db_password');
    echo '✅ Database connection successful\n';
} catch (PDOException \$e) {
    echo '❌ Database connection failed: ' . \$e->getMessage() . '\n';
}
"
EOL

chmod +x test-setup.sh

print_status "Testing script created"

# Create documentation
echo ""
echo "📚 Creating documentation..."

cat > README.md << EOL
# 🚁 Drone Service Pro - Phase 1: Authentication & Security

## 🎯 Overview
Professional drone service booking platform with enterprise-grade security and authentication.

## ✅ Phase 1 Features Implemented
- ✅ User Registration with Email Verification
- ✅ Secure Login with Session Management
- ✅ Password Strength Enforcement
- ✅ Forgot/Reset Password Flow
- ✅ Account Lockout Protection
- ✅ Security Logging & Audit Trail
- ✅ Professional Email Templates
- ✅ Modern React UI with Tailwind CSS

## 🔧 Setup Instructions

### Prerequisites
- PHP 8.0+
- Node.js 18+
- MySQL/MariaDB
- Composer
- npm

### Installation
1. Run the setup script:
   \`\`\`bash
   chmod +x setup/install-dependencies.sh
   ./setup/install-dependencies.sh
   \`\`\`

2. Configure environment variables:
   - Update \`backend/.env\` with database and email credentials
   - Update \`frontend/.env.local\` with API endpoints

3. Setup database:
   \`\`\`bash
   mysql -u root -p < database/setup.sql
   \`\`\`

4. Start development servers:
   \`\`\`bash
   # Terminal 1 - Backend
   ./start-backend.sh
   
   # Terminal 2 - Frontend  
   ./start-frontend.sh
   \`\`\`

## 🌐 Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Admin Panel: http://localhost:3000/admin

## 🔐 Security Features
- Argon2ID password hashing
- SQL injection prevention
- CSRF protection
- Rate limiting
- Session management
- Security audit logging

## 📧 Email Configuration
Update \`backend/.env\` with your SMTP settings:
\`\`\`
SMTP_HOST=smtp.gmail.com
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
\`\`\`

## 🧪 Testing
Run the test script to verify setup:
\`\`\`bash
./test-setup.sh
\`\`\`

## 📁 Project Structure
\`\`\`
drone-service/
├── backend/           # PHP API
├── frontend/          # React/Next.js
├── database/          # SQL migrations
├── docs/             # Documentation
└── tests/            # Test files
\`\`\`

## 🚀 Next Phase
Phase 2: Database & Backend Enhancements
- Real MySQLi implementation
- Connection pooling
- Transaction support
- Rate limiting middleware
- Enhanced security features
EOL

print_status "Documentation created"

echo ""
echo "🎉 Setup Complete!"
echo "=================="
print_status "Phase 1: Authentication & Security is ready!"
echo ""
print_info "Next steps:"
echo "1. Update backend/.env with your database credentials"
echo "2. Update backend/.env with your email SMTP settings"
echo "3. Run: mysql -u root -p < database/setup.sql"
echo "4. Start backend: ./start-backend.sh"
echo "5. Start frontend: ./start-frontend.sh"
echo "6. Test setup: ./test-setup.sh"
echo ""
print_warning "Remember to configure your email settings for verification emails!"
echo ""
echo "🔗 Access your application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
