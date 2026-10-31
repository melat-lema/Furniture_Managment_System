import { useEffect, useState } from 'react';
import { api } from './lib/api';

export default function App() {
  const [status, setStatus] = useState('Checking...');

  useEffect(() => {
    api
      .get('/health')
      .then(() => setStatus('Frontend, backend and database are connected'))
      .catch(() => setStatus('Cannot reach the backend'));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100">
      <h1 className="rounded-lg bg-white p-6 text-xl font-semibold shadow">
        {status}
      </h1>
    </div>
  );
}