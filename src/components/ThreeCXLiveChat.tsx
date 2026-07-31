'use client';

// Hosted 3CX "Call Us" chat page for this PBX (party "LiveChat854959").
// Linking out to it avoids embedding the call-us-selector widget, whose
// cross-origin config fetches to nibbank.3cx.sc are blocked by CORS until
// this app's origin is whitelisted in the 3CX admin console.
const CHAT_URL = 'https://callcenter.nibbank.com.et/callus/#LiveChat854959';

export default function ThreeCXLiveChat() {
  const openChat = () => {
    window.open(CHAT_URL, 'nib-live-chat', 'width=420,height=640');
  };

  return (
    <button
      type="button"
      onClick={openChat}
      aria-label="Chat with us"
      className="absolute bottom-16 right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#D63004] text-white shadow-lg transition-transform hover:scale-105"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4.4 3.3A1 1 0 0 1 2 19.5V5a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
