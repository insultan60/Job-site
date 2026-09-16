"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCustomTemplates,
  saveCustomTemplates,
  newTemplateId,
} from "@/lib/messageTemplates";
import {
  ADMIN_EMAIL_TEMPLATES,
  CTA_DESTINATIONS,
  TEMPLATE_LIMITS,
  fillTemplate,
  type CustomTemplate,
} from "@/lib/adminEmailTemplates";
import { Loader } from "@/components/Loader";
import { LoadError, errorMessage } from "@/components/admin/LoadError";
import { BroadcastComposer } from "@/components/admin/BroadcastComposer";

/* Write your own message templates.
 *
 * The built-in set is fixed — the product refers to those by name elsewhere,
 * and a half-deleted set is worse than a small one. Anything you want to
 * change, you add alongside; both appear in the same picker when messaging a
 * recruiter.
 *
 * The whole list is saved at once, the same way the board filters work, so
 * you can add, edit and reorder freely and commit it in one go.
 */
export default function MessageTemplatesPage() {
  const [items, setItems] = useState<CustomTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return listCustomTemplates()
      .then((t) => {
        setItems(t);
        setDirty(false);
      })
      .catch((err) => setError(errorMessage(err, "The server did not respond. Please try again.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(id: string, patch: Partial<CustomTemplate>) {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDirty(true);
    setNotice(null);
  }

  function add() {
    const t: CustomTemplate = {
      id: newTemplateId(),
      label: "New template",
      hint: "",
      subject: "",
      body: "Hi {name},\n\n",
      ctaPath: "",
    };
    setItems((list) => [...list, t]);
    setOpenId(t.id);
    setDirty(true);
    setNotice(null);
  }

  function remove(id: string) {
    setItems((list) => list.filter((t) => t.id !== id));
    if (openId === id) setOpenId(null);
    setDirty(true);
    setNotice(null);
  }

  function move(id: string, dir: -1 | 1) {
    setItems((list) => {
      const i = list.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }

  async function save() {
    // The server enforces these too; catching them here just saves a round
    // trip and points at the offending template by name.
    const bad = items.find((t) => !t.label.trim() || !t.subject.trim() || !t.body.trim());
    if (bad) {
      setError(`"${bad.label || "Untitled"}" needs a name, a subject and a message.`);
      setOpenId(bad.id);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveCustomTemplates(items);
      setDirty(false);
      setNotice(`Saved. ${items.length} custom template${items.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(errorMessage(err, "Could not save. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow uppercase">Messaging</p>
          <h1 className="mt-1.5 text-xl font-extrabold tracking-tight text-ink">
            Message templates
          </h1>
          <p className="mt-1 max-w-xl text-xs text-muted">
            Starting points for messaging recruiters. Send one to a whole group below, or
            load it into the compose box on a recruiter&apos;s page. Either way you edit
            before sending, so a template never has to fit perfectly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={add}
            disabled={items.length >= TEMPLATE_LIMITS.count}
            className="rounded-pill border border-line px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            + New template
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-pill bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <BroadcastComposer />
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-sage/40 bg-sage-soft/40 px-4 py-3 text-sm text-ink">
          {notice}
        </div>
      )}
      {error && <LoadError what="templates" message={error} onRetry={load} />}

      {loading ? (
        <div className="grid h-48 place-items-center rounded-2xl border border-line bg-white">
          <Loader />
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((t, i) => (
              <li key={t.id} className="rounded-xl border border-line bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === t.id ? null : t.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {t.label || "Untitled"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {t.subject || <span className="text-coral">No subject yet</span>}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn label="Move up" onClick={() => move(t.id, -1)} disabled={i === 0}>
                      <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </IconBtn>
                    <IconBtn label="Move down" onClick={() => move(t.id, 1)} disabled={i === items.length - 1}>
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </IconBtn>
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === t.id ? null : t.id)}
                      className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
                    >
                      {openId === t.id ? "Done" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-coral hover:text-coral"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {openId === t.id && (
                  <div className="border-t border-line p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name" hint="Only you see this — it's the picker label.">
                        <input
                          value={t.label}
                          onChange={(e) => update(t.id, { label: e.target.value })}
                          maxLength={TEMPLATE_LIMITS.label}
                          className="input h-9 text-sm"
                        />
                      </Field>
                      <Field label="Note" hint="Shown under the picker, to tell similar ones apart.">
                        <input
                          value={t.hint}
                          onChange={(e) => update(t.id, { hint: e.target.value })}
                          maxLength={TEMPLATE_LIMITS.hint}
                          className="input h-9 text-sm"
                        />
                      </Field>
                    </div>

                    <Field label="Subject" className="mt-3">
                      <input
                        value={t.subject}
                        onChange={(e) => update(t.id, { subject: e.target.value })}
                        maxLength={TEMPLATE_LIMITS.subject}
                        className="input h-9 text-sm"
                      />
                    </Field>

                    <Field
                      label="Message"
                      hint="Write {name} where the recruiter's name should go."
                      className="mt-3"
                    >
                      <textarea
                        value={t.body}
                        onChange={(e) => update(t.id, { body: e.target.value })}
                        maxLength={TEMPLATE_LIMITS.body}
                        className="input min-h-44 resize-y text-sm"
                      />
                    </Field>

                    <Field
                      label="Button"
                      hint="A fixed list of pages in the recruiter's dashboard — so a template can't send anyone off the platform."
                      className="mt-3"
                    >
                      <select
                        value={t.ctaPath}
                        onChange={(e) => update(t.id, { ctaPath: e.target.value })}
                        className="input h-9 text-sm"
                      >
                        {CTA_DESTINATIONS.map((d) => (
                          <option key={d.path || "none"} value={d.path}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="mt-4 rounded-lg border border-line bg-cream/40 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Preview — as a recruiter called Jordan sees it
                      </p>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        {fillTemplate(t.subject, "Jordan") || "(no subject)"}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                        {fillTemplate(t.body, "Jordan") || "(no message)"}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
              <h2 className="font-bold text-ink">No templates of your own yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                The {ADMIN_EMAIL_TEMPLATES.length} built-in ones below are always available.
                Add your own for anything you send often.
              </p>
            </div>
          )}

          <section className="mt-10 border-t border-line pt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
              Built in ({ADMIN_EMAIL_TEMPLATES.length})
            </h2>
            <p className="mt-1 text-xs text-muted">
              Always available, and not editable — the product refers to these by name.
              To change one, add your own version above.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {ADMIN_EMAIL_TEMPLATES.map((t) => (
                <li key={t.id} className="rounded-lg border border-line bg-white px-3.5 py-2.5">
                  <p className="text-sm font-semibold text-ink">{t.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{t.hint}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-ink/25 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
