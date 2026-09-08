"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, clearTokens, setTokens } from "../lib/apiClient";

type Team = {
  id: string;
  name: string;
  country: string | null;
  iconUrl: string | null;
  isActive: boolean;
};

type Match = {
  id: string;
  name: string;
  description: string | null;
  splitTabId: string | null;
  predictionDeadline: string;
  isPublished: boolean;
  status: "Open" | "Closed" | "Settled";
  winningTeamId: string | null;
  settledAt: string | null;
  totalPredictions: number;
  teams: Team[];
};

type SplitTab = {
  id: string;
  name: string;
  baseJackpotAmountKES: number;
  inviteAmountKES: number;
  fixedPredictionModeEnabled: boolean;
  fixedPredictionCount: number | null;
  isEnabled: boolean;
  currentJackpotAmountKES: number;
  currency: string;
};

type JackpotState = {
  amount: number;
  currency: string;
  splitTabId: string;
  name: string;
  inviteAmountKES: number;
  baseJackpotAmountKES: number;
  fixedPredictionModeEnabled: boolean;
  fixedPredictionCount: number | null;
};

type GameState = {
  splitTabs: SplitTab[];
  activeSplitTabId: string | null;
  jackpot: JackpotState | null;
  teams: Team[];
  matches: Match[];
  updatedAt: string;
};

type SplitTabAllowance = {
  splitTabId: string;
  total: number;
  used: number;
  remaining: number;
  mode: "fixed" | "shared";
  fixedPredictionModeEnabled: boolean;
};

type MeResponse = {
  id: string;
  phone: string;
  role: string;
  permissions: string[];
  authMethod?: "local" | "external";
  externalMerchant?: string | null;
  externalRef?: string | null;
  canAccessAdmin: boolean;
  canAccessData?: boolean;
  walletBalanceKES: number;
  walletCurrency: string;
  dailyBetAllowanceTotal?: number;
  dailyBetAllowanceUsed?: number;
  dailyBetAllowanceRemaining?: number;
  splitTabAllowances?: SplitTabAllowance[];
};

type AuthPayload = {
  user: {
    id: string;
    phone: string;
    role: string;
    permissions: string[];
  };
  accessToken: string;
  refreshToken: string;
};

type Prediction = {
  id: string;
  matchId: string;
  matchName: string;
  splitTabId: string | null;
  splitTabName: string | null;
  teamId: string;
  teamName: string;
  teamIconUrl: string | null;
  winningTeamId: string | null;
  winningTeamName: string | null;
  status: "Locked" | "Won" | "Lost";
  payoutKES: number;
  lockedAt: string;
  settledAt: string | null;
  predictionDeadline: string | null;
};

type WalletCredit = {
  id: string;
  predictionId: string | null;
  matchId: string | null;
  settlementKey: string;
  jackpotBeforeSplitKES: number;
  winnerCount: number;
  payoutKES: number;
  settledAt: string;
  currency: string;
};

type VoteConfirmState = {
  matchId: string;
  matchName: string;
  teamName: string;
};

const AUTH_EXPIRED_FLAG = "authExpired";

const INVITE_BASE_URLS: Record<string, string> = {
  ke7stg: process.env.NEXT_PUBLIC_MERCHANT_KE7STG_INVITE_URL?.trim() ?? "https://ke7dev.lol/?crc=",
  ke7prod: process.env.NEXT_PUBLIC_MERCHANT_KE7PROD_INVITE_URL?.trim() ?? "https://ke7.com/?crc=",
};

function getInviteBaseUrl(merchant: string): string | null {
  const normalizedMerchant = merchant.trim().toLowerCase();
  return INVITE_BASE_URLS[normalizedMerchant] ?? null;
}

function buildInviteLink(merchant: string, ref: string): string {
  const baseUrl = getInviteBaseUrl(merchant);
  if (!baseUrl) {
    return "";
  }

  const normalizedRef = ref.trim();
  if (!normalizedRef) {
    return "";
  }

  return `${baseUrl}${encodeURIComponent(normalizedRef)}`;
}

const COUNTRY_FLAG_MAP: Record<string, string> = {
  Mexico: "🇲🇽",
  "South Africa": "🇿🇦",
  "Korea Republic": "🇰🇷",
  Czechia: "🇨🇿",
  Canada: "🇨🇦",
  "Bosnia and Herzegovina": "🇧🇦",
  Qatar: "🇶🇦",
  Switzerland: "🇨🇭",
  Brazil: "🇧🇷",
  Morocco: "🇲🇦",
  Haiti: "🇭🇹",
  Scotland: "🏴",
  "United States": "🇺🇸",
  Paraguay: "🇵🇾",
  Australia: "🇦🇺",
  Turkey: "🇹🇷",
  Germany: "🇩🇪",
  Curacao: "🇨🇼",
  "Cote d'Ivoire": "🇨🇮",
  Ecuador: "🇪🇨",
  Netherlands: "🇳🇱",
  Japan: "🇯🇵",
  Sweden: "🇸🇪",
  Tunisia: "🇹🇳",
  Belgium: "🇧🇪",
  Egypt: "🇪🇬",
  Iran: "🇮🇷",
  "New Zealand": "🇳🇿",
  Spain: "🇪🇸",
  "Cabo Verde": "🇨🇻",
  "Saudi Arabia": "🇸🇦",
  Uruguay: "🇺🇾",
  France: "🇫🇷",
  Senegal: "🇸🇳",
  Iraq: "🇮🇶",
  Norway: "🇳🇴",
  Argentina: "🇦🇷",
  Algeria: "🇩🇿",
  Austria: "🇦🇹",
  Jordan: "🇯🇴",
  Portugal: "🇵🇹",
  "Congo DR": "🇨🇩",
  Uzbekistan: "🇺🇿",
  Colombia: "🇨🇴",
  England: "🏴",
  Croatia: "🇭🇷",
  Ghana: "🇬🇭",
  Panama: "🇵🇦",
  // Backward compatibility for existing records created with old names.
  "South Korea": "🇰🇷",
  USA: "🇺🇸",
};

function normalizeKenyanPhone(phone: string): string {
  const value = phone.trim();
  if (/^\+254[71]\d{8}$/.test(value)) {
    return value;
  }
  if (/^0[71]\d{8}$/.test(value)) {
    return `+254${value.slice(1)}`;
  }
  return value;
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const [state, setState] = useState<GameState | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [credits, setCredits] = useState<WalletCredit[]>([]);
  const [selectedByMatch, setSelectedByMatch] = useState<Record<string, string>>({});
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(null);
  const [voteConfirm, setVoteConfirm] = useState<VoteConfirmState | null>(null);
  const [collapsedSettledMatches, setCollapsedSettledMatches] = useState<Record<string, boolean>>({});
  const [inviteMerchant, setInviteMerchant] = useState("");
  const [inviteRef, setInviteRef] = useState("");
  const [inviteCopyNotice, setInviteCopyNotice] = useState("");
  const inviteCopyTimerRef = useRef<number | null>(null);
  const isInviteCopyMessage = message === "Invite link copied." || message === "Failed to copy invite link.";

  const predictionsByMatchId = useMemo(() => {
    const map = new Map<string, Prediction[]>();
    for (const prediction of predictions) {
      const current = map.get(prediction.matchId) ?? [];
      current.push(prediction);
      map.set(prediction.matchId, current);
    }
    return map;
  }, [predictions]);

  const jackpotText = useMemo(() => {
    const amount = state?.jackpot?.amount ?? 0;
    const currency = state?.jackpot?.currency ?? "KES";
    return `${currency} ${new Intl.NumberFormat("en-US").format(amount)}`;
  }, [state?.jackpot?.amount, state?.jackpot?.currency]);

  const activeSplitTab = useMemo(
    () => state?.splitTabs.find((splitTab) => splitTab.id === state.activeSplitTabId) ?? null,
    [state],
  );

  const activeSplitTabAllowance = useMemo(
    () => me?.splitTabAllowances?.find((item) => item.splitTabId === state?.activeSplitTabId) ?? null,
    [me?.splitTabAllowances, state?.activeSplitTabId],
  );

  const creditsByPredictionId = useMemo(() => {
    const map = new Map<string, { payoutKES: number; currency: string; settledAt: string }>();
    for (const credit of credits) {
      if (!credit.predictionId) {
        continue;
      }

      const existing = map.get(credit.predictionId);
      if (!existing) {
        map.set(credit.predictionId, {
          payoutKES: credit.payoutKES,
          currency: credit.currency,
          settledAt: credit.settledAt,
        });
        continue;
      }

      const nextSettledAt = new Date(credit.settledAt).getTime() > new Date(existing.settledAt).getTime()
        ? credit.settledAt
        : existing.settledAt;
      map.set(credit.predictionId, {
        payoutKES: existing.payoutKES + credit.payoutKES,
        currency: existing.currency,
        settledAt: nextSettledAt,
      });
    }
    return map;
  }, [credits]);

  const historyPredictions = useMemo(
    () => [...predictions].sort((a, b) => new Date(b.lockedAt).getTime() - new Date(a.lockedAt).getTime()).slice(0, 30),
    [predictions],
  );
  const remainingPredictionChances = activeSplitTabAllowance?.mode === "fixed"
    ? Math.max(0, activeSplitTabAllowance.remaining)
    : Math.max(0, me?.dailyBetAllowanceRemaining ?? 0);
  const fixedPredictionPerMatchTotal = Math.max(0, activeSplitTab?.fixedPredictionCount ?? state?.jackpot?.fixedPredictionCount ?? 0);

  const activeInviteAmount = activeSplitTab?.inviteAmountKES ?? state?.jackpot?.inviteAmountKES ?? 0;
  const activeSplitTabName = activeSplitTab?.name ?? state?.jackpot?.name ?? "Shared";
  const activeTabUsesFixedChances = Boolean(activeSplitTab?.fixedPredictionModeEnabled ?? state?.jackpot?.fixedPredictionModeEnabled);
  const chancesBadgeText = activeTabUsesFixedChances
    ? `Per match ${fixedPredictionPerMatchTotal}`
    : String(remainingPredictionChances);
  const championChanceText = activeTabUsesFixedChances
    ? `Per match ${fixedPredictionPerMatchTotal}`
    : `${remainingPredictionChances} left`;
  const resolvedInviteMerchant = inviteMerchant.trim() || me?.externalMerchant?.trim() || "";
  const resolvedInviteRef = inviteRef.trim() || me?.externalRef?.trim() || "";
  const displayInviteLink = buildInviteLink(resolvedInviteMerchant, resolvedInviteRef);
  const canCopyInviteLink = Boolean(displayInviteLink);

  useEffect(() => {
    if (!state?.matches?.length) {
      return;
    }

    setCollapsedSettledMatches((current) => {
      let changed = false;
      const next = { ...current };
      for (const match of state.matches) {
        if ((match.status === "Settled" || match.status === "Closed") && next[match.id] === undefined) {
          next[match.id] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [state?.matches]);

  useEffect(() => {
    const bootstrap = async () => {
      const params = new URLSearchParams(window.location.search);
      const merchant = params.get("merchant")?.trim() ?? "";
      const token = params.get("token")?.trim() ?? "";
      const externalPhone = params.get("phone")?.trim() ?? "";
      const ref = (params.get("ref") ?? params.get("crc") ?? "").trim();
      const initialSplitTabId = params.get("tab")?.trim() ?? "";

      setInviteMerchant(merchant);
      setInviteRef(ref);

      const authExpired = params.get("auth") === "expired" || localStorage.getItem(AUTH_EXPIRED_FLAG) === "1";

      if (authExpired) {
        setMessage("Session expired. Please log in again.");
        localStorage.removeItem(AUTH_EXPIRED_FLAG);
      }

      if (merchant && token && externalPhone) {
        const response = await apiFetch("/api/auth/external-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchant, token, phone: externalPhone, ref }),
        });

        const payload = await parseJson<AuthPayload | { message?: string; error?: string }>(response);
        if (response.ok && payload && "accessToken" in payload) {
          setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
          setMessage("External login success.");
        } else {
          const errorMessage = (payload as { message?: string; error?: string } | null)?.error
            ?? (payload as { message?: string } | null)?.message
            ?? "External login failed.";
          setMessage(errorMessage);
        }
      }

      if (authExpired || merchant || token || externalPhone || ref) {
        params.delete("auth");
        params.delete("merchant");
        params.delete("token");
        params.delete("phone");
        params.delete("ref");
        params.delete("crc");
        const next = params.toString();
        window.history.replaceState({}, "", next ? `/?${next}` : "/");
      }

      await loadMe();
      await loadState(initialSplitTabId || undefined);
      await loadMine();
    };

    void bootstrap();

    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadState(state?.activeSplitTabId ?? undefined);
      void loadMine();
    }, 5000);

    return () => window.clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.activeSplitTabId]);

  useEffect(() => {
    if (!isInviteCopyMessage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setMessage((current) => (current === message ? "" : current));
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [isInviteCopyMessage, message]);

  useEffect(() => {
    return () => {
      if (inviteCopyTimerRef.current) {
        window.clearTimeout(inviteCopyTimerRef.current);
      }
    };
  }, []);

  const loadMe = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setMe(null);
      return;
    }

    const response = await apiFetch("/api/auth/me", { cache: "no-store" });
    if (!response.ok) {
      setMe(null);
      return;
    }

    const payload = await parseJson<MeResponse>(response);
    if (payload) {
      setMe(payload);
      if (payload.externalMerchant) {
        setInviteMerchant(payload.externalMerchant);
      }
      if (payload.externalRef) {
        setInviteRef(payload.externalRef);
      }
    }
  };

  const syncSplitTabQuery = (splitTabId: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (splitTabId) {
      params.set("tab", splitTabId);
    } else {
      params.delete("tab");
    }

    const next = params.toString();
    window.history.replaceState({}, "", next ? `/?${next}` : "/");
  };

  const loadState = async (splitTabId?: string) => {
    const query = new URLSearchParams();
    if (splitTabId) {
      query.set("splitTabId", splitTabId);
    }

    const response = await apiFetch(`/api/game/state${query.toString() ? `?${query.toString()}` : ""}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await parseJson<GameState>(response);
    if (payload) {
      setState(payload);
      syncSplitTabQuery(payload.activeSplitTabId ?? null);
    }
  };

  const loadMine = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setPredictions([]);
      setCredits([]);
      return;
    }

    const [predictionsRes, creditsRes] = await Promise.all([
      apiFetch("/api/game/my-predictions", { cache: "no-store" }),
      apiFetch("/api/game/my-wallet-credits", { cache: "no-store" }),
    ]);

    if (predictionsRes.ok) {
      const predictionPayload = await parseJson<Prediction[]>(predictionsRes);
      if (predictionPayload) {
        setPredictions(predictionPayload);
      }
    }

    if (creditsRes.ok) {
      const creditsPayload = await parseJson<WalletCredit[]>(creditsRes);
      if (creditsPayload) {
        setCredits(creditsPayload);
      }
    }
  };

  const submitAuth = async () => {
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const normalizedPhone = normalizeKenyanPhone(phone);
    const response = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizedPhone, password }),
    });

    const payload = await parseJson<AuthPayload | { message?: string }>(response);
    if (!response.ok || !payload || !("accessToken" in payload)) {
      setMessage((payload as { message?: string } | null)?.message ?? "Authentication failed.");
      return;
    }

    setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
    setAuthOpen(false);
    setPhone("");
    setPassword("");
    setMessage(authMode === "login" ? "Login success." : "Register success.");
    await loadMe();
    await loadMine();
  };

  const logout = () => {
    clearTokens();
    setMe(null);
    setPredictions([]);
    setCredits([]);
    setMessage("Logged out.");
  };

  const submitPrediction = async (matchId: string) => {
    const currentRemainingTickets = activeTabUsesFixedChances
      ? Math.max(0, fixedPredictionPerMatchTotal - (predictionsByMatchId.get(matchId)?.length ?? 0))
      : remainingPredictionChances;

    if (currentRemainingTickets <= 0) {
      setMessage("No prediction chances left.");
      return;
    }

    const teamId = selectedByMatch[matchId];
    if (!teamId) {
      setMessage("Please select a team first.");
      return;
    }

    setVoteConfirm(null);
    setSubmittingMatchId(matchId);
    const response = await apiFetch("/api/game/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, teamId }),
    });

    const payload = await parseJson<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? "Failed to lock prediction.");
      setSubmittingMatchId(null);
      return;
    }

    setMessage("Prediction locked successfully.");
    setSubmittingMatchId(null);
    await loadMe();
    await loadMine();
    await loadState(state?.activeSplitTabId ?? undefined);
  };

  const openVoteConfirm = (match: Match) => {
    const currentRemainingTickets = activeTabUsesFixedChances
      ? Math.max(0, fixedPredictionPerMatchTotal - (predictionsByMatchId.get(match.id)?.length ?? 0))
      : remainingPredictionChances;

    if (currentRemainingTickets <= 0) {
      setMessage("No prediction chances left.");
      return;
    }

    const teamId = selectedByMatch[match.id];
    if (!teamId) {
      setMessage("Please select a team first.");
      return;
    }

    const team = match.teams.find((item) => item.id === teamId);
    if (!team) {
      setMessage("Selected team is invalid.");
      return;
    }

    setVoteConfirm({
      matchId: match.id,
      matchName: match.name,
      teamName: team.name,
    });
  };

  const showInviteCopyNotice = (text: string, durationMs: number) => {
    setInviteCopyNotice(text);
    if (inviteCopyTimerRef.current) {
      window.clearTimeout(inviteCopyTimerRef.current);
    }
    inviteCopyTimerRef.current = window.setTimeout(() => {
      setInviteCopyNotice("");
      inviteCopyTimerRef.current = null;
    }, durationMs);
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const resolveTeamLogo = (team: Team) => {
    if (team.iconUrl) {
      return team.iconUrl;
    }
    if (team.country) {
      return `/team-logos/${encodeURIComponent(team.country)}.png`;
    }
    return "/logo.png";
  };

  return (
    <main className="sports-page wccp-page">
      <picture className="wccp-page-bg" aria-hidden="true">
        <source media="(max-width: 767px)" srcSet="/images/hero-bg-mobile.png" />
        <img src="/images/hero-bg-web.png" alt="" />
      </picture>

      <div className="wccp-shell">
        <header className={`sports-topbar wccp-topbar ${me ? "is-authenticated" : "is-guest"}`}>
          <div className="wccp-brand-row">
            <strong className="wccp-logo">WCCP</strong>
            {me?.phone || me ? (
              <div className="wccp-brand-meta show-mobile-only">
                {me?.phone ? <span className="wccp-wallet">{me.phone}</span> : null}
                {me ? <span className="wccp-balance">Balance {me.walletCurrency} {me.walletBalanceKES}</span> : null}
                {me ? <span className="wccp-chances-mobile">Chances {chancesBadgeText}</span> : null}
              </div>
            ) : null}
          </div>

          <div className="top-actions">
            {me?.phone ? <span className="wccp-wallet show-desktop-only">{me.phone}</span> : null}
            {me ? <span className="wccp-balance show-desktop-only">Balance {me.walletCurrency} {me.walletBalanceKES}</span> : null}
            {me ? <span className="pill">Chances {chancesBadgeText}</span> : null}
            {!me ? (
              <>
                <button type="button" className="btn ghost" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Log In</button>
                <button type="button" className="btn primary" onClick={() => { setAuthMode("register"); setAuthOpen(true); }}>Sign Up</button>
              </>
            ) : (
              me.authMethod !== "external" ? <button type="button" className="btn ghost" onClick={logout}>Log Out</button> : null
            )}
            {me?.canAccessAdmin ? <a className="btn ghost" href="/admin">Admin</a> : null}
            {me?.canAccessData ? <a className="btn ghost" href="/admin/data">Data</a> : null}
          </div>
        </header>

        <section className="wccp-hero" aria-labelledby="hero-title">
          <div className="wccp-hero__content">
            <h1 id="hero-title" className="sr-only">World Cup Champion Prediction</h1>
            <div className="wccp-shared-jackpot" aria-label={`Shared Jackpot ${jackpotText}`}>
              <picture>
                <source media="(max-width: 767px)" srcSet="/images/shared-jackpot-label-mobile.png" />
                <img className="wccp-shared-jackpot__label" src="/images/shared-jackpot-label-web.png" alt="Shared Jackpot" />
              </picture>
              <strong>{jackpotText}</strong>
            </div>
            <div className="wccp-hero__actions">
              <button type="button" className="btn primary" onClick={() => scrollToSection("champion-selection")}>Pick Your Champion</button>
              <button type="button" className="btn ghost" onClick={() => scrollToSection("how-it-works")}>How It Works</button>
            </div>
          </div>
        </section>

        <section className="block invite-block">
          <div className="block-head">
            <div>
              <h3>Invite friends</h3>
            </div>
          </div>
          {activeTabUsesFixedChances ? (
            <>
              <p className="invite-note invite-note-highlight">
                {`Each successful referral increases the ${activeSplitTabName} jackpot by KES ${activeInviteAmount}.`}
              </p>
              <p className="invite-note">
                {`This tab uses a fixed prediction limit of ${fixedPredictionPerMatchTotal}, so invite rewards do not add extra chances here.`}
              </p>
            </>
          ) : (
            <>
              <p className="invite-note invite-note-highlight">
                {`Each successful referral gives you +1 voting chance and increases the ${activeSplitTabName} jackpot by KES ${activeInviteAmount}.`}
              </p>
              <p className="invite-note">Maximum: 5 rewarded referrals per account for shared-chance tabs.</p>
            </>
          )}
          <div className="invite-actions">
            <div className="invite-result">
              <span className="invite-link">{displayInviteLink || "Invite code unavailable"}</span>
              <button
                type="button"
                className="btn primary icon-copy"
                disabled={!canCopyInviteLink}
                onClick={async () => {
                  if (!displayInviteLink) {
                    showInviteCopyNotice("Invite code is unavailable.", 1800);
                    return;
                  }

                  try {
                    await navigator.clipboard.writeText(displayInviteLink);
                    showInviteCopyNotice("Invite link copied.", 1500);
                  } catch {
                    showInviteCopyNotice("Failed to copy invite link.", 1800);
                  }
                }}
              >
                <svg className="copy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M18 9H11C9.895 9 9 9.895 9 11V18C9 19.105 9.895 20 11 20H18C19.105 20 20 19.105 20 18V11C20 9.895 19.105 9 18 9Z" />
                  <path d="M15 9V6C15 4.895 14.105 4 13 4H6C4.895 4 4 4.895 4 6V13C4 14.105 4.895 15 6 15H9" />
                </svg>
              </button>
            </div>
            {inviteCopyNotice ? <p className="invite-copy-notice">{inviteCopyNotice}</p> : null}
          </div>
        </section>

        <section className="block" id="champion-selection">
          <div className="block-head">
            <div>
              <h3>Pick your champion</h3>
              <p className="section-subtitle">Select the team you predict will win the World Cup.</p>
            </div>
          </div>

          {state?.splitTabs.length ? (
            <section className="split-tab-bar" aria-label="Split jackpot tabs">
              {state.splitTabs.map((splitTab) => (
                <button
                  key={splitTab.id}
                  type="button"
                  className={`split-tab-button ${state.activeSplitTabId === splitTab.id ? "active" : ""}`}
                  onClick={() => void loadState(splitTab.id)}
                >
                  <strong>{splitTab.name}</strong>
                  <span>{splitTab.currency} {new Intl.NumberFormat("en-US").format(splitTab.currentJackpotAmountKES)}</span>
                </button>
              ))}
            </section>
          ) : null}

          <div className="match-list">
            {(state?.matches ?? []).map((match) => {
              const matchPredictions = predictionsByMatchId.get(match.id) ?? [];
              const usedTickets = matchPredictions.length;
              const remainingTickets = activeTabUsesFixedChances
                ? Math.max(0, fixedPredictionPerMatchTotal - usedTickets)
                : remainingPredictionChances;
              const closed = match.status !== "Open";
              const isCollapsible = match.status === "Settled" || match.status === "Closed";
              const isCollapsed = isCollapsible && (collapsedSettledMatches[match.id] ?? true);
              const selectedTeamId = selectedByMatch[match.id];
              const ticketsByTeam = new Map<string, number>();

              for (const prediction of matchPredictions) {
                ticketsByTeam.set(
                  prediction.teamId,
                  (ticketsByTeam.get(prediction.teamId) ?? 0) + 1,
                );
              }

              const totalPayout = matchPredictions.reduce((sum, prediction) => sum + prediction.payoutKES, 0);
              const settledCount = matchPredictions.filter((prediction) => prediction.status !== "Locked").length;

              return (
                <article key={match.id} className="match-card">
                  <div className="match-head">
                    <div>
                      <h4>{match.name}</h4>
                      <p>{match.description || "No description"}</p>
                    </div>
                    <div className="status-zone">
                      <span className={`status-badge status-${match.status.toLowerCase()}`}>{match.status}</span>
                      {isCollapsible ? (
                        <button
                          type="button"
                          className="settled-toggle"
                          onClick={() => setCollapsedSettledMatches((current) => ({
                            ...current,
                            [match.id]: !(current[match.id] ?? true),
                          }))}
                        >
                          {isCollapsed ? "Show details" : "Hide details"}
                        </button>
                      ) : null}
                      <small>Deadline: {new Date(match.predictionDeadline).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</small>
                      <small>Predictions: {match.totalPredictions}</small>
                    </div>
                  </div>

                  {isCollapsed ? (
                    <p className="collapsed-settled-note">
                      {match.status} match • Your picks {usedTickets}
                      {totalPayout > 0 ? ` • Payout ${totalPayout} KES` : ""}
                    </p>
                  ) : (
                    <>
                      <div className="team-pick-row">
                        {match.teams.map((team) => {
                          const active = selectedTeamId === team.id;
                          const lockedCount = ticketsByTeam.get(team.id) ?? 0;
                          const chosenByLock = lockedCount > 0;
                          const won = match.winningTeamId === team.id;
                          const displayTeamName = `${team.name}${lockedCount > 0 ? ` x${lockedCount}` : ""}`;
                          const teamNameClass = displayTeamName.length > 24
                            ? "team-name-line size-xs"
                            : displayTeamName.length > 18
                              ? "team-name-line size-sm"
                              : "team-name-line";
                          return (
                            <button
                              key={team.id}
                              type="button"
                              className={`team-pick ${active ? "active" : ""} ${chosenByLock ? "locked" : ""} ${won ? "winner" : ""}`}
                              disabled={closed || remainingTickets === 0}
                              onClick={() => setSelectedByMatch((prev) => ({ ...prev, [match.id]: team.id }))}
                            >
                              <img src={resolveTeamLogo(team)} alt={team.name} />
                              <span>
                                {team.country ? (
                                  <small className="team-country-line">
                                    {(COUNTRY_FLAG_MAP[team.country] ?? "🏳️")} {team.country}
                                  </small>
                                ) : null}
                                <strong className={teamNameClass}>{displayTeamName}</strong>
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="match-actions">
                        <p className="locked-note">
                          Your picks: {usedTickets}
                          {remainingTickets > 0 ? ` • Chances remaining ${remainingTickets}` : " • No chances left"}
                          {settledCount > 0 ? ` • Settled ${settledCount}` : ""}
                          {totalPayout > 0 ? ` • Payout ${totalPayout} KES` : ""}
                        </p>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={closed || remainingTickets === 0 || !selectedTeamId || submittingMatchId === match.id}
                          onClick={() => openVoteConfirm(match)}
                        >
                          {submittingMatchId === match.id ? "Locking..." : "Pick Your Champion"}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
            {(state?.matches.length ?? 0) === 0 ? <p className="empty">No champion options yet.</p> : null}
          </div>
        </section>

        <section className="block">
          <div className="block-head">
            <div>
              <h3>Prediction History</h3>
              <p className="section-subtitle">Your submitted champion predictions.</p>
            </div>
            <span>{predictions.length} records</span>
          </div>
          <div className="vote-history-list">
            {historyPredictions.map((prediction) => {
              const credit = creditsByPredictionId.get(prediction.id);
              const payoutKES = credit?.payoutKES ?? prediction.payoutKES;
              const payoutCurrency = credit?.currency ?? "KES";
              const payoutSettledAt = credit?.settledAt ?? prediction.settledAt;

              return (
                <div key={prediction.id} className="vote-history-row">
                  <strong className="vote-history-match">{prediction.matchName || "-"}</strong>
                  {prediction.splitTabName ? <span>- [{prediction.splitTabName}]</span> : null}
                  <span>- {prediction.teamName || "-"}</span>
                  <span>- {new Date(prediction.lockedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</span>
                  {payoutKES > 0 ? (
                    <>
                      <span className="vote-history-success">- Prediction successful!</span>
                      <span>
                        - Credit: +{payoutCurrency} {payoutKES}
                        {payoutSettledAt
                          ? ` (${new Date(payoutSettledAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })})`
                          : ""}
                      </span>
                    </>
                  ) : null}
                </div>
              );
            })}
            {historyPredictions.length === 0 ? <p className="empty history-empty">No predictions yet</p> : null}
          </div>
        </section>

        <section className="block rules-block" id="how-it-works">
          <div className="rules-header">
            <h3>How it works</h3>
            <p className="section-subtitle">Key rules and prediction details.</p>
          </div>
          <details open>
            <summary>Key Rules Summary</summary>
          <div className="rules-content">
            <article className="rules-item">
              <h4>1. Event Overview</h4>
              <p>
                KE7 is launching the "FIFA World Cup Champion Prediction Event," where members can
                predict the team that will ultimately win the FIFA World Cup during the event period.
              </p>
              <p>
                After the event concludes, participants who correctly predict the champion team will share
                the prize pool in accordance with these Terms and Conditions.
              </p>
              <p>
                This is a promotional member rewards event and does not involve betting, gambling,
                wagering, or odds of any kind.
              </p>
            </article>

            <article className="rules-item">
              <h4>2. Event Period</h4>
              <ul>
                <li>Event Start Date: Effective immediately.</li>
                <li>Prediction Deadline: July 3.</li>
                <li>No predictions, modifications, or cancellations will be accepted after the deadline.</li>
              </ul>
            </article>

            <article className="rules-item">
              <h4>3. Eligibility</h4>
              <p>Participants must meet all of the following requirements:</p>
              <ul>
                <li>Be a registered KE7 member.</li>
                <li>Be able to log in to their KE7 account during the event period.</li>
                <li>Participate using their own personal account only.</li>
              </ul>
            </article>

            <article className="rules-item">
              <h4>4. How to Obtain Prediction Chances</h4>
              <p>Each member may receive a maximum of six (6) prediction chances.</p>

              <h5>4.1 New Member Reward</h5>
              <ul>
                <li>Upon successful registration as a KE7 member, participants will receive one (1) prediction chance.</li>
                <li>No deposit, purchase, or spending is required to participate.</li>
              </ul>

              <h5>4.2 Referral Reward</h5>
              <ul>
                <li>Members who successfully invite a friend to register as a KE7 member through their unique invite link during the participation period of this FIFA World Cup Champion Prediction Event, and before the Round of 32 prediction event is launched, will receive one (1) additional prediction chance for each eligible successful referral.</li>
                <li>After the Round of 32 prediction event is launched, successful referrals will only increase the applicable event Jackpot by KES and will not grant the referring member any additional prediction chances.</li>
                <li>
                  For split tabs that use shared prediction chances, each successful referral also grants one (1) additional prediction chance.
                </li>
                <li>
                  For split tabs that use fixed prediction mode:
                  <ul>
                    <li>The tab uses its configured fixed prediction count; and</li>
                    <li>Invite rewards do not add extra prediction chances to that tab.</li>
                  </ul>
                </li>
                <li>The invite-based Jackpot contribution is added to each split tab prize pool and will not be credited directly to the referring member's account.</li>
                <li>Each member may receive rewards for a maximum of five (5) successful referrals on shared-chance tabs.</li>
              </ul>

              <h5>4.3 Maximum Prediction Chances</h5>
              <ul>
                <li>Shared-chance tabs continue to use the existing accumulated chance model.</li>
                <li>Fixed-mode tabs use their own configured prediction limit instead of invite-based chance growth.</li>
              </ul>

              <h5>4.4 Round of 32 and Subsequent Prediction Events</h5>
              <ul>
                <li>Starting from the FIFA World Cup Round of 32, KE7 may launch separate prediction events for the knockout-stage matches.</li>
                <li>These Round of 32 and subsequent prediction events will be treated as separate promotional events and may be subject to their own event periods, prediction rules, participation requirements, prize distribution methods, and applicable Terms and Conditions.</li>
                <li>
                  For referrals successfully completed after the launch of the Round of 32 prediction event:
                  <ul>
                    <li>Each eligible successful referral will continue to add KES to the applicable event Jackpot;</li>
                    <li>The referring member will not receive any additional prediction chances for that referral; and</li>
                    <li>Any unused prediction chances obtained under the FIFA World Cup Champion Prediction Event cannot be transferred to, combined with, or used in the Round of 32 or any subsequent prediction event, unless otherwise expressly announced by KE7.</li>
                  </ul>
                </li>
                <li>The referral reward of one (1) additional prediction chance stated in Section 4.2 applies only to eligible referrals completed during the participation period of the FIFA World Cup Champion Prediction Event and before the Round of 32 prediction event is launched.</li>
              </ul>
            </article>

            <article className="rules-item">
              <h4>5. Prediction Rules</h4>
              <ul>
                <li>Each prediction chance may be used to select one team as the predicted FIFA World Cup Champion.</li>
                <li>Once a prediction is submitted, it will be considered final.</li>
                <li>Submitted predictions cannot be modified, canceled, or replaced.</li>
                <li>
                  Members with up to six (6) prediction chances may:
                  <ul>
                    <li>Predict the same team up to six (6) times; or</li>
                    <li>Predict different teams using separate prediction chances.</li>
                  </ul>
                </li>
              </ul>
            </article>

            <article className="rules-item">
              <h4>6. Prize Pool Distribution</h4>

              <h5>6.1 Jackpot Composition</h5>
              <p>
                Each split tab prize pool consists of its configured base jackpot amount together with any additional amounts generated through successful referrals during the event period.
              </p>
              <p>Each eligible successful referral increases every split tab jackpot by that split tab's configured invite amount.</p>
              <p>
                The current jackpot amount displayed on the KE7 platform is specific to the selected split tab. The final selected-tab jackpot amount confirmed by KE7 after the prediction deadline will be used for prize distribution.
              </p>

              <h5>6.2 Official Champion Determination</h5>
              <p>The official FIFA World Cup Champion announced by FIFA will be deemed the final and official result.</p>

              <h5>6.3 Winning Eligibility</h5>
              <p>Participants will be considered winners if:</p>
              <ul>
                <li>Their prediction was submitted before the prediction deadline; and</li>
                <li>The predicted team matches the official FIFA World Cup Champion.</li>
              </ul>

              <h5>6.4 Prize Distribution Method</h5>
              <p>The total prize pool will be equally divided among all winning prediction entries.</p>
              <p>Calculation Formula:</p>
              <p className="rules-formula">Prize per Winning Entry = Total Prize Pool / Total Number of Winning Entries</p>

              <h5>6.5 Example</h5>
              <p>Assuming:</p>
              <ul>
                <li>Total Prize Pool: KES 5,000,000</li>
                <li>Total Winning Entries: 200</li>
              </ul>
              <p>Then:</p>
              <p className="rules-formula">Prize per Winning Entry = KES 25,000</p>
              <p>If a member holds two (2) winning entries:</p>
              <p className="rules-formula">KES 25,000 x 2 = KES 50,000</p>
            </article>

            <article className="rules-item">
              <h4>7. Winner Announcement and Prize Distribution</h4>
              <ul>
                <li>Event results will be announced on KE7's official platform after the event concludes.</li>
                <li>Winner announcements and prize distribution schedules will be subject to official KE7 announcements.</li>
                <li>Winners who fail to provide complete and accurate account information, or who cannot be contacted for prize fulfillment purposes, may forfeit their eligibility to receive prizes.</li>
              </ul>
            </article>

            <article className="rules-item">
              <h4>8. Important Notes</h4>
              <ol>
                <li>Each participant may only use their own personal information and account to participate in the event.</li>
                <li>Multiple registrations, fraudulent referrals, or any actions that may compromise the fairness of the event are strictly prohibited.</li>
                <li>KE7 reserves the right to disqualify any participant found to be involved in suspicious registrations, duplicate accounts, automated activities, fraudulent behavior, or violations of these Terms and Conditions.</li>
                <li>KE7 reserves the right to modify, suspend, or adjust the event due to system maintenance, network issues, force majeure events, or other circumstances beyond its reasonable control.</li>
                <li>KE7 reserves the right to review, interpret, amend, suspend, or terminate this event at any time. Any changes will be announced through official KE7 channels without prior individual notice.</li>
              </ol>
            </article>

            <article className="rules-item">
              <h4>9. Reservation of Rights</h4>
              <p>KE7 reserves the final right of interpretation regarding this event and its Terms and Conditions.</p>
              <p>Any matters not covered herein shall be handled in accordance with KE7's official announcements and applicable regulations.</p>
            </article>
          </div>
          </details>
        </section>
      </div>

      {message && !isInviteCopyMessage ? <div className="page-message">{message}</div> : null}

      {voteConfirm ? (
        <div className="modal-backdrop" onClick={() => setVoteConfirm(null)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Confirm Vote</h3>
            <div className="confirm-summary">
              <p>Match: {voteConfirm.matchName}</p>
              <p>Team: {voteConfirm.teamName}</p>
            </div>
            <div className="confirm-actions">
              <button type="button" className="btn ghost" onClick={() => setVoteConfirm(null)}>Cancel</button>
              <button
                type="button"
                className="btn primary"
                disabled={submittingMatchId === voteConfirm.matchId}
                onClick={() => void submitPrediction(voteConfirm.matchId)}
              >
                {submittingMatchId === voteConfirm.matchId ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {authOpen ? (
        <div className="modal-backdrop" onClick={() => setAuthOpen(false)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>{authMode === "login" ? "Log In" : "Sign Up"}</h3>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+2547XXXXXXXX or 07XXXXXXXX"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
            />
            <button type="button" className="btn primary" onClick={() => void submitAuth()}>
              {authMode === "login" ? "Log In" : "Sign Up"}
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
