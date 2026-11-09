import React, { useState, useEffect } from 'react';
import { DollarSign, Download, Filter, RefreshCw, Calendar, TrendingUp } from 'lucide-react';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import { formatPrice } from '../utils/formatPrice';
import { formatDate } from '../utils/formatDate';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function SettlementReportsPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await adminService.getAllSales({
        limit: 100,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setSales(res.sales || []);
    } catch {
      toast.error('Failed to load settlement reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [startDate, endDate]);

  const totalGross = sales.reduce((acc, s) => acc + (s.grossSale || 0), 0);
  const totalCommission = sales.reduce((acc, s) => acc + (s.commissionAmount || 0), 0);
  const totalSellerRevenue = sales.reduce((acc, s) => acc + (s.sellerRevenue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-heading text-2xl font-bold">Seller Settlement & Sales Audit</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Itemized platform revenue, platform commission deductions, and net seller disbursements.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchSales}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard title="Selected Range Gross" value={formatPrice(totalGross)} icon={DollarSign} />
        <StatCard title="SVARA Commission Deducted" value={formatPrice(totalCommission)} icon={TrendingUp} />
        <StatCard title="Net Seller Payout Obligation" value={formatPrice(totalSellerRevenue)} icon={DollarSign} />
      </div>

      {/* Date Filter */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-charcoal-400" />
          <span className="font-semibold text-charcoal-700">Filter Date Range:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field py-1.5 px-3 text-xs w-36"
          />
          <span className="text-charcoal-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field py-1.5 px-3 text-xs w-36"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className="text-xs font-semibold text-burgundy-600 hover:text-burgundy-800"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : sales.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <DollarSign size={32} className="mx-auto text-charcoal-400" />
          <h3 className="font-display text-lg font-bold text-charcoal-700">No Settled Sales Found</h3>
          <p className="text-xs text-charcoal-400">Paid orders will appear here for commission calculations.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ivory-100 text-charcoal-600 uppercase font-semibold text-[10px] tracking-wider border-b border-ivory-200">
                <tr>
                  <th className="p-3.5">Order #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Item Name</th>
                  <th className="p-3.5">Seller Partner</th>
                  <th className="p-3.5">Qty × Unit Price</th>
                  <th className="p-3.5">Gross Total</th>
                  <th className="p-3.5">SVARA Commission</th>
                  <th className="p-3.5 text-right">Net Seller Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {sales.map((item, idx) => (
                  <tr key={idx} className="hover:bg-ivory-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-charcoal-900">{item.orderNumber}</td>
                    <td className="p-3.5 text-charcoal-500 whitespace-nowrap">{formatDate(item.date)}</td>
                    <td className="p-3.5 font-semibold text-charcoal-800">{item.productName}</td>
                    <td className="p-3.5 text-charcoal-700">{item.sellerName}</td>
                    <td className="p-3.5 text-charcoal-600">
                      {item.quantity} × {formatPrice(item.price)}
                    </td>
                    <td className="p-3.5 font-bold text-charcoal-900">{formatPrice(item.grossSale)}</td>
                    <td className="p-3.5">
                      <span className="font-bold text-burgundy-700">{formatPrice(item.commissionAmount)}</span>
                      <span className="text-[10px] text-charcoal-400 ml-1">({item.commissionRate}%)</span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-emerald-700">
                      {formatPrice(item.sellerRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
