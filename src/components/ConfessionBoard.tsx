"use client";

import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../../lib/supabase";

interface Confession {
  id: string;
  content: string;
  created_at: string;
  likes?: number;
}

interface Props {
  initialConfessions: Confession[];
}

export default function ConfessionBoard({ initialConfessions }: Props) {
  const [confessions, setConfessions] = useState<Confession[]>(
    initialConfessions
  );
  const [newConfession, setNewConfession] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Load liked ids from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('likedConfessions');
    if (raw) {
      try {
        const arr: string[] = JSON.parse(raw);
        setLikedIds(new Set(arr));
      } catch {}
    }
  }, []);

  // Listen for realtime INSERT events
  useEffect(() => {
    const channel = supabase
      .channel("public:confessions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "confessions" },
        (payload) => {
          const confession = payload.new as Confession;
          setConfessions((prev) => [confession, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle new confession submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const content = newConfession.trim();
    if (!content) return;

    setPosting(true);
    const { error } = await supabase
      .from("confessions")
      .insert({ content });

    if (error) {
      console.error("Failed to post confession", error);
    } else {
      setNewConfession("");
    }
    setPosting(false);
  };

  const handleLike = async (id: string) => {
    if (likedIds.has(id)) return;
    const current = confessions.find((c) => c.id === id)?.likes ?? 0;

    // Optimistic UI update
    setConfessions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, likes: current + 1 } : c))
    );

    const { error } = await supabase
      .from('confessions')
      .update({ likes: current + 1 })
      .eq('id', id);

    if (error) {
      console.error('Failed to like confession', error);
      // rollback UI
      setConfessions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, likes: current } : c))
      );
      return;
    }

    setLikedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('likedConfessions', JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };


  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-2xl mx-auto py-8">
        <h1 className="text-4xl font-bold text-center mb-8">AnonBoard</h1>

        {/* Compose */}
        <form
          onSubmit={handleSubmit}
          className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md"
        >
          <textarea
            className="w-full p-3 mb-4 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Share your anonymous confession..."
            value={newConfession}
            onChange={(e) => setNewConfession(e.target.value)}
            disabled={posting}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out disabled:opacity-50"
            disabled={posting}
          >
            {posting ? "Posting..." : "Post Confession"}
          </button>
        </form>

        {/* Feed */}
        <div className="space-y-4">
          {confessions.length === 0 && (
            <p className="text-center text-gray-600 dark:text-gray-400">
              No confessions yet. Be the first!
            </p>
          )}
          {confessions.map((c) => (
            <div
              key={c.id}
              className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md"
            >
              <p className="text-lg mb-2 break-words">{c.content}</p>
              <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <span>{new Date(c.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <button
                  onClick={() => handleLike(c.id)}
                  disabled={likedIds.has(c.id)}
                  className={`flex items-center space-x-1 transition duration-300 ease-in-out ${likedIds.has(c.id) ? 'text-red-400 cursor-not-allowed' : 'text-red-500 hover:text-red-600'}`}
                >
                  <span>❤️</span>
                  <span>{c.likes ?? 0}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
