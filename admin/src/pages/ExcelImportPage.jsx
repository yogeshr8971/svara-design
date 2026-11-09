import React, { useState } from 'react';
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import * as adminService from '../services/adminService';
import toast from 'react-hot-toast';

export default function ExcelImportPage() {
  const [excelFile, setExcelFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState(null);

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!excelFile) return toast.error('Select an Excel spreadsheet (.xlsx) first.');

    try {
      setValidating(true);
      setSummary(null);
      const data = new FormData();
      data.append('excel', excelFile);
      for (let i = 0; i < imageFiles.length; i++) {
        data.append('images', imageFiles[i]);
      }
      const res = await adminService.previewExcelImport(data);
      setPreview(res);
      toast.success(`Validated ${res.totalRows} rows (${res.validCount} valid, ${res.invalidCount} invalid).`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to validate Excel spreadsheet.');
    } finally {
      setValidating(false);
    }
  };

  const handleExecute = async () => {
    if (!excelFile) return toast.error('Select an Excel spreadsheet (.xlsx).');

    try {
      setImporting(true);
      const data = new FormData();
      data.append('excel', excelFile);
      for (let i = 0; i < imageFiles.length; i++) {
        data.append('images', imageFiles[i]);
      }
      const res = await adminService.executeExcelImport(data);
      setSummary(res.result);
      setPreview(null);
      toast.success(`Bulk import completed: ${res.result?.successful || 0} styles published.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import execution failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-heading text-2xl font-bold">Excel Bulk Product Ingestion</h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Ingest structured spreadsheets of catalog styles with associated photographs and variant SKUs.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={adminService.downloadExcelTemplate}>
          <Download size={14} />
          <span>Download Spreadsheet Template (.xlsx)</span>
        </Button>
      </div>

      {/* Upload & Validation Card */}
      <div className="glass-card p-6 space-y-5 max-w-2xl">
        <form onSubmit={handlePreview} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1">
              1. Excel File (.xlsx)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              className="input-field py-2 text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1">
              2. Associated Photographs (Optional if using image URLs)
            </label>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
              className="input-field py-2 text-xs"
            />
            <p className="text-[10px] text-charcoal-400 mt-1">
              Filenames should match the image names referenced in the Excel spreadsheet.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" variant="primary" size="sm" loading={validating}>
              <Upload size={14} />
              <span>Validate & Preview Rows</span>
            </Button>
            {excelFile && (
              <span className="text-xs text-charcoal-500 font-medium">Selected: {excelFile.name}</span>
            )}
          </div>
        </form>
      </div>

      {/* Validation Preview */}
      {preview && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-ivory-200 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-charcoal-800">
                Ingestion Preview: {preview.totalRows} Total Rows
              </h3>
              <p className="text-xs text-charcoal-400">
                <span className="text-emerald-700 font-bold">{preview.validCount} valid styles</span> ·{' '}
                <span className="text-rose-700 font-bold">{preview.invalidCount} invalid rows</span>
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              loading={importing}
              disabled={preview.validCount === 0}
              onClick={handleExecute}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 size={14} />
              <span>Confirm & Ingest {preview.validCount} Valid Styles</span>
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-ivory-200 text-xs">
            {preview.preview?.map((row, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-charcoal-800">{row.name}</span>
                  <span className="text-charcoal-500 ml-2">₹{row.price}</span>
                  {row.errors?.length > 0 && (
                    <p className="text-[11px] text-rose-600 mt-0.5">Errors: {row.errors.join(', ')}</p>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    row.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {row.isValid ? 'Ready' : 'Invalid'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Summary */}
      {summary && (
        <div className="glass-card p-6 space-y-2 border-l-4 border-l-emerald-600">
          <h3 className="font-display text-base font-bold text-charcoal-800">Import Batch Completed</h3>
          <p className="text-xs text-charcoal-600">
            Successfully imported <strong>{summary.successful}</strong> styles. Failed: <strong>{summary.failed}</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
