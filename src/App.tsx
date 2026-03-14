/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import Series from "./pages/Series";
import Detail from "./pages/Detail";
import Watch from "./pages/Watch";
import Search from "./pages/Search";
import Genres from "./pages/Genres";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} className="min-h-screen">
        <Routes location={location}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="movies" element={<Movies />} />
            <Route path="series" element={<Series />} />
            <Route path="genres" element={<Genres />} />
            <Route path="movie/:slug" element={<Detail />} />
            <Route path="watch/:slug" element={<Watch />} />
            <Route path="search" element={<Search />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="history" element={<History />} />
            <Route path="terms" element={<Terms />} />
            <Route path="login" element={<Login />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <FavoritesProvider>
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </FavoritesProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
