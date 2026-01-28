'use client';

import { useEffect, useState } from 'react';
import { services } from '@/lib/api';
import type { Service } from '@/lib/api';

export default function SettingsServicesPage() {
  const [list, setList] = useState<Service[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  function loadServices() {
    services.list().then(setList).catch(() => setList([]));
  }

  function openCreate() {
    setName('');
    setPriceDollars('');
    setEditingId(null);
    setError('');
    setShowModal(true);
  }

  function openEdit(s: Service) {
    setName(s.name);
    setPriceDollars((s.priceCents / 100).toFixed(2));
    setEditingId(s.id);
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const priceCents = priceDollars ? Math.round(parseFloat(priceDollars) * 100) : 0;
      if (priceCents < 0) {
        setError('Price must be >= 0');
        setLoading(false);
        return;
      }
      if (editingId) {
        await services.update(editingId, { name, priceCents });
      } else {
        await services.create(name, priceCents);
      }
      setShowModal(false);
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this service?')) return;
    try {
      await services.delete(id);
      loadServices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create Service
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Default Price</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {list.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 text-sm text-gray-800">{s.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  ${(s.priceCents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(s)}
                    className="mr-2 rounded px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                  No services yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowModal(false)}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              {editingId ? 'Edit Service' : 'Create Service'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Default Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
