# Meetdup - Chapter Management System

## Overview

Meetdup is a comprehensive multi-tenant SaaS application designed to streamline and manage business networking chapter operations. The system provides robust member management, meeting scheduling, attendance tracking, visitor check-ins, and LINE integration for business card sharing.

Developed by **iPassion Co., Ltd.**

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Radix UI, Shadcn/ui, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth
- **Integration**: LINE Messaging API, Google Maps API

## Development Setup

**Prerequisites**

Node.js 18+ & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Key Features

- **Multi-tenant Architecture**: Support for multiple business chapters
- **Member Management**: Comprehensive member profiles and business cards
- **Meeting System**: Scheduling, attendance tracking, and QR code check-ins
- **Visitor Pipeline**: Track prospects from first contact to membership
- **LINE Integration**: Business card search and member communication
- **Role-Based Access Control**: Super Admin, Chapter Admin, and Member roles

## Database Health Check

The system includes automated database health monitoring:

```bash
npm run db:status        # Check database connections and schema status
npm run db:check-sync    # Verify production and local schemas match
npm run db:list-migrations # List all available migrations
```

For detailed database management documentation, see `replit.md`.

## Deployment

The application is configured for deployment with proper environment variable management and health monitoring systems.
