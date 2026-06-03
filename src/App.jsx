import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus,
  Minus,
  Search,
  AlertTriangle,
  Layers,
  Trash2,
  ShoppingBag,
  Loader2,
  RefreshCw,
  History,
  X,
  TrendingUp,
  PackageCheck,
  ChevronRight,
  ArrowRightLeft,
  Sun,
  Moon,
} from 'lucide-react';

// Initialize open database connection for MVP testing
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://hylzqoaymdwmureerflp.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5bHpxb2F5bWR3bXVyZWVyflpWUiIsicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDA2OTEsImV4cCI6MjA5NDU3NjY5MX0.pnqrRudzzxXBu7D98MAHte4McPwVzgmhIV18NnIQYkY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // App Control States
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'alerts'
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);

  // Product Creation Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    product_name: '',
    sku: '',
    quantity: '',
    threshold: '5',
    unit_price: '',
  });

  // ==========================================
  // 1. LIVE DATABASE DATA FETCH ENGINE
  // ==========================================
  const fetchInventory = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('product_name', { ascending: true });

      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error('Database connection error:', err.message);
      setErrorMessage(
        'Could not load inventory database. Ensure your keys are correct and the database is accessible.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const { data, error } = await supabase
        .from('inventory_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching history logs:', err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    if (showLogsDrawer) {
      fetchLogs();
    }
  }, [showLogsDrawer]);

  // ==========================================
  // 2. LIVE STATE ANALYTICS
  // ==========================================
  const stats = useMemo(() => {
    let totalItems = inventory.length;
    let lowStockCount = 0;
    let totalValue = 0;
    let outOfStockCount = 0;

    inventory.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const threshold = Number(item.threshold) || 0;

      totalValue += qty * price;
      if (qty === 0) {
        outOfStockCount++;
        lowStockCount++;
      } else if (qty <= threshold) {
        lowStockCount++;
      }
    });

    return { totalItems, lowStockCount, totalValue, outOfStockCount };
  }, [inventory]);

  const getItemStatus = (quantity, threshold) => {
    const q = Number(quantity) || 0;
    const t = Number(threshold) || 0;

    if (q === 0)
      return {
        label: 'Out of Stock',
        classes:
          'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20 ring-rose-500/10',
      };
    if (q <= t)
      return {
        label: 'Low Stock',
        classes:
          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 ring-amber-500/10',
      };
    return {
      label: 'In Stock',
      classes:
        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 ring-emerald-500/10',
    };
  };

  // ==========================================
  // 3. TRANSACTION EXECUTION
  // ==========================================
  const handleAdjustStock = async (item, change) => {
    const targetQuantity = item.quantity + change;
    if (targetQuantity < 0) return;

    const actionWord = change > 0 ? 'restock / addition' : 'sale / reduction';
    const defaultReason = change > 0 ? 'Restock Supplier' : 'Customer Sale';

    const userReason = window.prompt(
      `Enter operational reason for this ${actionWord}:`,
      defaultReason
    );

    if (userReason === null) return;
    const finalReason = userReason.trim() || defaultReason;

    try {
      setInventory((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, quantity: targetQuantity } : i
        )
      );

      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          quantity: targetQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase.from('inventory_logs').insert([
        {
          product_id: item.id,
          product_name: item.product_name,
          change_amount: change,
          new_quantity: targetQuantity,
          reason: finalReason,
        },
      ]);

      if (logError) throw logError;

      if (showLogsDrawer) fetchLogs();
    } catch (err) {
      alert('Failed to sync stock change: ' + err.message);
      fetchInventory();
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.product_name) return;

    try {
      setLoading(true);
      const initialQty = parseInt(newProduct.quantity) || 0;

      const payload = {
        product_name: newProduct.product_name,
        sku: newProduct.sku || null,
        quantity: initialQty,
        threshold: parseInt(newProduct.threshold) || 0,
        unit_price: parseFloat(newProduct.unit_price) || 0.0,
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('inventory')
        .insert([payload])
        .select()
        .single();

      if (insertError) throw insertError;

      if (insertedData) {
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert([
            {
              product_id: insertedData.id,
              product_name: insertedData.product_name,
              change_amount: initialQty,
              new_quantity: initialQty,
              reason: 'Initial Catalog Baseline',
            },
          ]);

        if (logError) throw logError;
      }

      setShowAddModal(false);
      setNewProduct({
        product_name: '',
        sku: '',
        quantity: '',
        threshold: '5',
        unit_price: '',
      });

      await fetchInventory();
    } catch (err) {
      alert('Error adding product record: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (
      !window.confirm(
        'Permanently delete this product record from cloud storage?'
      )
    )
      return;

    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      setInventory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      alert('Error deleting record: ' + err.message);
    }
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const name = item.product_name ? item.product_name.toLowerCase() : '';
      const sku = item.sku ? item.sku.toLowerCase() : '';
      const search = searchTerm.toLowerCase();

      const matchesSearch = name.includes(search) || sku.includes(search);
      const matchesFilter =
        filterMode === 'all' || item.quantity <= item.threshold;

      return matchesSearch && matchesFilter;
    });
  }, [inventory, searchTerm, filterMode]);

  // Helper to safely switch theme styling wrappers
  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen font-sans antialiased selection:bg-blue-500 selection:text-white transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* HEADER PANELS */}
      <nav
        className={`sticky top-0 z-40 border-b px-6 py-4 backdrop-blur-md transition-colors duration-200 ${
          isDark
            ? 'border-slate-900 bg-slate-950/80'
            : 'border-slate-200 bg-white/80'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/10">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xl font-bold tracking-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  StockPulse
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                    isDark
                      ? 'bg-slate-800 text-slate-400 border-slate-700/60'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  Retail Ledger
                </span>
              </div>
              <p
                className={`text-xs font-medium tracking-wide ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Automated Inventory Logs & Reconciliation
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* THEME MODE TOGGLE BUTTON */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition duration-150 active:scale-95 ${
                isDark
                  ? 'border-slate-800 bg-slate-900 text-amber-400 hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={() => setShowLogsDrawer(true)}
              className={`flex items-center space-x-2 rounded-xl border px-4 py-2 text-sm font-medium transition duration-150 active:scale-95 ${
                isDark
                  ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <History className="h-4 w-4 text-blue-500" />
              <span>Audit Trail</span>
            </button>

            <button
              onClick={fetchInventory}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition duration-150 active:scale-95 ${
                isDark
                  ? 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                  : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Sync Database"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading ? 'animate-spin text-blue-500' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 shadow-lg">
            {errorMessage}
          </div>
        )}

        {/* NOTIFICATION CENTER */}
        {stats.lowStockCount > 0 && (
          <div
            className={`mb-8 flex items-center justify-between rounded-xl border bg-gradient-to-r from-amber-500/10 to-transparent p-4 text-sm text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-amber-500/10 ${
              isDark ? 'border-amber-500/20' : 'border-amber-500/30'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-semibold">System Notification:</span>{' '}
                {stats.lowStockCount} item
                {stats.lowStockCount > 1 ? 's are' : ' is'} below critical alert
                thresholds.{' '}
                {stats.outOfStockCount > 0 &&
                  `${stats.outOfStockCount} line item completely depleted.`}
              </div>
            </div>
            <button
              onClick={() => setFilterMode('alerts')}
              className="flex items-center space-x-1 font-semibold text-amber-600 dark:text-amber-400 hover:underline text-xs bg-amber-500/10 px-3 py-1.5 rounded-lg transition"
            >
              <span>Isolate Alerts</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* METRICS PLATFORM */}
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div
            className={`group rounded-2xl border p-6 shadow-sm transition-all duration-200 ${
              isDark
                ? 'border-slate-900 bg-slate-900/50 hover:border-slate-800'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Total Products
                </p>
                <h3
                  className={`mt-2 text-3xl font-extrabold tracking-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {stats.totalItems}
                </h3>
              </div>
              <div
                className={`rounded-xl border p-3 transition-colors ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-400 group-hover:bg-blue-500/10 group-hover:text-blue-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500 group-hover:bg-blue-50'
                }`}
              >
                <Layers className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div
            className={`group rounded-2xl border p-6 shadow-sm transition-all duration-200 ${
              stats.lowStockCount > 0
                ? 'border-amber-500/20 bg-amber-500/[0.01] hover:border-amber-500/30'
                : isDark
                ? 'border-slate-900 bg-slate-900/50 hover:border-slate-800'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Alert Flags
                </p>
                <h3
                  className={`mt-2 text-3xl font-extrabold tracking-tight ${
                    stats.lowStockCount > 0
                      ? 'text-amber-500'
                      : isDark
                      ? 'text-white'
                      : 'text-slate-900'
                  }`}
                >
                  {stats.lowStockCount}
                </h3>
              </div>
              <div
                className={`rounded-xl border p-3 ${
                  stats.lowStockCount > 0
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div
            className={`group rounded-2xl border p-6 shadow-sm transition-all duration-200 ${
              isDark
                ? 'border-slate-900 bg-slate-900/50 hover:border-slate-800'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Asset Valuation
                </p>
                <h3 className="mt-2 text-3xl font-extrabold text-emerald-500 dark:text-emerald-400 tracking-tight">
                  ₦
                  {stats.totalValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </h3>
              </div>
              <div
                className={`rounded-xl border p-3 transition-colors ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500 group-hover:bg-emerald-50'
                }`}
              >
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* DESKTOP CONSOLE OPERATIONS */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Filter by product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition duration-150 ${
                isDark
                  ? 'border-slate-800 bg-slate-900 text-slate-200 placeholder:text-slate-600 focus:border-slate-700 focus:ring-2 focus:ring-slate-800/50'
                  : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100'
              }`}
            />
          </div>

          <div className="flex items-center space-x-3">
            <div
              className={`inline-flex rounded-xl p-1 border ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                onClick={() => setFilterMode('all')}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  filterMode === 'all'
                    ? isDark
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                All Items
              </button>
              <button
                onClick={() => setFilterMode('alerts')}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-150 flex items-center space-x-1 ${
                  filterMode === 'alerts'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <span>Alerts Only</span>
                {stats.lowStockCount > 0 && (
                  <span className="ml-1 flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/10 transition-all duration-150 hover:bg-blue-500 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* DATATABLE PLATFORM */}
        <div
          className={`overflow-hidden rounded-2xl border shadow-xl ${
            isDark
              ? 'border-slate-900 bg-slate-900/30'
              : 'border-slate-200 bg-white'
          }`}
        >
          {loading && filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin text-blue-500 mb-3" />
              <p className="text-xs tracking-wider">
                Loading system directory...
              </p>
            </div>
          ) : filteredInventory.length === 0 ? (
            /* ONBOARDING / EMPTY STATE VIEW */
            <div className="flex flex-col items-center justify-center py-24 text-center px-4 max-w-sm mx-auto">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-5 border shadow-inner ${
                  isDark
                    ? 'bg-slate-900 text-slate-700 border-slate-800'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                <PackageCheck className="h-6 w-6 text-blue-500/50" />
              </div>
              <h3
                className={`text-lg font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                No Inventory Found
              </h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {searchTerm
                  ? 'No products match your exact lookup parameters.'
                  : "Your cloud store has no catalog entries active. Let's establish your initial baseline."}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-6 flex items-center space-x-2 rounded-xl bg-blue-600/10 border border-blue-500/20 px-5 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-600/20 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Entry</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead
                  className={`text-xs uppercase tracking-wider border-b ${
                    isDark
                      ? 'bg-slate-900 text-slate-400 border-slate-800'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  <tr>
                    <th className="px-6 py-4 font-bold">Product Details</th>
                    <th className="px-6 py-4 font-bold text-center">Status</th>
                    <th className="px-6 py-4 font-bold text-center">
                      Quantity
                    </th>
                    <th className="px-6 py-4 font-bold text-right">
                      Asset Valuation
                    </th>
                    <th className="px-6 py-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 bg-transparent">
                  {filteredInventory.map((item) => {
                    const status = getItemStatus(item.quantity, item.threshold);
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors duration-150 ${
                          isDark
                            ? 'hover:bg-slate-900/40'
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div
                            className={`font-bold text-base ${
                              isDark ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {item.product_name}
                          </div>
                          <div className="mt-1 flex items-center space-x-2 text-xs text-slate-400 dark:text-slate-500">
                            <span
                              className={`font-mono px-2 py-0.5 rounded border ${
                                isDark
                                  ? 'bg-slate-900 border-slate-800'
                                  : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              SKU: {item.sku || 'N/A'}
                            </span>
                            <span>•</span>
                            <span>
                              Alert Threshold:{' '}
                              <strong className="text-slate-600 dark:text-slate-400 font-medium">
                                {item.threshold}
                              </strong>
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ring-1 ring-inset ${status.classes}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-2.5">
                            <button
                              onClick={() => handleAdjustStock(item, -1)}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition active:scale-90 disabled:opacity-30 ${
                                isDark
                                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-rose-400'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-rose-500'
                              }`}
                              disabled={item.quantity <= 0}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span
                              className={`w-10 text-center text-base font-bold font-mono ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleAdjustStock(item, 1)}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition active:scale-90 ${
                                isDark
                                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-emerald-400'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-emerald-500'
                              }`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-mono font-semibold text-base ${
                            isDark ? 'text-slate-200' : 'text-slate-800'
                          }`}
                        >
                          ₦
                          {(item.quantity * item.unit_price).toLocaleString(
                            'en-US',
                            { minimumFractionDigits: 2 }
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteProduct(item.id)}
                            className="inline-flex rounded-xl p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition active:scale-90"
                            title="Delete Item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* HISTORICAL DRAWER */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md border-l p-6 shadow-2xl transition-transform duration-300 ease-out backdrop-blur-xl ${
          showLogsDrawer ? 'translate-x-0' : 'translate-x-full'
        } ${
          isDark
            ? 'border-slate-900 bg-slate-950/95 shadow-black'
            : 'border-slate-200 bg-white/95 shadow-slate-200'
        }`}
      >
        <div
          className={`flex items-center justify-between border-b pb-4 mb-6 ${
            isDark ? 'border-slate-900' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <History className="h-5 w-5 text-blue-500" />
            <div>
              <h3
                className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Immutable Audit Trail
              </h3>
              <p className="text-xs text-slate-400">
                Live transaction synchronization ledger
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogsDrawer(false)}
            className={`rounded-xl border p-2 transition ${
              isDark
                ? 'border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white'
                : 'border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[calc(100vh-120px)] overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
              <p className="text-xs">Querying audit transactions...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              No historical data tracked yet.
            </div>
          ) : (
            logs.map((log) => {
              const isAddition = log.change_amount >= 0;
              return (
                <div
                  key={log.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    isDark
                      ? 'border-slate-900 bg-slate-900/20'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`font-bold text-sm ${
                        isDark ? 'text-white' : 'text-slate-800'
                      }`}
                    >
                      {log.product_name}
                    </span>
                    <span
                      className={`inline-flex items-center font-mono text-xs font-bold rounded px-2 py-0.5 border ${
                        isAddition
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/10'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/10'
                      }`}
                    >
                      <ArrowRightLeft className="h-3 w-3 mr-1 inline" />
                      {isAddition ? `+${log.change_amount}` : log.change_amount}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Reason:{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-semibold italic">
                      "{log.reason}"
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>
                      Balance: <strong>{log.new_quantity}</strong>
                    </span>
                    <span>
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* OVERLAY FOR DRAWER BACKDROP */}
      {showLogsDrawer && (
        <div
          onClick={() => setShowLogsDrawer(false)}
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm transition-opacity duration-300"
        />
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md">
          <div
            className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${
              isDark
                ? 'border-slate-900 bg-slate-900'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div
              className={`border-b px-6 py-4.5 ${
                isDark
                  ? 'border-slate-800 bg-slate-950'
                  : 'border-slate-100 bg-slate-50'
              }`}
            >
              <h3
                className={`text-lg font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Add New Product
              </h3>
            </div>
            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={newProduct.product_name}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      product_name: e.target.value,
                    })
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                    isDark
                      ? 'border-slate-800 bg-slate-950 text-slate-200 focus:border-slate-700'
                      : 'border-slate-200 bg-white text-slate-800 focus:border-slate-300'
                  }`}
                  placeholder="e.g. Wireless Charger"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  SKU (Optional)
                </label>
                <input
                  type="text"
                  value={newProduct.sku}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, sku: e.target.value })
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                    isDark
                      ? 'border-slate-800 bg-slate-950 text-slate-200 focus:border-slate-700'
                      : 'border-slate-200 bg-white text-slate-800 focus:border-slate-300'
                  }`}
                  placeholder="e.g. WC-002"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Initial Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.quantity}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, quantity: e.target.value })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                      isDark
                        ? 'border-slate-800 bg-slate-950 text-slate-200 focus:border-slate-700'
                        : 'border-slate-200 bg-white text-slate-800 focus:border-slate-300'
                    }`}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Alert Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.threshold}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        threshold: e.target.value,
                      })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                      isDark
                        ? 'border-slate-800 bg-slate-950 text-slate-200 focus:border-slate-700'
                        : 'border-slate-200 bg-white text-slate-800 focus:border-slate-300'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Unit Price (₦)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProduct.unit_price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, unit_price: e.target.value })
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                    isDark
                      ? 'border-slate-800 bg-slate-950 text-slate-200 focus:border-slate-700'
                      : 'border-slate-200 bg-white text-slate-800 focus:border-slate-300'
                  }`}
                  placeholder="0.00"
                />
              </div>

              <div
                className={`mt-8 flex items-center justify-end space-x-3 pt-4 border-t ${
                  isDark ? 'border-slate-800' : 'border-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newProduct.product_name}
                  className="flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
