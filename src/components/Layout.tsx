import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col overflow-x-hidden">
      <Header />
      <main key={location.pathname} className="flex-grow pt-16 page-transition">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
