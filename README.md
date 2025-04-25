# Email Login with Supabase

A simple Next.js application featuring an email-based login/signup form with Supabase integration.

## Technologies Used

- **Next.js**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Shadcn UI**: UI component collection built on Radix UI
- **React Hook Form**: Form handling with validation
- **Zod**: TypeScript-first schema validation
- **Supabase**: Backend-as-a-Service for user management

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- A Supabase account with a project set up

### Supabase Setup

1. Create a new Supabase project
2. Create a `user` table in the `public` schema with the following columns:
   - `id` (uuid, primary key)
   - `email` (text, unique)
   - `name` (text)
   - `created_at` (timestamp with timezone, default: now())

3. Copy your Supabase URL and anon key from the project settings

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Run the development server:

```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the login form.

## Project Structure

- `src/app/page.tsx` - Main home page with login form
- `src/app/dashboard/page.tsx` - Dashboard page after successful login
- `src/components/login-form.tsx` - Login form component with email lookup
- `src/lib/supabase.ts` - Supabase client and user functions
- `src/components/ui/` - Shadcn UI components

## Features

- Email-based authentication
- Automatic user lookup by email
- New user registration
- Form validation using Zod and React Hook Form
- Dark mode support
- Modern UI with Shadcn components
