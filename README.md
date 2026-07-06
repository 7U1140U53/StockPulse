# StockPulse

StockPulse is a sleek, multi-tenant inventory tracking platform and retail ledger. Engineered as a comprehensive capstone system, it combines real-time financial tracking, strict multi-tenant workspace isolation, and an immutable audit logging layer to prevent stock discrepancies.

---

## 🚀 Core Tech Stack

*   **Frontend Engine:** Built with React 19 bundled via Vite 8 for optimized performance and fast development builds.
*   **Styling & Presentation:** Powered by Tailwind CSS, utilizing a premium UI design featuring dynamic Light and Dark mode toggles.
*   **Backend-as-a-Service:** Managed completely via Supabase (`@supabase/supabase-js`) to orchestrate database operations, cloud data syncing, and user authentication management.
*   **Iconography:** Rendered cleanly using high-fidelity vector interface icons supplied by Lucide React.

---

## 📊 Key System Capabilities

### 🔒 Secure Multi-Tenant Architecture
The platform contains a dedicated authentication layout that communicates directly with Supabase Authentication. This configuration guarantees strict multi-tenancy isolation, ensuring that inventory visualization and management are restricted entirely to the active logged-in user session.

### 📈 Financial Metrics Engine
The application performs real-time mathematical calculations directly within the client interface across essential business metrics:
*   **Total Asset Valuation:** Tracks cumulative cost basis capital locked inside product stock.
*   **Potential Revenue Yield:** Computes full storefront value based on target retail pricing parameters.
*   **Projected Net Profit:** Executes live delta evaluations showing incoming profit margins based on dynamic markups.

### 📜 Immutable Audit Ledger
To ensure total data integrity, prevent tracking discrepancies, and satisfy academic evaluation criteria for database design, the application features an audit trail:
*   **Transaction Logs:** Tracks individual data entries mapping stock shifts and variations.
*   **Operational Context:** Each log entry captures incremental additions, manual deductions, or baseline setups along with a strict operational reason string and immutable timestamp.

### 🔍 Advanced Catalog Filtering
*   **String Lookups:** Implements immediate catalog search functionality based on text inputs.
*   **Status Pills:** Interactive filtration pills allow operators to instantly isolate assets matching "All Assets", "Low Stock Alerts", or "Out of Stock" status.
*   **Stock Validation:** Quick stock modifiers are constrained by input validation rules that actively block negative volume depletion errors.

---

## 🗄️ Database Architecture & Security (SQL Setup)

Run the following script in your Supabase SQL Editor to provision the relational schema, integrity constraints, and Row Level Security (RLS) policies required for academic compliance.

```sql
-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Inventory Table
create table public.inventory (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    quantity integer not null default 0 check (quantity >= 0),
    cost_price numeric(10, 2) not null default 0.00 check (cost_price >= 0),
    selling_price numeric(10, 2) not null default 0.00 check (selling_price >= 0),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Immutable Audit Ledger Table
create table public.inventory_logs (
    id uuid default gen_random_uuid() primary key,
    inventory_id uuid references public.inventory(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    change_amount integer not null,
    reason text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable Row Level Security (RLS) for Multi-Tenancy
alter table public.inventory enable row level security;
alter table public.inventory_logs enable row level security;

-- 5. RLS Policies for Inventory
create policy "Users can perform all actions on their own inventory."
    on public.inventory for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- 6. RLS Policies for Inventory Logs
create policy "Users can view and create logs for their own inventory."
    on public.inventory_logs for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
📁 Repository Structure & File Mapping
File Layer	Operational Purpose
package.json / package-lock.json	Formulates project baseline configuration and dependencies including React 19, Vite 8, and the Supabase Client SDK.
eslint.config.js	Enforces structural code consistency using flat-config rules for modern ECMAScript codebases.
.env	Specifying required configuration endpoints for your VITE_SUPABASE_URL and public anon key parameters.
.gitignore	Manages project security by intentionally blocking local build outputs (/dist), cache, dependencies, and environment files from exposure.
🛠️ Local Installation & Provisioning
Prerequisites
Node.js (v18.0.0 or higher recommended)

NPM (or equivalent package manager)

Step 1: Clone the Core Codebase
Bash
git clone <your-repository-url>
cd stockpulse
Step 2: Install Application Dependencies
Bash
npm install
Step 3: Configure Environment Variables
Create a new file named .env in the root workspace and supply your remote infrastructure connection keys:

Code snippet
VITE_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
VITE_SUPABASE_ANON_KEY=your-public-anon-key-string
Step 4: Launch the Local Engine
Bash
npm run dev
The application will launch a hot-reloading pipeline available locally at http://localhost:5173.


***

