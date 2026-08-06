import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppraisalDetail, friendlyAppraisalActual } from "@/lib/data/appraisals";
import { getAnnexureData } from "@/lib/data/annexure";
import { getPdpData } from "@/lib/data/pdp";
import { getAgreementData } from "@/lib/data/agreement";
import { AppraisalCaptureCard } from "./AppraisalCaptureCard";
import { AssessmentSummary } from "./AssessmentSummaryCards";
import { AnnexureEditor } from "./AnnexureEditor";
import { AssessmentRatingsPanel } from "./AssessmentRatingsPanel";
import { AgreementSignaturePanel } from "./AgreementSignaturePanel";
import { AgreementDetailsPanel } from "./AgreementDetailsPanel";
import { PdpEditor } from "./PdpEditor";

export default async function AppraisalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { cycleId } = await params;
  const { q, view } = await searchParams;
  const quarter = q ? Math.min(4, Math.max(1, Number(q) || 4)) : 4;
  const isAgreementView = view === "agreement";
  const isAnnexureView = view === "annexure";
  const isRatingsView = view === "ratings";
  const isPdpView = view === "pdp";

  const detail = await getAppraisalDetail(cycleId, quarter);
  if (!detail) notFound();

  const annexure = isAnnexureView ? await getAnnexureData(cycleId) : null;
  // The agreement's "Details inserted into the agreement" panel + signature
  // block live on the Agreement tab (matching the reference tool's
  // "Employee Performance Agreement" tab), not on Annexure A.
  const agreement = isAgreementView ? await getAgreementData(cycleId) : null;
  const agreementSignature = isAgreementView ? await getAnnexureData(cycleId) : null;
  const pdp = isPdpView ? await getPdpData(cycleId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <Link href="/appraisals" className="text-xs font-semibold text-ink2 hover:underline">
            ← All appraisals
          </Link>
          <h1 className="mt-1 text-xl font-extrabold text-ink">{detail.employeeName}</h1>
          <div className="mt-0.5 text-xs text-ink2">
            {detail.position ? `${detail.position} · ` : ""}
            {detail.orgName} · {detail.fyLabel}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {!isAgreementView && !isAnnexureView && !isPdpView && (
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((qq) => (
                <Link
                  key={qq}
                  href={`/appraisals/${cycleId}?q=${qq}`}
                  prefetch={false}
                  className={`relative rounded-md px-3 py-1.5 text-xs font-bold ${
                    qq === quarter
                      ? "bg-ink text-white"
                      : "border border-line bg-white text-ink2 hover:border-ink"
                  }`}
                >
                  Q{qq}
                  {detail.quartersNeedingReview.includes(qq) && (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold"
                      title="Has items needing review"
                    />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ordered so the default landing tab (Capture results - no ?view=
         needed) is always leftmost and visibly active, with its companion
         Assessment ratings next to it since both are the recurring,
         quarter-scoped screens people live in day to day. Agreement,
         Annexure A, and Development plan are mostly one-time/reference
         screens, so they sit after. Each still links directly - this is
         just display order, not a step-by-step wizard. */}
      <div className="flex flex-wrap gap-1">
        <Link
          href={`/appraisals/${cycleId}?q=${quarter}`}
          prefetch={false}
          className={`rounded-md px-3 py-1.5 text-xs font-bold ${
            !isAgreementView && !isAnnexureView && !isRatingsView && !isPdpView ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
          }`}
        >
          Capture results
        </Link>
        <Link
          href={`/appraisals/${cycleId}?view=ratings&q=${quarter}`}
          prefetch={false}
          className={`rounded-md px-3 py-1.5 text-xs font-bold ${
            isRatingsView ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
          }`}
        >
          Assessment ratings
        </Link>
        <Link
          href={`/appraisals/${cycleId}?view=agreement`}
          prefetch={false}
          className={`rounded-md px-3 py-1.5 text-xs font-bold ${
            isAgreementView ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
          }`}
        >
          Employee Performance Agreement
        </Link>
        <Link
          href={`/appraisals/${cycleId}?view=annexure`}
          prefetch={false}
          className={`rounded-md px-3 py-1.5 text-xs font-bold ${
            isAnnexureView ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
          }`}
        >
          Annexure A — Performance Plan
        </Link>
        <Link
          href={`/appraisals/${cycleId}?view=pdp`}
          prefetch={false}
          className={`rounded-md px-3 py-1.5 text-xs font-bold ${
            isPdpView ? "bg-ink text-white" : "border border-line bg-white text-ink2 hover:border-ink"
          }`}
        >
          Development plan
        </Link>
      </div>

      {isRatingsView && (
        <div className="text-xs font-semibold text-ink2">
          {detail.quarterLabel} · <b className="text-ink">{detail.reviewType}</b> · due{" "}
          <b className="text-ink">{detail.reviewDueDate}</b>
        </div>
      )}

      {isPdpView ? (
        pdp ? (
          <>
            {!pdp.canEdit && (
              <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
                You have view-only access to this development plan.
              </p>
            )}
            <PdpEditor cycleId={pdp.cycleId} items={pdp.items} totalDays={pdp.totalDays} canEdit={pdp.canEdit} />
          </>
        ) : (
          <p className="text-sm text-ink2">Couldn&apos;t load the development plan.</p>
        )
      ) : isAnnexureView ? (
        annexure ? (
          <>
            {!annexure.canEdit && (
              <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
                You have view-only access to this performance plan.
              </p>
            )}
            <AnnexureEditor cycleId={annexure.cycleId} kpis={annexure.kpis} totalWeight={annexure.totalWeight} />
          </>
        ) : (
          <p className="text-sm text-ink2">Couldn&apos;t load the performance plan.</p>
        )
      ) : isAgreementView ? (
        agreement && agreementSignature ? (
          <>
            {!agreement.canEditAgreementTemplate && !agreementSignature.canSignAsEmployer && !agreementSignature.canSignAsEmployee && (
              <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
                You have view-only access to this performance agreement.
              </p>
            )}
            <AgreementDetailsPanel
              cycleId={agreementSignature.cycleId}
              municipalityOrgId={agreement.municipalityOrgId}
              canEdit={agreement.canEditAgreementTemplate}
              signPlaceDefault={agreement.policy.signPlaceDefault}
              signDayDefault={agreement.policy.signDayDefault}
              signMonthDefault={agreement.policy.signMonthDefault}
              reviewSchedule={agreement.reviewSchedule}
              reviewDates={agreement.policy.reviewDates}
            />
            <AgreementSignaturePanel
              cycleId={agreementSignature.cycleId}
              agreement={agreementSignature.agreement}
              canSignAsEmployer={agreementSignature.canSignAsEmployer}
              canSignAsEmployee={agreementSignature.canSignAsEmployee}
            />
          </>
        ) : (
          <p className="text-sm text-ink2">Couldn&apos;t load the performance agreement.</p>
        )
      ) : isRatingsView ? (
        <>
          <AssessmentSummary assessment={detail.assessment} />

          {!detail.canManagerRate && !detail.canSelfAssess && (
            <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
              You have view-only access to this assessment.
            </p>
          )}

          <AssessmentRatingsPanel
            key={quarter}
            cycleId={detail.cycleId}
            quarter={quarter}
            quarterLabel={detail.quarterLabel}
            reviewType={detail.reviewType}
            reviewDueDate={detail.reviewDueDate}
            kpis={detail.kpis}
            competencies={detail.competencies}
            meta={detail.meta}
            canManagerRate={detail.canManagerRate}
            canSelfAssess={detail.canSelfAssess}
          />
        </>
      ) : (
        <>
          <AssessmentSummary assessment={detail.assessment} />

          {!detail.canCapture && (
            <p className="rounded-md bg-blue-bg px-3 py-2 text-sm font-medium text-blue">
              You have view-only access to this appraisal.
            </p>
          )}

          {detail.kpis.length === 0 ? (
            <p className="text-sm text-ink2">No KPIs on this appraisal yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {detail.kpis.map((kpi) => (
                <div key={kpi.id} className="rounded-xl border border-line bg-white p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      {kpi.kpa && (
                        <span className="text-[11px] font-bold uppercase tracking-wide text-ink2">
                          {kpi.kpa}
                        </span>
                      )}
                      <div className="mt-1 break-words text-sm font-semibold text-ink">{kpi.name}</div>
                      {kpi.unitOfMeasure && (
                        <div className="mt-0.5 text-xs text-ink2">{kpi.unitOfMeasure}</div>
                      )}
                    </div>
                    <div className="flex-none text-xs text-ink2 sm:text-right">
                      <div className="font-bold uppercase tracking-wide">Q{quarter} target</div>
                      <div className="mt-0.5 font-mono text-sm text-ink">
                        {kpi.result?.targetValue ?? kpi.annualTarget ?? "—"}
                      </div>
                    </div>
                  </div>

                  {detail.canCapture ? (
                    // Keyed on quarter so React remounts (and re-initialises form
                    // state from the fresh kpi.result) every time the quarter
                    // changes, instead of reusing stale typed values from before.
                    <AppraisalCaptureCard key={quarter} kpi={kpi} quarter={quarter} cycleId={detail.cycleId} />
                  ) : (
                    <div className="text-sm text-ink">
                      {friendlyAppraisalActual(kpi) ?? "No result captured yet."}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
