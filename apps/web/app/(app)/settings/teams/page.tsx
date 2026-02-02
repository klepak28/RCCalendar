'use client';

import { useEffect, useState } from 'react';
import { teams, sortTeamsNaturally } from '@/lib/api';
import type { Team } from '@/lib/api';

export default function SettingsTeamsPage() {
  const [list, setList] = useState<Team[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#6b7280');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  function loadTeams() {
    teams.list().then((t) => setList(sortTeamsNaturally(t))).catch(() => setList([]));
  }

  function openCreate() {
    setName('');
    setColorHex('#6b7280');
    setEditingId(null);
    setError('');
    setShowModal(true);
  }

  function openEdit(t: Team) {
    setName(t.name);
    setColorHex(t.colorHex);
    setEditingId(t.id);
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!/^#([0-9a-fA-F]{6})$/.test(colorHex)) {
        setError('Color must be #RRGGBB format');
        setLoading(false);
        return;
      }
      if (editingId) {
        await teams.update(editingId, { name, colorHex });
      } else {
        await teams.create(name, colorHex);
      }
      setShowModal(false);
      loadTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this team?')) return;
    try {
      await teams.delete(id);
      loadTeams();
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
          Create Team
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Color</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {list.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 text-sm text-gray-800">{t.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded border border-gray-300"
                      style={{ backgroundColor: t.colorHex }}
                    />
                    <span className="text-sm text-gray-600">{t.colorHex}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(t)}
                    className="mr-2 rounded px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
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
                  No teams yet. Create one to assign tasks to teams.
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
              {editingId ? 'Edit Team' : 'Create Team'}
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
                <label className="mb-1 block text-sm font-medium">Color (#RRGGBB) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="h-10 w-20 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    className="flex-1 rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                    placeholder="#6b7280"
                    required
                  />
                </div>
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
