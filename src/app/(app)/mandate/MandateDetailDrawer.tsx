"use client";

/**
 * The delegation-detail drawer - ported from assets/detail.js. Shared by the
 * register table and the "Who may do what" screen (both open the same
 * drawer for a clicked entry), so it lives in its own file instead of being
 * duplicated.
 */
import { useRouter } from "next/navigation";
import type { MandateEntry, MandateOrg, AuthorityMap } from "@/lib/data/mandate-shared";
import { alignment, postCodes, legislationOf, ALIGN_LABEL } from "@/lib/data/mandate-shared";

export function Step({ ids, note, authorities }: { ids: string[]; note: string | null; authorities: AuthorityMap }) {
  const names = ids
    .map((id) => {
      const a = authorities.get(id);
      return a ? a.name + (a.short ? ` (${a.short})` : "") : null;
    })
    .filter((x): x is string => !!x);
  return (
    <div className="dchain">
      {note && names.length > 0 && <span className="lead">{note}: </span>}
      {note && names.length === 0 && <span className="free">{note}</span>}
      {names.length > 0 && <span>{names.join("; ")}</span>}
      {names.length === 0 && !note && <span className="muted">None</span>}
    </div>
  );
}

export function DRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="drow">
      <div className="dk">{label}</div>
      <div className="dv">{children}</div>
    </div>
  );
}

export function DetailDrawer({
  entry: e,
  org,
  authorities,
  onClose,
  canPropose,
}: {
  entry: MandateEntry;
  org: MandateOrg;
  authorities: AuthorityMap;
  onClose: () => void;
  /** Shows a "Propose amendment" button that opens the governance workspace's amend modal for this entry - omit to hide it (e.g. when the caller hasn't checked edit_mandate_register). */
  canPropose?: boolean;
}) {
  const router = useRouter();
  const a = alignment(e);
  const codes = postCodes(e, authorities);
  return (
    <div className="scrim" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="drawer detail" role="dialog" aria-modal="true">
        <div className="drawer-h">
          <div>
            <div className="eyebrow gold">Delegation detail{e.ref ? `  ·  ${e.ref}` : ""}</div>
            <h2 className="serif">{legislationOf(e, org)}</h2>
            <div className="sub">{[e.instrumentType, e.provision || ""].filter(Boolean).join("  ·  ")}</div>
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="drawer-b">
          <div className={`dstrip ${a}`}>
            <span className={`align ${a}`}>{ALIGN_LABEL[a]}</span>
            <span className="codes">
              {codes.length
                ? codes.join("; ")
                : a === "statutory"
                  ? "Exercised by the office named above"
                  : a === "reserved"
                    ? "No post mapping required"
                    : "No post mapped"}
            </span>
          </div>

          {e.instrumentToConfirm && (
            <div className="confirmbar">
              <strong>Instrument to be confirmed. </strong>
              <span>
                This power is exercised under a named agreement, but which edition binds this employer has not been settled.
                Confirm it before the register is relied on.
              </span>
            </div>
          )}

          <div className="dsec">
            <div className="dsec-h">Power conferred</div>
            <p className="serif lead">{e.description}</p>
          </div>

          <div className="dsec">
            <div className="dsec-h">Delegation chain</div>
            <DRow label="Delegating authority">
              <Step ids={e.delegatingAuthorityIds} note={e.delegatingAuthorityNote} authorities={authorities} />
            </DRow>
            <DRow label="Delegated body">
              <Step ids={e.delegatedBodyIds} note={e.delegatedBodyNote} authorities={authorities} />
            </DRow>
            <DRow label="Delegated to">
              <Step ids={e.delegateIds} note={e.delegateNote} authorities={authorities} />
            </DRow>
            <DRow label="Sub-delegated to">
              <Step ids={e.subDelegateIds} note={e.subDelegateNote} authorities={authorities} />
            </DRow>
            <DRow label="Further sub-delegated to">
              <Step ids={e.furtherSubDelegateIds} note={e.furtherSubDelegateNote} authorities={authorities} />
            </DRow>
          </div>

          <div className="dsec">
            <div className="dsec-h">Conditions and limitations</div>
            <p className={e.conditions ? "" : "muted"}>{e.conditions || "No additional condition recorded in the source."}</p>
          </div>

          <div className="dsec">
            <div className="dsec-h">Review and alignment</div>
            <DRow label="Legal review status">
              <span className={e.reviewStatus ? "" : "muted"}>{e.reviewStatus || "None"}</span>
            </DRow>
            {e.reviewNote && (
              <DRow label="Legal review note">
                <span>{e.reviewNote}</span>
              </DRow>
            )}
            {e.establishmentNote && (
              <DRow label="Establishment note">
                <span>{e.establishmentNote}</span>
              </DRow>
            )}
            {e.sourceRef && (
              <DRow label="Source">
                <span className="mono small">{e.sourceRef}</span>
              </DRow>
            )}
          </div>
        </div>

        <div className="drawer-f">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          {canPropose && (
            <button
              type="button"
              className="btn pri"
              onClick={() => router.push(`/mandate/governance?org=${org.id}&entry=${e.id}`)}
            >
              Propose amendment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
