import { useState } from "react";
import React from 'react';

export default function EmailSignup({ onSubmit, label = "Enter your Letterboxd handle." }) {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!handle.trim()) {
      setError("Please enter your Letterboxd handle.");
      return;
    }
    if (onSubmit) await onSubmit(handle);
    setHandle("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col items-center justify-center min-h-screen">
      <div className="flex flex-col items-start" style={{ minWidth: 0 }}>
        <label
          htmlFor="handle"
          className="mb-6 text-4xl font-manrope text-gray-900 text-left whitespace-nowrap"
        >
          {label}
        </label>
        <input
          id="handle"
          type="text"
          value={handle}
          onChange={e => setHandle(e.target.value)}
          placeholder="e.g. letterboxd_user"
          className="border-0 border-b-2 border-gray-400 focus:border-gray-500 outline-none text-lg bg-transparent transition w-full max-w-md"
          autoComplete="off"
        />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    </form>
  );
} 