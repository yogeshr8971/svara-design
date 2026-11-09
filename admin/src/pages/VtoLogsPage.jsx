import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { formatDate } from '../utils/formatDate';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function VtoLogsPage() {
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVtoLogs = async () => {
    try {
      setLoading(true);
      const res = await adminService.getVtoGenerations({ limit: 50 });
      setGenerations(res.generations || []);
    } catch {
      toast.error('Failed to load virtual try-on logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVtoLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-heading text-2xl font-bold">AI Virtual Try-On Generations</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Audit customer AI styling generations, provider response status, and credits accounting.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchVtoLogs}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </Button>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : generations.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <Sparkles size={32} className="mx-auto text-charcoal-400" />
          <h3 className="font-display text-lg font-bold text-charcoal-700">No VTO Generations Logged</h3>
        </div>
      ) : (
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ivory-100 text-charcoal-600 uppercase font-semibold text-[10px] tracking-wider border-b border-ivory-200">
                <tr>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Style Garment</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created</th>
                  <th className="p-3.5 text-right">Result Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {generations.map((g) => (
                  <tr key={g._id} className="hover:bg-ivory-50/80">
                    <td className="p-3.5">
                      <p className="font-bold text-charcoal-800">{g.userId?.name || 'Customer'}</p>
                      <p className="text-[10px] text-charcoal-400">{g.userId?.email}</p>
                    </td>
                    <td className="p-3.5 font-medium text-charcoal-700">{g.productId?.name || 'Garment'}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          g.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-charcoal-500">{formatDate(g.createdAt)}</td>
                    <td className="p-3.5 text-right">
                      {g.resultImageUrl ? (
                        <a
                          href={g.resultImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-burgundy-600 font-bold hover:underline"
                        >
                          View Render
                        </a>
                      ) : (
                        <span className="text-charcoal-400">—</span>
                      )}
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
