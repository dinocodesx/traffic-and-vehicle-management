import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/home';
import Monitor from './pages/monitor';
import Traffic from './pages/traffic';

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-background font-sans antialiased">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/traffic" element={<Traffic />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
