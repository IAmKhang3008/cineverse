/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import Layout from "./components/Layout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import ScrollToTop from "./components/ScrollToTop";

const Home = React.lazy(() => import("./pages/Home"));
const Movies = React.lazy(() => import("./pages/Movies"));
const Series = React.lazy(() => import("./pages/Series"));
const Detail = React.lazy(() => import("./pages/Detail"));
const Watch = React.lazy(() => import("./pages/Watch"));
const Search = React.lazy(() => import("./pages/Search"));
const Genres = React.lazy(() => import("./pages/Genres"));
const Favorites = React.lazy(() => import("./pages/Favorites"));
const History = React.lazy(() => import("./pages/History"));
const Terms = React.lazy(() => import("./pages/Terms"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Login = React.lazy(() => import("./pages/Login"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Settings = React.lazy(() => import("./pages/Settings"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-10 h-10 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} className="min-h-screen">
        <Routes location={location}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Suspense fallback={<LoadingFallback />}><Home /></Suspense>} />
            <Route path="movies" element={<Suspense fallback={<LoadingFallback />}><Movies /></Suspense>} />
            <Route path="series" element={<Suspense fallback={<LoadingFallback />}><Series /></Suspense>} />
            <Route path="genres" element={<Suspense fallback={<LoadingFallback />}><Genres /></Suspense>} />
            <Route path="movie/:slug" element={<Suspense fallback={<LoadingFallback />}><Detail /></Suspense>} />
            <Route path="watch/:slug" element={<Suspense fallback={<LoadingFallback />}><Watch /></Suspense>} />
            <Route path="search" element={<Suspense fallback={<LoadingFallback />}><Search /></Suspense>} />
            <Route path="favorites" element={<Suspense fallback={<LoadingFallback />}><Favorites /></Suspense>} />
            <Route path="history" element={<Suspense fallback={<LoadingFallback />}><History /></Suspense>} />
            <Route path="terms" element={<Suspense fallback={<LoadingFallback />}><Terms /></Suspense>} />
            <Route path="login" element={<Suspense fallback={<LoadingFallback />}><Login /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<LoadingFallback />}><Profile /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<LoadingFallback />}><Settings /></Suspense>} />
            <Route path="*" element={<Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>} />
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
            <ScrollToTop />
            <AnimatedRoutes />
          </BrowserRouter>
        </FavoritesProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
