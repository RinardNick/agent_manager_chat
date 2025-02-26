'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className="w-full border-b">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2 font-bold">
            Chat App
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/"
              className={`transition-colors hover:text-foreground/80 ${
                isActive('/')
                  ? 'text-foreground font-semibold'
                  : 'text-foreground/60'
              }`}
            >
              Home
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center space-x-2 justify-end">
          <p className="text-sm text-foreground/60">
            Status: <span className="text-green-600">MCP Tools Enabled</span>
          </p>
        </div>
      </div>
    </header>
  );
}
