import { Link } from 'react-router-dom';
import { ArrowLeft, Hand } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-teal-50 p-4 text-teal-600 ring-8 ring-teal-50/50"><Hand className="h-7 w-7" /></div>
      <p className="mt-6 font-mono text-sm font-semibold text-teal-600">404</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-ink-mute">The page you’re looking for doesn’t exist or may have been moved.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to="/" className="btn-primary"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
        <Link to="/translate" className="btn-outline">Open the translator</Link>
      </div>
    </div>
  );
}
