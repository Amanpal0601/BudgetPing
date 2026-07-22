#  BudgetPing - AI-Powered Financial Tracker

BudgetPing is a modern, full-stack budgeting application designed to help users track their expenses, manage accounts, and gain financial insights with the power of AI.

##  Features

- **AI Receipt Scanning**: Automatically extract transaction details from receipt images using Google Gemini AI.
- **Multi-Account Management**: Create and manage multiple bank accounts with real-time balance tracking.
- **Budget Planning**: Set and monitor budgets for different categories.
- **Recurring Transactions**: Automate periodic income and expenses with scheduled tasks.
- **Smart Dashboard**: Visualize your spending habits with interactive charts and insights.
- **Secure Authentication**: Robust user management and protection powered by Clerk.
- **Enterprise-Grade Protection**: Rate limiting and bot protection using Arcjet.
- **Automated Notifications**: Receive email alerts for budget limits and transaction summaries.

##  Tech Stack

### Frontend & Core
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: JavaScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)

### Backend & Database
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Background Jobs**: [Inngest](https://www.inngest.com/)
- **Security**: [Arcjet](https://arcjet.com/)
- **Email**: [Resend](https://resend.com/) & [React Email](https://react.email/)

### AI Integration
- **AI Model**: [Google Gemini AI](https://deepmind.google/technologies/gemini/)

##  Getting Started

### Prerequisites
- Node.js installed
- A Supabase / PostgreSQL database
- API Keys for Clerk, Gemini, Arcjet, and Resend

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Amanpal0601/BudgetPing.git
   cd BudgetPing
   ```

2. Install dependencies:
   ```bash
   cd my-app
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the `my-app` directory and add your credentials (follow `.env.example`).

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📄 License
This project is for personal use and development purposes.
