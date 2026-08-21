interface ErrorNotificationToastProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorNotificationToast({
  message,
  onDismiss,
}: ErrorNotificationToastProps) {
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed bottom-5 left-5 z-50 w-[min(24rem,calc(100vw-2.5rem))]"
    >
      <div
        role="alert"
        className="pointer-events-auto flex items-start gap-3 rounded-xl border border-rose-200 bg-white p-4 text-rose-950 shadow-xl"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 font-bold text-rose-700"
        >
          !
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5 text-sm leading-5 text-rose-800">{message}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss error notification"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-rose-500 hover:bg-rose-50 hover:text-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          ×
        </button>
      </div>
    </div>
  );
}
