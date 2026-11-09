import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Store,
  Users,
  Package,
  ShoppingBag,
  Sparkles,
  Clock,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { formatPrice } from '../utils/formatPrice';
import { formatDate } from '../utils/formatDate';
import * as adminService from '../services/adminService';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResult, prodsResult, ordersResult] = await Promise.allSettled([
        adminService.getStats(),
        adminService.getAdminProducts({ status: 'pending', limit: 1 }),
        adminService.getAllOrders({ limit: 6 }),
      ]);
      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value?.stats || null);
      }
      if (prodsResult.status === 'fulfilled') {
        setPendingCount(prodsResult.value?.pendingCount || 0);
      }
      if (ordersResult.status === 'fulfilled') {
        setRecentOrders(ordersResult.value?.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-burgundy-600">
            Marketplace Control Center
          </span>
          <h1 className="section-heading text-3xl font-bold mt-0.5">Atelier Executive Overview</h1>
          <p className="text-xs text-charcoal-400 mt-1">
            Real-time platform gross, seller catalogue governance, orders, and commission settlement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Link to="/approvals">
              <Button variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700">
                <Clock size={14} />
                <span>{pendingCount} Pending Approvals</span>
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Platform Gross"
          value={formatPrice(stats?.totalRevenue || 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="SVARA Commission Revenue"
          value={formatPrice(stats?.totalCommission || 0)}
          icon={DollarSign}
        />
        <StatCard
          title="Active Sellers"
          value={stats?.sellers || 0}
          icon={Store}
        />
        <StatCard
          title="Orders Placed"
          value={stats?.orders || 0}
          icon={ShoppingBag}
        />
        <StatCard
          title="Active Catalog Styles"
          value={stats?.products || 0}
          icon={Package}
        />
        <StatCard
          title="Registered Customers"
          value={stats?.users || 0}
          icon={Users}
        />
        <StatCard
          title="Virtual Try-Ons Run"
          value={stats?.vtoGenerations || 0}
          icon={Sparkles}
        />
        <StatCard
          title="Pending Approvals"
          value={pendingCount}
          icon={Clock}
          className={pendingCount > 0 ? 'border-amber-300 ring-2 ring-amber-100' : ''}
        />
      </div>

      {/* Quick Action Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-card p-6 flex flex-col justify-between space-y-4 border-l-4 border-l-amber-500">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Catalogue Queue</span>
            <h3 className="font-display text-lg font-bold text-charcoal-800 mt-1">Product Approvals</h3>
            <p className="text-xs text-charcoal-500 mt-1">
              {pendingCount} seller items awaiting inspection and shipping fee assignment before marketplace publishing.
            </p>
          </div>
          <Link to="/approvals">
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>Review Submissions</span>
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between space-y-4 border-l-4 border-l-burgundy-600">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-burgundy-700">Fulfilment Control</span>
            <h3 className="font-display text-lg font-bold text-charcoal-800 mt-1">Order Status Lifecycle</h3>
            <p className="text-xs text-charcoal-500 mt-1">
              Transition orders through the strictly controlled 3-stage lifecycle: Ordered → Shipped → Delivered.
            </p>
          </div>
          <Link to="/orders">
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>Manage Orders</span>
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between space-y-4 border-l-4 border-l-emerald-600">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Financial Reports</span>
            <h3 className="font-display text-lg font-bold text-charcoal-800 mt-1">Settlement & Commission</h3>
            <p className="text-xs text-charcoal-500 mt-1">
              Inspect line-item seller revenue, deducted platform commissions, and COD collection records.
            </p>
          </div>
          <Link to="/settlements">
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>View Settlements</span>
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-charcoal-800">Recent Customer Orders</h3>
            <p className="text-xs text-charcoal-400">Latest orders placed on the SVARA marketplace.</p>
          </div>
          <Link to="/orders" className="text-xs font-semibold text-burgundy-600 hover:text-burgundy-800 flex items-center gap-1">
            <span>View All Orders</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-xs text-charcoal-400 text-center py-8">No orders recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ivory-100/80 text-charcoal-600 uppercase font-semibold text-[10px] tracking-wider border-b border-ivory-200">
                <tr>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Total Amount</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Order Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {recentOrders.map((order) => {
                  const statusColors = {
                    Ordered: 'bg-blue-100 text-blue-800',
                    Shipped: 'bg-amber-100 text-amber-800',
                    Delivered: 'bg-emerald-100 text-emerald-800',
                    pending_payment: 'bg-charcoal-100 text-charcoal-700',
                  };
                  const statusClass = statusColors[order.orderStatus] || 'bg-ivory-200 text-charcoal-700';

                  return (
                    <tr key={order._id} className="hover:bg-ivory-50/70 transition-colors">
                      <td className="p-3 font-mono font-bold text-charcoal-800">{order.orderNumber}</td>
                      <td className="p-3 font-medium text-charcoal-700">{order.userId?.name || 'Customer'}</td>
                      <td className="p-3 text-charcoal-500">{formatDate(order.createdAt)}</td>
                      <td className="p-3 font-bold text-charcoal-800">{formatPrice(order.totalAmount)}</td>
                      <td className="p-3">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-ivory-200 text-charcoal-700">
                          {order.paymentMethod} · {order.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Link to="/orders">
                          <Button variant="ghost" size="xs">
                            Manage
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
