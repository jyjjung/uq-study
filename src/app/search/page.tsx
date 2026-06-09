"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, BookOpen } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import type { UQSearchResult } from "@/lib/uq/types";

export default function SearchPage() {
  const [results, setResults] = useState<UQSearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleResults = (r: UQSearchResult[]) => {
    setResults(r);
    setSearched(true);
  };

  const programs = results.filter((r) => r.type === "program");
  const courses = results.filter((r) => r.type === "course");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search UQ Catalogue</h1>
        <p className="mt-1 text-gray-600">
          Find bachelor programs, courses, and course codes from the official UQ
          Programs & Courses website.
        </p>
      </div>

      <SearchBar onResults={handleResults} />

      {searched && results.length === 0 && (
        <p className="text-center text-gray-500">No results found. Try different keywords.</p>
      )}

      {programs.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <GraduationCap className="h-5 w-5 text-[#51247a]" />
            Programs ({programs.length})
          </h2>
          <div className="space-y-2">
            {programs.map((p) => (
              <Link
                key={p.id}
                href={`/program/${p.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-[#51247a]/30"
              >
                <p className="font-medium text-gray-900">{p.title}</p>
                <p className="text-sm text-gray-500">Program ID: {p.id}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {courses.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5 text-[#51247a]" />
            Courses ({courses.length})
          </h2>
          <div className="space-y-2">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/course/${c.code ?? c.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-[#51247a]/30"
              >
                <p className="font-medium text-gray-900">
                  {c.code} — {c.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
