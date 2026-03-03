import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { scenarios } from './index';

function App() {
  const [hash, setHash] = useState(window.location.hash.slice(1) || '');

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash.slice(1) || '');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (!hash) {
    return (
      <div style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <h1>Visual Test Scenarios</h1>
        <p>{scenarios.length} scenarios available</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {scenarios.map((s) => (
            <li key={s.id} style={{ margin: '4px 0' }}>
              <a href={`#${s.id}`} style={{ color: '#0066cc' }}>
                {s.id}
              </a>{' '}
              — {s.description}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const scenario = scenarios.find((s) => s.id === hash);
  if (!scenario) {
    return (
      <div style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <h1>Unknown scenario: {hash}</h1>
        <a href="#">← Back to list</a>
      </div>
    );
  }

  const Component = scenario.component;
  return (
    <div data-scenario={scenario.id}>
      <Component />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
