import { useEffect, useRef, useState, useId, cloneElement } from "react";
import { X, LoaderCircle } from "lucide-react";

export function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
export function ErrorMessage({ children }) {
  return children ? (
    <div
      role="alert"
      className="rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 p-4 my-3"
    >
      {children}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div
      role="status"
      className="flex justify-center items-center gap-3 py-16 text-slate-500"
    >
      <LoaderCircle className="animate-spin w-5 h-5" />
      Loading station data…
    </div>
  );
}
export function ResourceState({ resource, children }) {
  if (resource.loading) return <Loading />;
  if (resource.error)
    return (
      <div>
        <ErrorMessage>{resource.error}</ErrorMessage>
        <button className="btn-secondary" onClick={resource.reload}>
          Try again
        </button>
      </div>
    );
  return children;
}
export function Empty({ children }) {
  return <p className="p-10 text-center text-slate-500">{children}</p>;
}
export function Field({ label, children, hint }) {
  const id = useId();
  return (
    <div className="space-y-1.5 text-sm">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-describedby": hint ? `${id}-hint` : undefined,
      })}
      {hint && (
        <span id={`${id}-hint`} className="block text-slate-500 font-normal">
          {hint}
        </span>
      )}
    </div>
  );
}
export function Pagination({ total, page, limit = 20, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-200 dark:border-slate-700 text-sm">
      <span className="text-slate-500">
        {total
          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`
          : "0 records"}
      </span>
      <div className="flex items-center gap-3">
        <button
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          className="btn-secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const onCancel = (e) => {
      e.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-2xl backdrop:bg-slate-950/50"
    >
      <div className="p-5 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
        <h2 id="modal-title" className="text-lg font-semibold">
          {title}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-5 max-h-[75dvh] overflow-y-auto">{children}</div>
    </dialog>
  );
}
export function SaveForm({ onSubmit, children, label = "Save changes" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        setBusy(true);
        setError("");
        try {
          await onSubmit(Object.fromEntries(new FormData(form)));
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        {children}
      </fieldset>
      <ErrorMessage>{error}</ErrorMessage>
      <button disabled={busy} className="btn-primary w-full" type="submit">
        {busy ? "Saving…" : label}
      </button>
    </form>
  );
}
const statusLabels = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
export function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      {statusLabels[status]}
    </span>
  );
}
