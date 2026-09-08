"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "../../../lib/apiClient";

const DatePicker = dynamic<any>(
  () => import("react-datepicker").then((mod) => mod.default as any),
  { ssr: false },
);

type WinnerRow = {
  predictionId: string;
  userId: string;
  phone: string;
  splitTabId: string;
  splitTabName: string;
  matchName: string;
  selectedTeamName: string;
  status: "Locked" | "Won" | "Lost";
  lockedAt: string;
  winningTeamName: string;
  payoutKES: number;
};

type SplitTab = {
  id: string;
  name: string;
};

type InviteStatusRow = {
  userId: string;
  phone: string;
  predictionChances: number;
  usedPredictionChances: number;
  validInviteCount: number;
  totalSuccessfulInviteCount: number;
};

type MeResponse = {
  canAccessData: boolean;
  canAccessAdmin?: boolean;
};

const RECORDS_PAGE_SIZE = 50;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function AdminDataPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [splitTabs, setSplitTabs] = useState<SplitTab[]>([]);
  const [winnerSplitTabFilter, setWinnerSplitTabFilter] = useState("");
  const [winnerPhoneFilter, setWinnerPhoneFilter] = useState("");
  const [winnerStatusFilter, setWinnerStatusFilter] = useState<"" | "Locked" | "Won" | "Lost">("");
  const [winnerFromFilter, setWinnerFromFilter] = useState<Date | null>(null);
  const [winnerToFilter, setWinnerToFilter] = useState<Date | null>(null);
  const [winnerOffset, setWinnerOffset] = useState(0);
  const [winnerTotal, setWinnerTotal] = useState(0);
  const [winnerJumpPage, setWinnerJumpPage] = useState("1");

  const [inviteStats, setInviteStats] = useState<InviteStatusRow[]>([]);
  const [invitePhoneFilter, setInvitePhoneFilter] = useState("");
  const [inviteOffset, setInviteOffset] = useState(0);
  const [inviteTotal, setInviteTotal] = useState(0);
  const [inviteJumpPage, setInviteJumpPage] = useState("1");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const meRes = await apiFetch("/api/auth/me", { cache: "no-store" });
        if (!meRes.ok) {
          setAuthorized(false);
          setMessage("Please log in as data admin.");
          return;
        }

        const mePayload = await parseJson<MeResponse>(meRes);
        if (!mePayload?.canAccessData) {
          setAuthorized(false);
          setMessage("Data page permission required.");
          return;
        }

        setAuthorized(true);
        setCanAccessAdmin(Boolean(mePayload.canAccessAdmin));

        const splitTabsRes = await apiFetch("/api/data/split-tabs", { cache: "no-store" });
        if (splitTabsRes.ok) {
          const splitTabsPayload = await parseJson<SplitTab[]>(splitTabsRes);
          if (splitTabsPayload) {
            setSplitTabs(splitTabsPayload);
          }
        }
      } catch {
        setAuthorized(false);
        setMessage("Unable to verify admin permission. Please retry.");
      }
    };

    void bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildInviteStatsQueryString = (offset?: number) => {
    const params = new URLSearchParams();
    if (typeof offset === "number") {
      params.set("limit", String(RECORDS_PAGE_SIZE));
      params.set("offset", String(offset));
    }

    const normalizedPhone = invitePhoneFilter.trim();
    if (normalizedPhone) {
      params.set("phone", normalizedPhone);
    }

    return params.toString();
  };

  const buildWinnersQueryString = (options?: { includePagination?: boolean; offset?: number }) => {
    const includePagination = options?.includePagination ?? true;
    const params = new URLSearchParams();
    if (includePagination) {
      params.set("limit", String(RECORDS_PAGE_SIZE));
      params.set("offset", String(options?.offset ?? winnerOffset));
    }

    const normalizedPhone = winnerPhoneFilter.trim();
    if (normalizedPhone) {
      params.set("phone", normalizedPhone);
    }
    if (winnerSplitTabFilter) {
      params.set("splitTabId", winnerSplitTabFilter);
    }
    if (winnerStatusFilter) {
      params.set("status", winnerStatusFilter);
    }
    if (winnerFromFilter) {
      params.set("from", winnerFromFilter.toISOString());
    }
    if (winnerToFilter) {
      params.set("to", winnerToFilter.toISOString());
    }

    return params.toString();
  };

  const loadInviteStats = async (offset?: number) => {
    const query = buildInviteStatsQueryString(offset);
    const response = await apiFetch(`/api/data/invite-stats?${query}`);
    if (!response.ok) {
      setMessage("Failed to load invite stats.");
      return;
    }

    const payload = await parseJson<{ items: InviteStatusRow[]; total: number; limit: number; offset: number }>(response);
    if (payload?.items) {
      setInviteStats(payload.items);
      setInviteTotal(payload.total ?? payload.items.length);
      const effectiveOffset = payload.offset ?? offset ?? 0;
      setInviteOffset(effectiveOffset);
      setInviteJumpPage(String(Math.floor(effectiveOffset / RECORDS_PAGE_SIZE) + 1));
    }
  };

  const loadWinners = async (offset?: number) => {
    const query = buildWinnersQueryString({ includePagination: true, offset });
    const winnersRes = await apiFetch(`/api/data/winners?${query}`);
    if (!winnersRes.ok) {
      setMessage("Failed to load prediction records.");
      return;
    }

    const winnersPayload = await parseJson<{ items: WinnerRow[]; total: number; limit: number; offset: number }>(winnersRes);
    if (winnersPayload?.items) {
      setWinners(winnersPayload.items);
      setWinnerTotal(winnersPayload.total ?? winnersPayload.items.length);
      const effectiveOffset = winnersPayload.offset ?? offset ?? 0;
      setWinnerOffset(effectiveOffset);
      setWinnerJumpPage(String(Math.floor(effectiveOffset / RECORDS_PAGE_SIZE) + 1));
    }
  };

  const verifyPin = async () => {
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("Please enter exactly 4 digits.");
      return;
    }

    setPinSubmitting(true);
    setPinError("");
    const response = await apiFetch("/api/data/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinInput }),
    });

    const payload = await parseJson<{ valid?: boolean }>(response);
    setPinSubmitting(false);

    if (!response.ok || !payload?.valid) {
      window.location.href = "/";
      return;
    }

    setPinVerified(true);
    setPinInput("");
    await Promise.all([loadInviteStats(0), loadWinners(0)]);
  };

  const currentWinnerPage = Math.floor(winnerOffset / RECORDS_PAGE_SIZE) + 1;
  const totalWinnerPages = Math.max(1, Math.ceil(winnerTotal / RECORDS_PAGE_SIZE));
  const currentInvitePage = Math.floor(inviteOffset / RECORDS_PAGE_SIZE) + 1;
  const totalInvitePages = Math.max(1, Math.ceil(inviteTotal / RECORDS_PAGE_SIZE));

  const jumpToWinnerPage = () => {
    const parsed = Number.parseInt(winnerJumpPage, 10);
    const safePage = Number.isNaN(parsed)
      ? currentWinnerPage
      : Math.min(Math.max(parsed, 1), totalWinnerPages);
    const nextOffset = (safePage - 1) * RECORDS_PAGE_SIZE;
    void loadWinners(nextOffset);
  };

  const jumpToInvitePage = () => {
    const parsed = Number.parseInt(inviteJumpPage, 10);
    const safePage = Number.isNaN(parsed)
      ? currentInvitePage
      : Math.min(Math.max(parsed, 1), totalInvitePages);
    const nextOffset = (safePage - 1) * RECORDS_PAGE_SIZE;
    void loadInviteStats(nextOffset);
  };

  if (authorized === false) {
    return (
      <main className="sports-page admin-page wccp-page">
        <section className="block">
          <h2>Admin Access Denied</h2>
          <p>{message || "Please login with data admin account."}</p>
          <a className="btn ghost" href="/">Back to Home</a>
        </section>
      </main>
    );
  }

  if (authorized === null) {
    return (
      <main className="sports-page admin-page wccp-page">
        <section className="block">
          <p>Checking admin permission...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="sports-page admin-page wccp-page">
      <header className="sports-topbar">
        <div className="brand">
          <span className="brand-mark">DATA</span>
          <div>
            <h1>Admin Data</h1>
            <small>Invite Status and Prediction Records</small>
          </div>
        </div>
        <div className="top-actions">
          {canAccessAdmin ? <a className="btn ghost" href="/admin">Admin</a> : null}
          <a className="btn ghost" href="/">Back Home</a>
        </div>
      </header>

      <section className="block admin-block">
        <div className="block-head">
          <h3>Invite Status</h3>
          <div className="row-inline">
            <input
              value={invitePhoneFilter}
              onChange={(event) => setInvitePhoneFilter(event.target.value)}
              placeholder="Filter by phone"
            />
            <button type="button" className="btn ghost" onClick={() => void loadInviteStats(0)}>Search</button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setInvitePhoneFilter("");
                void loadInviteStats(0);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={async () => {
                const query = buildInviteStatsQueryString();
                const response = await apiFetch(`/api/data/invite-stats/csv?${query}`);
                if (!response.ok) {
                  setMessage("Failed to download invite stats CSV.");
                  return;
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "invite-status.csv";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              }}
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="table-list">
          {inviteStats.map((row) => (
            <div className="table-row stretch" key={row.userId}>
              <div>
                <strong>{row.phone}</strong>
                <p>
                  Prediction chances: {row.predictionChances}
                  {" | "}
                  Used: {row.usedPredictionChances}
                  {" | "}
                  Valid invites: {row.validInviteCount}
                  {" | "}
                  Total successful invites: {row.totalSuccessfulInviteCount}
                </p>
              </div>
            </div>
          ))}
          {inviteStats.length === 0 ? <p className="empty">No invite stats found.</p> : null}
        </div>

        <div className="row-inline">
          <button
            type="button"
            className="btn ghost"
            onClick={() => void loadInviteStats(Math.max(0, inviteOffset - RECORDS_PAGE_SIZE))}
            disabled={inviteOffset <= 0}
          >
            Prev
          </button>
          <small>Page {currentInvitePage} / {totalInvitePages} | Total {inviteTotal}</small>
          <input
            type="number"
            min="1"
            max={String(totalInvitePages)}
            value={inviteJumpPage}
            onChange={(event) => setInviteJumpPage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jumpToInvitePage();
              }
            }}
            placeholder="Page"
            style={{ width: 90 }}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={jumpToInvitePage}
          >
            Go
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => void loadInviteStats(inviteOffset + RECORDS_PAGE_SIZE)}
            disabled={inviteOffset + RECORDS_PAGE_SIZE >= inviteTotal}
          >
            Next
          </button>
        </div>
      </section>

      <section className="block admin-block">
        <div className="block-head">
          <h3>Prediction Records</h3>
          <div className="row-inline">
            <input
              value={winnerPhoneFilter}
              onChange={(event) => setWinnerPhoneFilter(event.target.value)}
              placeholder="Filter by phone"
            />
            <select value={winnerSplitTabFilter} onChange={(event) => setWinnerSplitTabFilter(event.target.value)}>
              <option value="">All split tabs</option>
              {splitTabs.map((splitTab) => (
                <option key={splitTab.id} value={splitTab.id}>{splitTab.name}</option>
              ))}
            </select>
            <select
              value={winnerStatusFilter}
              onChange={(event) => setWinnerStatusFilter(event.target.value as "" | "Locked" | "Won" | "Lost")}
            >
              <option value="">All status</option>
              <option value="Locked">Locked</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
            <DatePicker
              selected={winnerFromFilter}
              onChange={(value: Date | null) => setWinnerFromFilter(value)}
              showTimeSelect
              timeIntervals={5}
              timeCaption="Time"
              dateFormat="yyyy/MM/dd HH:mm"
              placeholderText="From time"
              className="date-time-picker-input"
              popperClassName="date-time-picker-popper"
            />
            <DatePicker
              selected={winnerToFilter}
              onChange={(value: Date | null) => setWinnerToFilter(value)}
              showTimeSelect
              timeIntervals={5}
              timeCaption="Time"
              dateFormat="yyyy/MM/dd HH:mm"
              placeholderText="To time"
              className="date-time-picker-input"
              popperClassName="date-time-picker-popper"
            />
            <button type="button" className="btn ghost" onClick={() => void loadWinners(0)}>Search</button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setWinnerPhoneFilter("");
                setWinnerSplitTabFilter("");
                setWinnerStatusFilter("");
                setWinnerFromFilter(null);
                setWinnerToFilter(null);
                void loadWinners(0);
              }}
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              const query = buildWinnersQueryString({ includePagination: false });
              const response = await apiFetch(`/api/data/winners/csv?${query}`);
              if (!response.ok) {
                setMessage("Failed to download CSV.");
                return;
              }

              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "prediction-records.csv";
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
            }}
          >
            Download CSV
          </button>
        </div>

        <div className="table-list">
          {winners.map((winner) => (
            <div className="table-row stretch" key={winner.predictionId}>
              <div>
                <strong>{winner.matchName}</strong>
                <p>{winner.phone}</p>
                <small>Split Tab: {winner.splitTabName || "-"}</small>
                <small>
                  Team: {winner.selectedTeamName} | Status: {winner.status} | Time: {new Date(winner.lockedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}
                </small>
                {winner.winningTeamName ? <small>Winning team: {winner.winningTeamName}</small> : null}
              </div>
              <strong>{winner.payoutKES} KES</strong>
            </div>
          ))}
          {winners.length === 0 ? <p className="empty">No prediction records found.</p> : null}
        </div>

        <div className="row-inline">
          <button
            type="button"
            className="btn ghost"
            onClick={() => void loadWinners(Math.max(0, winnerOffset - RECORDS_PAGE_SIZE))}
            disabled={winnerOffset <= 0}
          >
            Prev
          </button>
          <small>Page {currentWinnerPage} / {totalWinnerPages} | Total {winnerTotal}</small>
          <input
            type="number"
            min="1"
            max={String(totalWinnerPages)}
            value={winnerJumpPage}
            onChange={(event) => setWinnerJumpPage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jumpToWinnerPage();
              }
            }}
            placeholder="Page"
            style={{ width: 90 }}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={jumpToWinnerPage}
          >
            Go
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => void loadWinners(winnerOffset + RECORDS_PAGE_SIZE)}
            disabled={winnerOffset + RECORDS_PAGE_SIZE >= winnerTotal}
          >
            Next
          </button>
        </div>
      </section>

      {message ? <div className="page-message">{message}</div> : null}

      {!pinVerified ? (
        <div className="modal-backdrop">
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Enter Data PIN</h3>
            <div className="confirm-summary">
              <p>Enter the 4-digit Data PIN to access this page.</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoFocus
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void verifyPin();
                }
              }}
              placeholder="4-digit PIN"
            />
            {pinError ? <p className="invite-copy-notice">{pinError}</p> : null}
            <div className="confirm-actions">
              <button type="button" className="btn ghost" onClick={() => { window.location.href = "/"; }}>Cancel</button>
              <button type="button" className="btn primary" onClick={() => void verifyPin()} disabled={pinSubmitting}>
                {pinSubmitting ? "Checking..." : "Enter"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
