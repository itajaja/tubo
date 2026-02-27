import { useState } from "react";
import { setApiKey } from "./youtube";

export default function ApiKeyPrompt({ onSave }: { onSave: () => void }) {
  const [key, setKey] = useState("");
  return (
    <div className="flex items-center justify-center h-screen bg-[#1c1714] text-[#c4b5a0]">
      <div className="max-w-md w-full p-5 md:p-8 space-y-4 bg-[#252019] rounded-2xl border border-[#3a332a] mx-4">
        <h1 className="text-2xl font-bold text-[#d4c5b0]">Tubo</h1>
        <p className="text-sm text-[#8a7e6e]">
          Enter your YouTube Data API v3 key. You can get one for free from the{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="underline text-[#a08860]"
          >
            Google Cloud Console
          </a>
          . Enable the &quot;YouTube Data API v3&quot; for your project.
        </p>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza..."
          className="w-full px-3 py-2 rounded-lg bg-[#0e0c0a] border border-[#3a332a] focus:outline-none focus:border-[#a08860] text-[#c4b5a0] placeholder-[#5a5044]"
        />
        <button
          onClick={() => {
            if (key.trim()) {
              setApiKey(key.trim());
              onSave();
            }
          }}
          className="w-full py-2 rounded-lg bg-[#7a6a50] hover:bg-[#8a7a60] text-[#1c1714] font-medium cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}
