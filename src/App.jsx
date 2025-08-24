import { Routes, Route } from "react-router-dom";
import SplashPage from './pages/SplashPage.jsx';
import StartBlendPage from "./pages/StartBlendPage.jsx";
import JoinBlendPage from "./pages/JoinBlendPage.jsx";
import ScrapingPage from "./pages/ScrapingPage.jsx";
import BlendResultsPage from "./pages/BlendResultsPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route path="/start-blend" element={<StartBlendPage />} />
      <Route path="/blend/:blendId" element={<JoinBlendPage />} />
      <Route path="/blend/:blendId/scraping" element={<ScrapingPage />} />
      <Route path="/blend/:blendId/results" element={<BlendResultsPage />} />
    </Routes>
  );
}