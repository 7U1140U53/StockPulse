import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import {
  Layers,
  Loader2,
  Sun,
  Moon,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  Package,
  Wallet,
  TrendingUp,
  Clock,
  X,
  LogOut,
  PackageX,
  Search,
  SlidersHorizontal,
  Edit,
  Coins
} from 'lucide-react';

export default function App() {
  // --- CORE ENGINE STATES ---
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('dark');

  // --- IDENTITY & SECURITY STATES ---
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // --- UI INTERACTIVE STATES ---
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Filter Engine States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Inline quantity adjustment controls
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustValue, setAdjustValue] = useState('1');

  // --- STANDARDIZED FORM STATES ---
  const [newProduct, setNewProduct] = useState({
    product_name: '',
    quantity: '',
    unit_price: '',
    cost_price: '' // Integrated cost base column
  });

  const [editingProduct, setEditingProduct] = useState({
    id: '',
    product_name: '',
    unit_price: '',
    cost_price: ''
  });

  // --- IDENTITY LIFECYCLE HANDSHAKE ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        fetchInventoryAndLogs(currentSession.user.id);
      } else {
        setInventory([]);
        setLogs([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- DATABASE READ WORKFLOWS ---
  const fetchInventoryAndLogs = async (userId) => {
    setLoading(true);
    try {
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (invError) throw invError;
      setInventory(inventoryData || []);

      const { data: logsData, error: logsError } = await supabase
        .from('inventory_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);

      if (logsError) throw logsError;
      setLogs(logsData || []);
    } catch (err) {
      console.error("Operational Fetch Failure:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- INLINE VOLUME TRANSACTION OPERATIONS ---
  const handleUpdateStock = async (item, action) => {
    if (!session?.user?.id) return;
    const changeAmt = parseInt(adjustValue) || 1;
    const currentQty = parseInt(item.quantity) || 0;

    if (action === 'DEDUCT' && currentQty < changeAmt) {
      alert(`Operation Aborted: Insufficient stock levels. Cannot deduct ${changeAmt} units from current volume of ${currentQty}.`);
      return;
    }

    const nextQuantity = action === 'ADD' ? currentQty + changeAmt : currentQty - changeAmt;
    const logAmount = action === 'ADD' ? changeAmt : -changeAmt;
    const logReason = action === 'ADD'
      ? `Restocked catalog with +${changeAmt} inbound units.`
      : `Dispatched -${changeAmt} units via outgoing operation.`;

    try {
      setLoading(true);

      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: nextQuantity })
        .eq('id', item.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          product_id: item.id,
          product_name: item.product_name || "Unknown Asset",
          change_amount: logAmount,
          new_quantity: nextQuantity,
          reason: logReason
        }]);

      if (logError) throw logError;

      setAdjustingId(null);
      setAdjustValue('1');
      await fetchInventoryAndLogs(session.user.id);
    } catch (err) {
      alert(`Stock transaction failure: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- INVENTORY CREATE WORKFLOW ---
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    setSubmitLoading(true);
    const user_id = session.user.id;

    try {
      const payload = {
        product_name: newProduct.product_name,
        quantity: parseInt(newProduct.quantity) || 0,
        unit_price: parseFloat(newProduct.unit_price) || 0,
        cost_price: parseFloat(newProduct.cost_price) || 0,
        user_id: user_id
      };

      const { data: insertedProduct, error: invError } = await supabase
        .from('inventory')
        .insert([payload])
        .select()
        .single();

      if (invError) throw invError;

      if (insertedProduct) {
        const logPayload = {
          product_id: insertedProduct.id,
          product_name: insertedProduct.product_name,
          change_amount: parseInt(newProduct.quantity) || 0,
          new_quantity: parseInt(newProduct.quantity) || 0,
          reason: `Initial catalog tracking established for ${insertedProduct.product_name}.`
        };

        await supabase.from('inventory_logs').insert([logPayload]);
      }

      setNewProduct({ product_name: '', quantity: '', unit_price: '', cost_price: '' });
      setIsAddModalOpen(false);
      fetchInventoryAndLogs(user_id);
    } catch (err) {
      alert(`Database Schema Rejection: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  // --- INVENTORY EDIT & RENAME OPERATION ---
  const handleEditProduct = async (e) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    setSubmitLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          product_name: editingProduct.product_name,
          unit_price: parseFloat(editingProduct.unit_price) || 0,
          cost_price: parseFloat(editingProduct.cost_price) || 0
        })
        .eq('id', editingProduct.id);

      if (updateError) throw updateError;

      const currentItem = inventory.find(item => item.id === editingProduct.id);
      await supabase.from('inventory_logs').insert([{
        product_id: editingProduct.id,
        product_name: editingProduct.product_name,
        change_amount: 0,
        new_quantity: currentItem ? parseInt(currentItem.quantity) : 0,
        reason: `Product details adjusted. Identity/Financial specifications successfully re-calibrated.`
      }]);

      setIsEditModalOpen(false);
      fetchInventoryAndLogs(session.user.id);
    } catch (err) {
      alert(`Update processing error: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteProduct = async (id, productName) => {
    if (!session?.user?.id) return;
    if (!confirm(`Are you certain you want to remove ${productName} from cloud storage permanently?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setInventory(inventory.filter(item => item.id !== id));
      fetchInventoryAndLogs(session.user.id);
    } catch (err) {
      alert(`Purge failure: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // --- FINANCIAL INTELLIGENCE & QUANTITATIVE COMPUTATIONS ---
  const totalValuation = inventory.reduce((acc, item) => {
    const price = parseFloat(item.unit_price) || 0;
    const qty = parseInt(item.quantity) || 0;
    return acc + (price * qty);
  }, 0);

  const totalCapitalInvested = inventory.reduce((acc, item) => {
    const cost = parseFloat(item.cost_price) || 0;
    const qty = parseInt(item.quantity) || 0;
    return acc + (cost * qty);
  }, 0);

  const netProjectedProfit = totalValuation - totalCapitalInvested;
  const lowStockAlerts = inventory.filter(item => (parseInt(item.quantity) || 0) <= 5).length;

  // --- HIGH-PERFORMANCE SEARCH & FILTER ARRAYS ---
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch = (item.product_name || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const safeQty = parseInt(item.quantity) || 0;

      if (statusFilter === 'LOW_STOCK') {
        return matchesSearch && safeQty <= 5;
      }
      if (statusFilter === 'OUT_OF_STOCK') {
        return matchesSearch && safeQty === 0;
      }
      return matchesSearch;
    });
  }, [inventory, searchQuery, statusFilter]);

  const isDark = theme === 'dark';

  if (initializing) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex items-center space-x-3 mb-4 animate-pulse">
          <Layers className="h-8 w-8 text-blue-500" />
          <span className="text-2xl font-bold tracking-wider">StockPulse</span>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-slate-400" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage supabase={supabase} isDark={isDark} theme={theme} setTheme={setTheme} />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      {/* NAVBAR */}
      <nav className={`px-6 py-4 border-b backdrop-blur-md sticky top-0 z-40 ${isDark ? 'border-slate-900 bg-slate-950/80' : 'border-slate-200 bg-white/80'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Layers className="h-6 w-6 text-blue-500" />
            <span className="text-lg font-bold tracking-wider">StockPulse</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">Secure Operations Schema</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsLogDrawerOpen(true)}
              className={`flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-xl border transition ${isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Audit History Ledger</span>
            </button>

            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-2 rounded-xl border transition ${isDark ? 'border-slate-800 bg-slate-900 text-amber-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={handleSignOut}
              className={`p-2 rounded-xl border transition group ${isDark ? 'border-slate-800 bg-slate-900 text-red-400 hover:bg-red-950/30' : 'border-slate-200 bg-white text-slate-600 hover:bg-red-50'}`}
              title="Secure Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* DASHBOARD CONTAINER */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Operations Dashboard</h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Tenant Identity Workspace: <span className="font-semibold text-blue-500">{session.user.email}</span>
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center space-x-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition duration-200 shadow-lg"
          >
            <Plus className="h-4 w-4" />
            <span>Track New Asset</span>
          </button>
        </div>

        {/* METRICS INTEL MATRIX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className={`p-5 rounded-2xl border ${isDark ? 'border-slate-900 bg-slate-900/30' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Retail Valuation</span>
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-extrabold tracking-tight">₦{totalValuation.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-slate-500 mt-1">Gross liquidity potential</p>
          </div>

          <div className={`p-5 rounded-2xl border ${isDark ? 'border-slate-900 bg-slate-900/30' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Capital Investment</span>
              <Coins className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold tracking-tight">₦{totalCapitalInvested.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-slate-500 mt-1">Cost basis inventory capital</p>
          </div>

          <div className={`p-5 rounded-2xl border ${isDark ? 'border-slate-900 bg-slate-900/30' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Projected Net Profit</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className={`text-2xl font-extrabold tracking-tight ${netProjectedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₦{netProjectedProfit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-emerald-500 font-medium mt-1 flex items-center space-x-1">
              <span>Dynamic margin analytics active</span>
            </p>
          </div>

          {/* INTERACTIVE ALERTS BOX */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
            className={`p-5 rounded-2xl border text-left transition duration-200 group relative overflow-hidden ${statusFilter === 'LOW_STOCK'
                ? 'border-amber-500 bg-amber-500/10 shadow-md ring-1 ring-amber-500/30'
                : isDark ? 'border-slate-900 bg-slate-900/30 hover:border-slate-800' : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
              }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Low Stock Indicators</span>
              <AlertTriangle className={`h-4 w-4 transition-transform group-hover:scale-110 ${lowStockAlerts > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <div className="text-2xl font-extrabold tracking-tight">
              {lowStockAlerts} <span className="text-xs font-medium text-slate-400">items</span>
            </div>
            <p className={`text-[10px] mt-1 font-medium ${statusFilter === 'LOW_STOCK' ? 'text-amber-400' : 'text-slate-400'}`}>
              {statusFilter === 'LOW_STOCK' ? '⚡ Active Filter (Click to reset)' : 'Click to isolate items'}
            </p>
          </button>
        </div>

        {/* CONTROLS & SEARCH BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-500/5 p-4 rounded-2xl border border-dashed border-slate-700/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog by designation name..."
              className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border outline-none transition ${isDark ? 'bg-slate-950 border-slate-800 focus:border-slate-700 text-slate-200' : 'bg-white border-slate-200 focus:border-slate-300 text-slate-800'
                }`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs">Clear</button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 self-start sm:self-center">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 mr-1.5 hidden xs:block" />
            {[
              { id: 'ALL', label: 'All Assets' },
              { id: 'LOW_STOCK', label: 'Low Stock' },
              { id: 'OUT_OF_STOCK', label: 'Out of Stock' }
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition duration-150 ${statusFilter === pill.id
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : isDark ? 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                  }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* INVENTORY TRACKING SPECIFICATIONS TABLE */}
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-900 bg-slate-900/20' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className="px-6 py-4 border-b border-inherit flex items-center justify-between">
            <h3 className="font-bold text-sm tracking-wide uppercase text-slate-400">Tracked Catalog Specifications</h3>
            <span className="text-xs text-slate-500 font-medium">Showing {filteredInventory.length} Records</span>
          </div>

          {loading && inventory.length === 0 ? (
            <div className="p-12 flex justify-center items-center"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : filteredInventory.length === 0 ? (
            <div className="p-16 text-center">
              <PackageX className="h-10 w-10 text-slate-600 mx-auto mb-3 stroke-[1.5]" />
              <p className="text-sm font-semibold">No assets found matching current criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`text-xs font-bold uppercase tracking-wider border-b border-inherit ${isDark ? 'bg-slate-900/40 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                    <th className="px-6 py-3.5">Product Identification</th>
                    <th className="px-6 py-3.5">Stock Level</th>
                    <th className="px-6 py-3.5">Volume Adjustment</th>
                    <th className="px-6 py-3.5">Financial Matrix (Cost / Retail)</th>
                    <th className="px-6 py-3.5">Batch Net Profit</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit">
                  {filteredInventory.map((item) => {
                    const safeQuantity = parseInt(item.quantity) || 0;
                    const safeRetail = parseFloat(item.unit_price) || 0;
                    const safeCost = parseFloat(item.cost_price) || 0;

                    const unitMargin = safeRetail - safeCost;
                    const batchProfit = unitMargin * safeQuantity;
                    const markupPercentage = safeCost > 0 ? ((unitMargin / safeCost) * 100).toFixed(0) : '0';
                    const displayedName = item.product_name || "Unnamed Product";

                    return (
                      <tr key={item.id} className="text-sm hover:bg-slate-500/5 transition duration-150">
                        <td className="px-6 py-4 font-semibold">
                          <div className="flex flex-col">
                            <span>{displayedName}</span>
                            {safeQuantity === 0 && <span className="text-[10px] text-red-400 font-bold uppercase tracking-wide mt-0.5">OUT OF STOCK</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1">
                            <span className={`font-mono font-bold text-sm ${safeQuantity <= 5 ? 'text-amber-500' : 'text-blue-400'}`}>{safeQuantity}</span>
                            <span className="text-[11px] text-slate-500">units</span>
                          </div>
                        </td>

                        {/* ADJUST VOLUMES */}
                        <td className="px-6 py-4">
                          {adjustingId === item.id ? (
                            <div className="flex items-center space-x-1 animate-in fade-in zoom-in-95 duration-100">
                              <input
                                type="number" min="1" value={adjustValue}
                                onChange={(e) => setAdjustValue(e.target.value)}
                                className={`w-14 px-2 py-1 text-xs rounded-md border text-center font-mono outline-none ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'}`}
                              />
                              <button onClick={() => handleUpdateStock(item, 'ADD')} className="p-1 rounded bg-emerald-600 text-white"><Plus className="h-3 w-3" /></button>
                              <button onClick={() => handleUpdateStock(item, 'DEDUCT')} className="p-1 rounded bg-amber-600 text-white"><Minus className="h-3 w-3" /></button>
                              <button onClick={() => setAdjustingId(null)} className="p-1 rounded bg-slate-500 text-white"><X className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAdjustingId(item.id); setAdjustValue('1'); }}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${isDark ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                            >
                              Adjust Stock
                            </button>
                          )}
                        </td>

                        {/* STACKED FINANCIAL SPECS */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-xs font-mono">
                            <span className="text-slate-400">Cost: ₦{safeCost.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                            <span className="font-bold text-slate-200 dark:text-white">Retail: ₦{safeRetail.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </td>

                        {/* PROFIT MARGINS */}
                        <td className="px-6 py-4 font-mono">
                          <div className="flex flex-col">
                            <span className={`font-semibold ${batchProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ₦{batchProfit.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">{markupPercentage}% markup margin</span>
                          </div>
                        </td>

                        {/* ACTION MATRIX TRAGETS */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => {
                                setEditingProduct({ id: item.id, product_name: displayedName, unit_price: safeRetail, cost_price: safeCost });
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/5 transition"
                              title="Modify Identity / Price Structure"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(item.id, displayedName)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/5 transition"
                              title="Purge Item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
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

      {/* --- ASSET ATTACHMENT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border animate-in fade-in zoom-in-95 duration-150 ${isDark ? 'border-slate-800 bg-slate-900 shadow-2xl' : 'border-slate-200 bg-white shadow-xl'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Track Operational Asset</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Product Designation Name</label>
                <input
                  type="text" required value={newProduct.product_name}
                  onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                  className={`w-full px-4 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-slate-950 border-slate-800 focus:border-slate-700' : 'bg-white border-slate-200 focus:border-slate-300'}`}
                  placeholder="e.g. Wireless Charger"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Initial Stock Units</label>
                <input
                  type="number" required min="0" value={newProduct.quantity}
                  onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                  className={`w-full px-4 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-slate-950 border-slate-800 focus:border-slate-700' : 'bg-white border-slate-200 focus:border-slate-300'}`}
                  placeholder="10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Cost Price (₦)</label>
                  <input
                    type="number" required step="0.01" min="0" value={newProduct.cost_price}
                    onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                    className={`w-full px-4 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-slate-950 border-slate-800 focus:border-slate-700' : 'bg-white border-slate-200 focus:border-slate-300'}`}
                    placeholder="9000.00"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Retail Price (₦)</label>
                  <input
                    type="number" required step="0.01" min="0" value={newProduct.unit_price}
                    onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })}
                    className={`w-full px-4 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-slate-950 border-slate-800 focus:border-slate-700' : 'bg-white border-slate-200 focus:border-slate-300'}`}
                    placeholder="12500.00"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className={`w-1/2 py-2 text-sm font-semibold rounded-xl border ${isDark ? 'border-slate-800 bg-slate-950 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>Cancel</button>
                <button type="submit" disabled={submitLoading} className="w-1/2 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition disabled:opacity-50">
                  {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Commit Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ASSET MODIFICATION & RENAME MODAL --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border animate-in fade-in zoom-in-95 duration-150 ${isDark ? 'border-slate-800 bg-slate-900 shadow-2xl' : 'border-slate-200 bg-white shadow-xl'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Modify Specifications</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleEditProduct} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Asset Identity Designation</label>
                <input
                  type="text" required value={editingProduct.product_name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, product_name: e.target.value })}
                  className={`w-full px-4 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-slate-950 border-slate-800 focus:border-slate-700' : 'bg-white border-slate-200 focus:border-slate-300'}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Cost Price Base (₦)</label>
                  <input
                    type="number" required step="0.01" min="0" value={editingProduct.cost_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: e.target.value })}
                    className={`w-full px-4 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-slate-950 border-slate-800 focus:border-slate-700' : 'bg-white border-slate-200 focus:border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Retail Selling Price (₦)</label>
                  <input
                    type="number" required step="0.01" min="0" value={editingProduct.unit_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit_price: e.target.value })}
                    className={`w-full px-4 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-slate-950 border-slate-800 focus:border-slate-700' : 'bg-white border-slate-200 focus:border-slate-300'}`}
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className={`w-1/2 py-2 text-sm font-semibold rounded-xl border ${isDark ? 'border-slate-800 bg-slate-950 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>Cancel</button>
                <button type="submit" disabled={submitLoading} className="w-1/2 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition disabled:opacity-50">
                  {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply Adjustments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- AUDIT TRAIL DRAWER --- */}
      {isLogDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsLogDrawerOpen(false)} />
          <div className={`w-full max-w-md h-full p-6 border-l relative flex flex-col animate-in slide-in-from-right duration-200 ${isDark ? 'bg-slate-950 border-slate-900 shadow-2xl' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-inherit">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <h3 className="font-bold text-base">Operational Audit Ledger</h3>
              </div>
              <button onClick={() => setIsLogDrawerOpen(false)} className={`p-1.5 rounded-lg border transition ${isDark ? 'border-slate-800 hover:bg-slate-900' : 'border-slate-200 hover:bg-slate-50'}`}><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-medium">Zero recent ledger operations detected.</div>
              ) : (
                logs.map((log) => {
                  const isAddition = log.change_amount >= 0;
                  return (
                    <div key={log.id} className={`p-4 rounded-xl border text-xs flex flex-col space-y-2 ${isDark ? 'border-slate-900 bg-slate-900/40' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{log.product_name}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${log.change_amount === 0 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : !isAddition ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                          {log.change_amount === 0 ? 'UPDATED' : isAddition ? (log.change_amount === log.new_quantity ? 'INITIALIZED' : 'RESTOCKED') : 'DISPATCHED'}
                        </span>
                      </div>
                      <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>{log.reason}</p>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                        <span>Delta: {log.change_amount === 0 ? '±0' : isAddition ? `+${log.change_amount}` : log.change_amount} | Supply: {log.new_quantity ?? 'N/A'}</span>
                        <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- SUB-COMPONENT: AUTH PAGE VIEW ---
function AuthPage({ supabase, isDark, theme, setTheme }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Verification email transmitted! Check your inbox to confirm your system clearance.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden border-r border-slate-800">
        <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="flex items-center space-x-3 z-10">
          <Layers className="h-6 w-6 text-blue-500" />
          <span className="text-xl font-bold tracking-wider text-white">StockPulse</span>
        </div>
        <div className="z-10 max-w-md">
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-4 leading-tight">Isolated multi-tenant tracking arrays.</h1>
          <p className="text-slate-400 text-sm leading-relaxed">Manage live inventory sales, execute instant inbound restocks, and monitor high-fidelity data feeds securely.</p>
        </div>
        <div className="text-[10px] text-slate-500 font-mono z-10 uppercase tracking-widest">Secure Core Engine System &bull; Version 1.3.0</div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-12 relative">
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`absolute top-6 right-6 p-2.5 rounded-xl border transition ${isDark ? 'border-slate-800 bg-slate-900/50 text-amber-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className={`w-full max-w-md p-8 rounded-2xl border ${isDark ? 'border-slate-900 bg-slate-900/40 backdrop-blur-sm shadow-xl' : 'border-slate-200 bg-white shadow-md'}`}>
          <div className="mb-6"><h2 className="text-xl font-bold tracking-tight">{isSignUp ? 'Initialize account profile' : 'Sign in to engine'}</h2></div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase mb-1.5 text-slate-400">Operational Email</label>
              <input
                type="email" required disabled={authLoading} value={email} onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition duration-200 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200 focus:border-slate-700' : 'border-slate-200 bg-white text-slate-800 focus:border-slate-300'}`}
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase mb-1.5 text-slate-400">Security Password</label>
              <input
                type="password" required disabled={authLoading} value={password} onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition duration-200 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200 focus:border-slate-700' : 'border-slate-200 bg-white text-slate-800 focus:border-slate-300'}`}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={authLoading} className="w-full mt-2 flex items-center justify-center rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition duration-200">
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignUp ? 'Create System Account' : 'Authenticate Identity'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }} className="text-xs font-semibold text-blue-500 hover:text-blue-400">
              {isSignUp ? 'Return to credential login portal' : 'Establish new secure profile endpoint'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}