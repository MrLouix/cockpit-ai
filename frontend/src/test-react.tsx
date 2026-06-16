import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const qc = new QueryClient();

function SimpleApp() {
  const [status, setStatus] = React.useState('loading');

  React.useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setStatus('Health OK: ' + JSON.stringify(data));
      })
      .catch(err => {
        setStatus('Error: ' + err.message);
      });

    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => {
        console.log('Sessions:', data);
        if (data.sessions) {
          setStatus(s => s + ' | Sessions: ' + JSON.stringify(data.sessions));
        } else {
          setStatus(s => s + ' | Sessions (array): ' + JSON.stringify(data));
        }
      })
      .catch(err => {
        console.error('Sessions error:', err);
      });

    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => {
        console.log('Tasks:', data);
        if (data.tasks) {
          setStatus(s => s + ' | Tasks: ' + JSON.stringify(data.tasks));
        } else {
          setStatus(s => s + ' | Tasks (array): ' + JSON.stringify(data));
        }
      })
      .catch(err => {
        console.error('Tasks error:', err);
      });
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">cockpitAI - Test React</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600 mb-2">Status: {status}</p>
        <div class="flex gap-4 mt-4">
          <button className="bg-blue-600 text-white rounded px-4 py-2">Tableau</button>
          <button className="bg-gray-200 text-gray-700 rounded px-4 py-2">Cartes</button>
        </div>
      </div>
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <QueryClientProvider client={qc}>
        <SimpleApp />
      </QueryClientProvider>
    </React.StrictMode>
  );
  console.log('React mounted successfully');
} else {
  console.error('Element #root not found!');
}
