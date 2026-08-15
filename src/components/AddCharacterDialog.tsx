"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import type {
  CharacterConnectionKind,
  CharacterSiblingSeniority,
  NewCharacterConnection,
  NewCharacterInput,
} from "@/data/in-memory-family-database";
import type { Person, PersonSex } from "@/types/family";

interface ConnectionRow {
  rowId: number;
  kind: CharacterConnectionKind;
  personId: string;
  seniority: CharacterSiblingSeniority;
  biological: boolean;
  married: boolean;
}

interface CharacterDialogProps {
  people: readonly Person[];
  character?: Person;
  initialConnections?: readonly NewCharacterConnection[];
  onSave: (input: NewCharacterInput) => void;
  onClose: () => void;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const CONNECTION_LABELS: Record<CharacterConnectionKind, string> = {
  parent: "Existing person is their parent",
  child: "They are parent of existing person",
  spouse: "Spouse of existing person",
  sibling: "Sibling of existing person",
};

function fullName(person: Person) {
  return `${person.firstName} ${person.surname}`;
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The selected image could not be read."));
    };
    reader.onerror = () =>
      reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

export function CharacterDialog({
  people,
  character,
  initialConnections = [],
  onSave,
  onClose,
}: CharacterDialogProps) {
  const isEditing = Boolean(character);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const nextRowId = useRef(initialConnections.length + 1);
  const [deceased, setDeceased] = useState(
    Boolean(character?.deceased || character?.dateOfDeath),
  );
  const [photoUrl, setPhotoUrl] = useState(character?.photoUrl ?? "");
  const [photoName, setPhotoName] = useState(
    character?.photoUrl ? "Current profile image" : "",
  );
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [error, setError] = useState<string>();
  const [connections, setConnections] = useState<ConnectionRow[]>(() => {
    if (initialConnections.length > 0) {
      return initialConnections.map((connection, index) => ({
        rowId: index,
        kind: connection.kind,
        personId: connection.personId,
        seniority: connection.seniority ?? "unknown",
        biological: connection.biological === true,
        married: connection.married === true,
      }));
    }

    return people.length > 0
      ? [
          {
            rowId: 0,
            kind: "parent",
            personId: "",
            seniority: "unknown",
            biological: false,
            married: false,
          },
        ]
      : [];
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function updateConnection(rowId: number, patch: Partial<ConnectionRow>) {
    setConnections((current) =>
      current.map((connection) =>
        connection.rowId === rowId ? { ...connection, ...patch } : connection,
      ),
    );
  }

  function addConnection() {
    setConnections((current) => [
      ...current,
      {
        rowId: nextRowId.current++,
        kind: "parent",
        personId: "",
        seniority: "unknown",
        biological: false,
        married: false,
      },
    ]);
  }

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError(undefined);
    if (!file.type.startsWith("image/")) {
      input.value = "";
      setError("Choose a valid image file.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      input.value = "";
      setError("The profile image must be 5 MB or smaller.");
      return;
    }

    setReadingPhoto(true);
    try {
      setPhotoUrl(await readImage(file));
      setPhotoName(file.name);
    } catch (cause) {
      input.value = "";
      setError(
        cause instanceof Error
          ? cause.message
          : "The selected image could not be read.",
      );
    } finally {
      setReadingPhoto(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = new FormData(event.currentTarget);
    const validConnections = connections
      .filter((connection) => connection.personId)
      .map(({ kind, personId, seniority, biological, married }) => ({
        kind,
        personId,
        seniority: kind === "sibling" ? seniority : undefined,
        biological:
          kind === "parent" || kind === "child" ? biological : undefined,
        married: kind === "spouse" ? married : undefined,
      }));

    if (people.length > 0 && validConnections.length === 0) {
      setError(
        "Connect this character to at least one existing family member.",
      );
      return;
    }

    try {
      onSave({
        firstName: String(form.get("firstName") ?? ""),
        surname: String(form.get("surname") ?? ""),
        sex: String(form.get("sex") ?? "") as PersonSex,
        dateOfBirth: String(form.get("dateOfBirth") ?? ""),
        dateOfDeath: deceased
          ? String(form.get("dateOfDeath") ?? "")
          : undefined,
        deceased,
        bio: String(form.get("bio") ?? ""),
        photoUrl,
        connections: validConnections,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The character could not be saved.",
      );
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="character-dialog-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-950/50"
      onCancel={onClose}
      onClose={onClose}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[calc(100vh-2rem)] flex-col"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2
              id="character-dialog-title"
              className="text-xl font-semibold text-slate-950"
            >
              {isEditing
                ? `Edit ${fullName(character!)}`
                : "Add a family member"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Personal details and family connections are used to calculate
              kinship.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close character dialog"
            className="rounded-full p-2 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-950"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          <section aria-labelledby="personal-details-title">
            <h3
              id="personal-details-title"
              className="font-semibold text-slate-900"
            >
              Personal details
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                First name
                <input
                  autoFocus
                  required
                  name="firstName"
                  autoComplete="given-name"
                  defaultValue={character?.firstName}
                  className={`${INPUT_CLASS} mt-1.5`}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Surname
                <input
                  required
                  name="surname"
                  autoComplete="family-name"
                  defaultValue={character?.surname}
                  className={`${INPUT_CLASS} mt-1.5`}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Sex used by the kinship rules
                <select
                  required
                  name="sex"
                  defaultValue={character?.sex ?? ""}
                  className={`${INPUT_CLASS} mt-1.5`}
                >
                  <option value="" disabled>
                    Select sex
                  </option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Date of birth
                <input
                  name="dateOfBirth"
                  type="date"
                  defaultValue={character?.dateOfBirth}
                  className={`${INPUT_CLASS} mt-1.5`}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Optional; helps infer sibling seniority.
                </span>
              </label>
            </div>

            <div className="mt-5">
              <span className="text-sm font-medium text-slate-700">
                Profile image
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt="Selected profile preview"
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div
                    aria-label="No profile image selected"
                    className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
                  >
                    No image
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      {photoUrl ? "Replace image" : "Choose image"}
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        aria-label="Choose profile image"
                        disabled={readingPhoto}
                        onChange={selectPhoto}
                        className="sr-only"
                      />
                    </label>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoUrl("");
                          setPhotoName("");
                          if (photoInputRef.current) {
                            photoInputRef.current.value = "";
                          }
                        }}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 max-w-sm text-xs text-slate-500">
                    {readingPhoto
                      ? "Reading image…"
                      : photoName || "Any image format, up to 5 MB."}
                  </p>
                </div>
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={deceased}
                onChange={(event) => setDeceased(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              This person is deceased
            </label>

            {deceased && (
              <label className="mt-3 block max-w-sm text-sm font-medium text-slate-700">
                Date of death
                <input
                  name="dateOfDeath"
                  type="date"
                  defaultValue={character?.dateOfDeath}
                  className={`${INPUT_CLASS} mt-1.5`}
                />
              </label>
            )}

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Notes or biography
              <textarea
                name="bio"
                rows={3}
                defaultValue={character?.bio}
                className={`${INPUT_CLASS} mt-1.5 resize-y`}
                placeholder="Optional context about this person"
              />
            </label>
          </section>

          <section
            aria-labelledby="family-connections-title"
            className="mt-7 border-t border-slate-200 pt-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3
                  id="family-connections-title"
                  className="font-semibold text-slate-900"
                >
                  Family connections
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Add every known parent, child, spouse, or sibling for accurate
                  traversal, then mark biological parenthood or marriage where
                  it applies.
                </p>
              </div>
              {people.length > 0 && (
                <button
                  type="button"
                  onClick={addConnection}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Add connection
                </button>
              )}
            </div>

            {people.length === 0 ? (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {isEditing
                  ? "This is currently the only member of the family tree."
                  : "This will be the first member of the family tree."}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {connections.map((connection, index) => (
                  <div
                    key={connection.rowId}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.25fr_1fr_auto]"
                  >
                    <label className="text-xs font-medium text-slate-600">
                      Relationship
                      <select
                        aria-label={`Connection ${index + 1} relationship`}
                        value={connection.kind}
                        onChange={(event) =>
                          updateConnection(connection.rowId, {
                            kind: event.target.value as CharacterConnectionKind,
                          })
                        }
                        className={`${INPUT_CLASS} mt-1`}
                      >
                        {Object.entries(CONNECTION_LABELS).map(
                          ([kind, label]) => (
                            <option key={kind} value={kind}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label className="text-xs font-medium text-slate-600">
                      Existing member
                      <select
                        aria-label={`Connection ${index + 1} family member`}
                        value={connection.personId}
                        onChange={(event) =>
                          updateConnection(connection.rowId, {
                            personId: event.target.value,
                          })
                        }
                        className={`${INPUT_CLASS} mt-1`}
                      >
                        <option value="">Select member</option>
                        {people.map((person) => (
                          <option key={person.id} value={person.id}>
                            {fullName(person)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      aria-label={`Remove connection ${index + 1}`}
                      onClick={() =>
                        setConnections((current) =>
                          current.filter(
                            (item) => item.rowId !== connection.rowId,
                          ),
                        )
                      }
                      className="self-end rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Remove
                    </button>

                    {connection.kind === "sibling" && (
                      <label className="text-xs font-medium text-slate-600 md:col-span-2">
                        Seniority
                        <select
                          aria-label={`Connection ${index + 1} sibling seniority`}
                          value={connection.seniority}
                          onChange={(event) =>
                            updateConnection(connection.rowId, {
                              seniority: event.target
                                .value as CharacterSiblingSeniority,
                            })
                          }
                          className={`${INPUT_CLASS} mt-1`}
                        >
                          <option value="unknown">
                            Unknown / infer from birth dates
                          </option>
                          <option value="new_older">New person is older</option>
                          <option value="existing_older">
                            Existing person is older
                          </option>
                        </select>
                      </label>
                    )}

                    {(connection.kind === "parent" ||
                      connection.kind === "child") && (
                      <label className="flex items-start gap-2 text-xs font-medium text-slate-700 md:col-span-2">
                        <input
                          type="checkbox"
                          aria-label={`Connection ${index + 1} is biological`}
                          checked={connection.biological}
                          onChange={(event) =>
                            updateConnection(connection.rowId, {
                              biological: event.target.checked,
                            })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span>
                          This is a biological parent-child relationship
                          <span className="mt-0.5 block font-normal text-slate-500">
                            Biological connections are drawn on the family tree
                            and consolidated when both biological parents are
                            recorded.
                          </span>
                        </span>
                      </label>
                    )}

                    {connection.kind === "spouse" && (
                      <label className="flex items-start gap-2 text-xs font-medium text-slate-700 md:col-span-2">
                        <input
                          type="checkbox"
                          aria-label={`Connection ${index + 1} spouses are married`}
                          checked={connection.married}
                          onChange={(event) =>
                            updateConnection(connection.rowId, {
                              married: event.target.checked,
                            })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span>
                          These spouses are married
                          <span className="mt-0.5 block font-normal text-slate-500">
                            Marriage is stored once and automatically applies in
                            both directions.
                          </span>
                        </span>
                      </label>
                    )}

                  </div>
                ))}
              </div>
            )}
          </section>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={readingPhoto}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
          >
            {isEditing ? "Save changes" : "Add to family tree"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
