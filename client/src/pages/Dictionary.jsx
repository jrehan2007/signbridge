import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, GraduationCap, Hand, BookOpen, CheckCircle2 } from 'lucide-react';
import { api, errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, EmptyState, Modal, PageHeader, PageLoader, Tabs, cx } from '../components/ui.jsx';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'alphabet', label: 'Alphabet' },
  { key: 'digit', label: 'Numbers' },
  { key: 'word', label: 'Words' },
  { key: 'phrase', label: 'Phrases' },
];

// Channel search returns nothing for single letters/numbers, so use a regular YouTube search.
export const islrtcLink = (word) => {
  const term = /^\d+$/.test(word) ? `number ${word}` : word.length === 1 ? `letter ${word}` : word;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`ISLRTC Indian Sign Language ${term}`)}`;
};

export default function Dictionary() {
  const { user } = useAuth();
  const [signs, setSigns] = useState([]);
  const [modelLabels, setModelLabels] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/signs', { params: { limit: 500 } }), api.get('/models/active')])
      .then(([s, m]) => {
        setSigns(s.data.items);
        setModelLabels(new Set(m.data.model?.classLabels || []));
      })
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return signs.filter((s) => (tab === 'all' || s.category === tab) && (!needle || s.word.toLowerCase().includes(needle) || s.description?.toLowerCase().includes(needle)));
  }, [signs, q, tab]);

  return (
    <div className="container-x py-10">
      <PageHeader eyebrow="ISL dictionary" title="Explore the signs" subtitle="Browse the vocabulary the portal understands. Each sign links to the official ISLRTC reference video." />

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Tabs items={TABS} value={tab} onChange={setTab} label="Category" />
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Search signs…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search signs" />
        </div>
      </div>

      {loading ? <PageLoader /> : error ? <EmptyState icon={BookOpen} title="Could not load the dictionary">{error}</EmptyState> : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No signs found">Try a different search or category.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {filtered.map((s) => (
            <li key={s._id}>
              <button type="button" onClick={() => setSelected(s)} className="card group flex h-full w-full flex-col p-4 text-left transition hover:border-teal-500/40 hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <span className={cx('font-bold tracking-tight text-ink group-hover:text-teal-700', s.word.length <= 2 ? 'text-4xl' : 'text-lg')}>{s.word}</span>
                  {modelLabels.has(s.word) && <CheckCircle2 className="h-4 w-4 text-moss-500" aria-label="Recognised by the current model" />}
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                  <Badge tone="sand" className="capitalize">{s.category}</Badge>
                  <Badge tone={s.handType === 'two' ? 'amber' : 'teal'}><Hand className="h-3 w-3" />{s.handType === 'two' ? '2 hands' : '1 hand'}</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.word || ''}
        footer={selected && (
          <>
            <a href={islrtcLink(selected.word)} target="_blank" rel="noreferrer" className="btn-outline"><ExternalLink className="h-4 w-4" /> ISLRTC video</a>
            {user && <Link to={`/learn/${selected._id}`} className="btn-primary"><GraduationCap className="h-4 w-4" /> Practise</Link>}
          </>
        )}>
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="sand" className="capitalize">{selected.category}</Badge>
              <Badge tone={selected.handType === 'two' ? 'amber' : 'teal'}>{selected.handType === 'two' ? 'Two-handed' : 'One-handed'}</Badge>
              <Badge tone="sand" className="capitalize">{selected.gestureType}</Badge>
              {modelLabels.has(selected.word)
                ? <Badge tone="moss">Recognised by current model</Badge>
                : <Badge tone="rust">Not in current model</Badge>}
            </div>
            {selected.mediaUrl && /\.(mp4|webm)$/i.test(selected.mediaUrl) && (
              <video src={selected.mediaUrl} controls loop muted className="w-full rounded-xl bg-ink" />
            )}
            <p className="leading-7 text-ink-soft">{selected.description}</p>
            {selected.howTo?.length > 0 && (
              <div>
                <p className="label">How to sign it for the camera</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
                  {selected.howTo.map((h) => <li key={h}>{h}</li>)}
                </ol>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
