import { useState, useEffect } from "react";
import { getMySubscriptions, Subscription } from "./youtube";
import { Profile } from "./profiles";

export default function ImportWizard({
  profiles,
  existingChannels,
  onImport,
  onClose,
}: {
  profiles: Profile[];
  existingChannels: Set<string>;
  onImport: (assignments: Map<string, string>) => void; // handle -> profileId
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState("");

  useEffect(() => {
    getMySubscriptions()
      .then((results) => {
        const fresh = results.filter((s) => !existingChannels.has(s.handle));
        setSubs(fresh);
        // Pre-assign all to first profile
        const initial = new Map<string, string>();
        for (const s of fresh) {
          initial.set(s.handle, profiles[0].id);
        }
        setAssignments(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleChannel = (handle: string) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      if (next.has(handle)) {
        next.delete(handle);
      } else {
        next.set(handle, profiles[0].id);
      }
      return next;
    });
  };

  const setProfile = (handle: string, profileId: string) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      next.set(handle, profileId);
      return next;
    });
  };

  const selectAll = () => {
    const next = new Map<string, string>();
    for (const s of filtered) {
      next.set(s.handle, assignments.get(s.handle) || profiles[0].id);
    }
    // Keep existing assignments for non-filtered
    for (const [h, p] of assignments) {
      if (!next.has(h)) next.set(h, p);
    }
    setAssignments(next);
  };

  const selectNone = () => {
    const filteredHandles = new Set(filtered.map((s) => s.handle));
    setAssignments((prev) => {
      const next = new Map(prev);
      for (const h of filteredHandles) {
        next.delete(h);
      }
      return next;
    });
  };

  const filtered = filter.trim()
    ? subs.filter((s) =>
        s.title.toLowerCase().includes(filter.toLowerCase()) ||
        s.handle.toLowerCase().includes(filter.toLowerCase())
      )
    : subs;

  const selectedCount = [...assignments.keys()].filter((h) =>
    filtered.some((s) => s.handle === h)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#252019] border border-[#3a332a] rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#d4c5b0]">Import Subscriptions</h2>
          <button onClick={onClose} className="text-[#5a5044] hover:text-[#8a7e6e] text-xl cursor-pointer">
            &times;
          </button>
        </div>

        {loading && <p className="text-sm text-[#5a5044] text-center py-8">Loading subscriptions...</p>}
        {error && <p className="text-sm text-red-400 text-center py-4">{error}</p>}

        {!loading && !error && subs.length === 0 && (
          <p className="text-sm text-[#5a5044] text-center py-8">
            All your subscriptions are already imported!
          </p>
        )}

        {!loading && !error && subs.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter..."
                className="flex-1 px-3 py-2 rounded-lg bg-[#0e0c0a] border border-[#3a332a] focus:outline-none focus:border-[#a08860] text-[#c4b5a0] placeholder-[#5a5044] text-sm"
              />
              <button onClick={selectAll} className="text-xs text-[#8a7e6e] hover:text-[#c4b5a0] cursor-pointer whitespace-nowrap">All</button>
              <button onClick={selectNone} className="text-xs text-[#8a7e6e] hover:text-[#c4b5a0] cursor-pointer whitespace-nowrap">None</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {filtered.map((sub) => {
                const selected = assignments.has(sub.handle);
                const profileId = assignments.get(sub.handle);
                return (
                  <div
                    key={sub.channelId}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selected ? "bg-[#302a22]" : "bg-[#1c1714] opacity-50"
                    }`}
                    onClick={() => toggleChannel(sub.handle)}
                  >
                    <img src={sub.thumbnail} alt="" className="w-8 h-8 rounded-full shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#c4b5a0] truncate">{sub.title}</p>
                      <p className="text-xs text-[#5a5044]">@{sub.handle}</p>
                    </div>
                    {selected && profiles.length > 1 && (
                      <select
                        value={profileId}
                        onChange={(e) => { e.stopPropagation(); setProfile(sub.handle, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 rounded bg-[#1c1714] border border-[#3a332a] text-xs text-[#c4b5a0] cursor-pointer"
                      >
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => onImport(assignments)}
              disabled={assignments.size === 0}
              className="w-full py-2 rounded-lg bg-[#7a6a50] hover:bg-[#8a7a60] text-[#1c1714] font-medium cursor-pointer disabled:opacity-50"
            >
              Import {assignments.size} channel{assignments.size !== 1 ? "s" : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
