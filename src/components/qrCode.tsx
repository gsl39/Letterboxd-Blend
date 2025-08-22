import { useState } from "react";
import QRCode from "react-qr-code";

export default function QRCodeDisplay({ blendId }) {
    const url = `${window.location.origin}/blend/${blendId}`;
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="
          p-8
          rounded-2xl 
          bg-white/60
          backdrop-blur-md
          shadow-xl
          border border-white/30
          flex flex-col items-center
        ">
          <QRCode value={url} size={200} bgColor="transparent" />
          <div className="mt-4 flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="ml-2 px-4 py-2 rounded bg-blue-500 text-white font-manrope text-sm hover:bg-blue-600 transition"
              type="button"
            >
              Share With A Friend!
            </button>
          </div>
          {copied && (
            <div className="mt-3 text-green-600 text-sm font-manrope"> Link Copied!</div>
          )}
        </div>
      </div>
    );
  }