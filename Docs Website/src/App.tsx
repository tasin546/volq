import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import DocsLayout from './components/DocsLayout';
import DocsIntroduction from './pages/docs/Introduction';
import DocsInstallation from './pages/docs/Installation';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<DocsIntroduction />} />
        <Route path="installation" element={<DocsInstallation />} />
        <Route path="*" element={
          <div>
            <h1>Coming Soon</h1>
            <p>This documentation page is currently being written.</p>
          </div>
        } />
      </Route>
    </Routes>
  );
}

export default App;
