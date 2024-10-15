"use client";
import React, { useState } from "react";
import { Menu, Home, MessageSquare, Twitter, DollarSign } from "lucide-react";
import Link from "next/link";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="relative">
      <div className="flex justify-between items-center p-4 bg-gray-800">
        <div className="flex items-center">
          <button onClick={toggleMenu} className="z-50 relative">
            <span className="sr-only">Toggle menu</span>
            <div className="w-6 h-6 flex items-center justify-center">
              <span
                className={`block absolute h-0.5 w-5 bg-white transform transition duration-300 ease-in-out ${
                  isMenuOpen ? "rotate-45 translate-y-0" : "-translate-y-1.5"
                }`}
              ></span>
              <span
                className={`block absolute h-0.5 w-5 bg-white transform transition duration-300 ease-in-out ${
                  isMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              ></span>
              <span
                className={`block absolute h-0.5 w-5 bg-white transform transition duration-300 ease-in-out ${
                  isMenuOpen ? "-rotate-45 translate-y-0" : "translate-y-1.5"
                }`}
              ></span>
            </div>
          </button>
          <Link href="/" className="flex items-center">
            <h1 className="text-xl font-bold ml-4 text-white">
              Tube <span className="text-red-500">▶</span> Sync
            </h1>
          </Link>
        </div>
        <div>
          <button className="hidden md:inline bg-blue-600 text-white px-4 py-2 rounded mr-2">
            Contact Us
          </button>
          <button className="hidden md:inline bg-gray-700 text-white px-4 py-2 rounded">
            LinkedIn
          </button>
        </div>
      </div>

      {/* Sliding Menu */}
      {isMenuOpen && (
        <div className="absolute top-0 left-0 w-64 h-full bg-gray-900 shadow-lg transition-transform transform translate-x-0">
          <nav className="mt-16 px-4">
            <ul>
              <li className="mb-6">
                <Link href="/" className="flex items-center text-white">
                  <Home className="mr-3" />
                  Start
                </Link>
              </li>
              <li className="mb-6">
                <Link href="/discord" className="flex items-center text-white">
                  <MessageSquare className="mr-3" />
                  Discord
                </Link>
              </li>
              <li className="mb-6">
                <Link href="/twitter" className="flex items-center text-white">
                  <Twitter className="mr-3" />
                  Twitter
                </Link>
              </li>
              <li className="mb-6">
                <Link href="/patreon" className="flex items-center text-white">
                  <DollarSign className="mr-3" />
                  Patreon
                </Link>
              </li>
              <li className="mb-6">
                <Link href="/contact" className="text-white">
                  Contact
                </Link>
              </li>
              <li className="mb-6">
                <Link href="/terms" className="text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-white">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
