"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { UQSearchResult } from "@/lib/uq/types";

interface SearchBarProps {
  onResults: (results: UQSearchResult[]) => void;
  placeholder?: string;
  type?: "all" | "program" | "course";
}

export function SearchBar({
  onResults,
  placeholder = "Search programs, courses, or course codes...",
  type = "all",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/uq/search?q=${encodeURIComponent(query)}&type=${type}`,
      );
      const data = await res.json();
      onResults(data.results ?? []);
    } catch {
      onResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-24 text-sm shadow-sm focus:border-[#51247a] focus:outline-none focus:ring-2 focus:ring-[#51247a]/20"
      />
      <button
        type="submit"
        disabled={loading}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[#51247a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#3d1a5c] disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
      </button>
    </form>
  );
}
