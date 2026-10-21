import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Users, BookOpen, Activity, Layers, Boxes, MessageSquareWarning, Trophy, Gauge } from 'lucide-react';
import { api, errMsg } from '../../api/client.js';
import { ConfidenceBar, EmptyState, PageLoader, StatCard, pct } from '../../components/ui.jsx';

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/admin/overview').then(({ data }) => setStats(data.stats)).catch((e) => setError(errMsg(e))); }, []);

  if (error) return <EmptyState title="Could not load overview">{error}</EmptyState>;
  if (!stats) return <PageLoader />;
  const { counts } = stats;
  const chart = stats.last7.map((d) => ({ ...d, day: new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short' }) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Users" value={counts.users} />
        <StatCard icon={Activity} label="Translations" value={counts.translations} tone="amber" hint={`Avg confidence ${pct(stats.avgConfidence)}`} />
        <StatCard icon={Layers} label="Sessions" value={counts.sessions} tone="sand" hint={`Avg inference ${stats.avgLatency.toFixed(1)} ms`} />
        <StatCard icon={Boxes} label="Active model" value={stats.activeModel?.version || '—'} tone="moss"
          hint={stats.activeModel ? `${stats.activeModel.numClasses} classes · val ${pct(stats.activeModel.valAccuracy)}` : 'Publish one in Model Studio'} />
        <StatCard icon={BookOpen} label="Dictionary signs" value={counts.signs} tone="sand" />
        <StatCard icon={Trophy} label="Signs mastered" value={counts.mastered} tone="moss" hint="Across all learners" />
        <StatCard icon={MessageSquareWarning} label="Open feedback" value={counts.openFeedback} tone={counts.openFeedback ? 'rust' : 'sand'} />
        <StatCard icon={Gauge} label="Model versions" value={counts.models} tone="sand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-5">
          <h2 className="text-base font-semibold">Translations · last 7 days</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} labelFormatter={(_, p) => p?.[0]?.payload?.date} />
                <Bar dataKey="count" name="Translations" fill="#0F766E" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="text-base font-semibold">Most translated signs</h2>
          {stats.topSigns.length === 0 ? <p className="mt-3 text-sm text-ink-mute">No data yet.</p> : (
            <ul className="mt-4 space-y-3">
              {stats.topSigns.map((s) => (
                <li key={s.word} className="flex items-center gap-3">
                  <span className="w-24 truncate font-semibold">{s.word}</span>
                  <div className="flex-1"><ConfidenceBar neutral value={s.count / stats.topSigns[0].count} /></div>
                  <span className="w-10 text-right font-mono text-xs text-ink-mute">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
          {stats.weakestSigns.length > 0 && (
            <div className="mt-6 border-t border-sand-200 pt-4">
              <p className="label">Needs more training data</p>
              <ul className="space-y-1 text-sm">
                {stats.weakestSigns.map((s) => <li key={s.word} className="flex justify-between"><span>{s.word}</span><span className="font-mono text-xs text-rust-600">{pct(s.avgConfidence)}</span></li>)}
              </ul>
              <Link to="../studio" className="btn-outline btn-sm mt-3">Open Model Studio</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
