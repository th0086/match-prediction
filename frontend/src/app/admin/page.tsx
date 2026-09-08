"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "../../lib/apiClient";

const DatePicker = dynamic<any>(
  () => import("react-datepicker").then((mod) => mod.default as any),
  { ssr: false },
);

type Team = {
  id: string;
  name: string;
  country: string | null;
  iconUrl: string | null;
  isActive: boolean;
};

const COUNTRY_OPTIONS: Array<{ name: string; flag: string }> = [
  { name: "Mexico", flag: "🇲🇽" },
  { name: "South Africa", flag: "🇿🇦" },
  { name: "Korea Republic", flag: "🇰🇷" },
  { name: "Czechia", flag: "🇨🇿" },
  { name: "Canada", flag: "🇨🇦" },
  { name: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { name: "Qatar", flag: "🇶🇦" },
  { name: "Switzerland", flag: "🇨🇭" },
  { name: "Brazil", flag: "🇧🇷" },
  { name: "Morocco", flag: "🇲🇦" },
  { name: "Haiti", flag: "🇭🇹" },
  { name: "Scotland", flag: "🏴" },
  { name: "United States", flag: "🇺🇸" },
  { name: "Paraguay", flag: "🇵🇾" },
  { name: "Australia", flag: "🇦🇺" },
  { name: "Turkey", flag: "🇹🇷" },
  { name: "Germany", flag: "🇩🇪" },
  { name: "Curacao", flag: "🇨🇼" },
  { name: "Cote d'Ivoire", flag: "🇨🇮" },
  { name: "Ecuador", flag: "🇪🇨" },
  { name: "Netherlands", flag: "🇳🇱" },
  { name: "Japan", flag: "🇯🇵" },
  { name: "Sweden", flag: "🇸🇪" },
  { name: "Tunisia", flag: "🇹🇳" },
  { name: "Belgium", flag: "🇧🇪" },
  { name: "Egypt", flag: "🇪🇬" },
  { name: "Iran", flag: "🇮🇷" },
  { name: "New Zealand", flag: "🇳🇿" },
  { name: "Spain", flag: "🇪🇸" },
  { name: "Cabo Verde", flag: "🇨🇻" },
  { name: "Saudi Arabia", flag: "🇸🇦" },
  { name: "Uruguay", flag: "🇺🇾" },
  { name: "France", flag: "🇫🇷" },
  { name: "Senegal", flag: "🇸🇳" },
  { name: "Iraq", flag: "🇮🇶" },
  { name: "Norway", flag: "🇳🇴" },
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Algeria", flag: "🇩🇿" },
  { name: "Austria", flag: "🇦🇹" },
  { name: "Jordan", flag: "🇯🇴" },
  { name: "Portugal", flag: "🇵🇹" },
  { name: "Congo DR", flag: "🇨🇩" },
  { name: "Uzbekistan", flag: "🇺🇿" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "England", flag: "🏴" },
  { name: "Croatia", flag: "🇭🇷" },
  { name: "Ghana", flag: "🇬🇭" },
  { name: "Panama", flag: "🇵🇦" },
];

function getCountryDisplay(country: string | null) {
  if (!country) {
    return "-";
  }

  const found = COUNTRY_OPTIONS.find((item) => item.name === country);
  if (!found) {
    return country;
  }

  return `${found.flag} ${found.name}`;
}

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
  teamIds: string[];
};

type MatchDeleteTarget = {
  id: string;
  name: string;
};

type WinnerRow = {
  predictionId: string;
  userId: string;
  phone: string;
  matchName: string;
  selectedTeamName: string;
  status: "Locked" | "Won" | "Lost";
  lockedAt: string;
  winningTeamName: string;
  payoutKES: number;
};

type InviteStatusRow = {
  userId: string;
  phone: string;
  predictionChances: number;
  usedPredictionChances: number;
  validInviteCount: number;
  totalSuccessfulInviteCount: number;
};

type SplitTab = {
  id: string;
  name: string;
  baseJackpotAmountKES: number;
  inviteAmountKES: number;
  fixedPredictionModeEnabled: boolean;
  fixedPredictionCount: number | null;
  isEnabled: boolean;
};

type MeResponse = {
  canAccessAdmin: boolean;
};

const RECORDS_PAGE_SIZE = 50;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [jackpotIncrementAmount, setJackpotIncrementAmount] = useState("123");
  const [dataPin, setDataPin] = useState("1234");
  const [teams, setTeams] = useState<Team[]>([]);
  const [splitTabs, setSplitTabs] = useState<SplitTab[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [inviteStats, setInviteStats] = useState<InviteStatusRow[]>([]);
  const [teamName, setTeamName] = useState("");
  const [teamCountry, setTeamCountry] = useState("");
  const [teamIconUrl, setTeamIconUrl] = useState("");
  const [teamActive, setTeamActive] = useState(true);
  const [teamFile, setTeamFile] = useState<File | null>(null);
  const [teamFileInputKey, setTeamFileInputKey] = useState(0);
  const [teamsListCollapsed, setTeamsListCollapsed] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [editingTeamCountry, setEditingTeamCountry] = useState("");
  const [editingTeamIconUrl, setEditingTeamIconUrl] = useState("");
  const [editingTeamActive, setEditingTeamActive] = useState(true);
  const [editingTeamFile, setEditingTeamFile] = useState<File | null>(null);
  const [editingTeamFileInputKey, setEditingTeamFileInputKey] = useState(0);
  const [splitTabName, setSplitTabName] = useState("");
  const [splitTabBaseJackpotAmount, setSplitTabBaseJackpotAmount] = useState("5000000");
  const [splitTabInviteAmount, setSplitTabInviteAmount] = useState("50");
  const [splitTabFixedModeEnabled, setSplitTabFixedModeEnabled] = useState(false);
  const [splitTabFixedPredictionCount, setSplitTabFixedPredictionCount] = useState("1");
  const [editingSplitTabId, setEditingSplitTabId] = useState<string | null>(null);
  const [matchName, setMatchName] = useState("");
  const [matchDescription, setMatchDescription] = useState("");
  const [matchSplitTabId, setMatchSplitTabId] = useState("");
  const [matchDeadlineAt, setMatchDeadlineAt] = useState<Date | null>(null);
  const [matchPublished, setMatchPublished] = useState(true);
  const [matchesListCollapsed, setMatchesListCollapsed] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [settleSelection, setSettleSelection] = useState<Record<string, string>>({});
  const [injectTeamSelection, setInjectTeamSelection] = useState<Record<string, string>>({});
  const [injectQuantitySelection, setInjectQuantitySelection] = useState<Record<string, string>>({});
  const [matchDeleteTarget, setMatchDeleteTarget] = useState<MatchDeleteTarget | null>(null);
  const [winnerPhoneFilter, setWinnerPhoneFilter] = useState("");
  const [winnerStatusFilter, setWinnerStatusFilter] = useState<"" | "Locked" | "Won" | "Lost">("");
  const [winnerFromFilter, setWinnerFromFilter] = useState<Date | null>(null);
  const [winnerToFilter, setWinnerToFilter] = useState<Date | null>(null);
  const [winnerOffset, setWinnerOffset] = useState(0);
  const [winnerTotal, setWinnerTotal] = useState(0);
  const [winnerJumpPage, setWinnerJumpPage] = useState("1");
  const [invitePhoneFilter, setInvitePhoneFilter] = useState("");
  const [inviteOffset, setInviteOffset] = useState(0);
  const [inviteTotal, setInviteTotal] = useState(0);
  const [inviteJumpPage, setInviteJumpPage] = useState("1");

  const selectableTeams = useMemo(() => teams.filter((team) => team.isActive), [teams]);
  const teamLookup = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const splitTabLookup = useMemo(() => new Map(splitTabs.map((splitTab) => [splitTab.id, splitTab])), [splitTabs]);

  useEffect(() => {
    const bootstrap = async () => {
      const meRes = await apiFetch("/api/auth/me", { cache: "no-store" });
      if (!meRes.ok) {
        setAuthorized(false);
        setMessage("Please log in as super admin.");
        return;
      }

      const mePayload = await parseJson<MeResponse>(meRes);
      if (!mePayload?.canAccessAdmin) {
        setAuthorized(false);
        setMessage("Super admin permission required.");
        return;
      }

      setAuthorized(true);
      await loadAll();
    };

    void bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loadWinners = async (offset?: number) => {
    const query = buildWinnersQueryString({ includePagination: true, offset });
    const winnersRes = await apiFetch(`/api/admin/winners?${query}`);
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

  const loadInviteStats = async (offset?: number) => {
    const query = buildInviteStatsQueryString(offset);
    const response = await apiFetch(`/api/admin/invite-stats?${query}`);
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

  const loadAll = async () => {
    const [jackpotRes, dataPinRes, teamsRes, splitTabsRes, matchesRes] = await Promise.all([
      apiFetch("/api/admin/jackpot-increment"),
      apiFetch("/api/admin/data-pin"),
      apiFetch("/api/admin/teams"),
      apiFetch("/api/admin/split-tabs"),
      apiFetch("/api/admin/matches"),
    ]);

    if (jackpotRes.ok) {
      const jackpotPayload = await parseJson<{ jackpotIncrementAmount: number }>(jackpotRes);
      if (jackpotPayload) {
        setJackpotIncrementAmount(String(jackpotPayload.jackpotIncrementAmount));
      }
    }

    if (dataPinRes.ok) {
      const dataPinPayload = await parseJson<{ dataPin: string }>(dataPinRes);
      if (dataPinPayload?.dataPin) {
        setDataPin(dataPinPayload.dataPin);
      }
    }

    if (teamsRes.ok) {
      const teamsPayload = await parseJson<Team[]>(teamsRes);
      if (teamsPayload) {
        setTeams(teamsPayload);
      }
    }

    if (splitTabsRes.ok) {
      const splitTabsPayload = await parseJson<SplitTab[]>(splitTabsRes);
      if (splitTabsPayload) {
        setSplitTabs(splitTabsPayload);
        if (!matchSplitTabId && splitTabsPayload[0]?.id) {
          setMatchSplitTabId(splitTabsPayload[0].id);
        }
      }
    }

    if (matchesRes.ok) {
      const matchesPayload = await parseJson<Match[]>(matchesRes);
      if (matchesPayload) {
        setMatches(matchesPayload);
      }
    }

    await Promise.all([
      loadWinners(0),
      loadInviteStats(0),
    ]);
  };

  const saveJackpotIncrement = async () => {
    const response = await apiFetch("/api/admin/jackpot-increment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(jackpotIncrementAmount) }),
    });

    if (!response.ok) {
      setMessage("Failed to update jackpot increment.");
      return;
    }

    setMessage("Jackpot increment updated.");
  };

  const saveDataPin = async () => {
    if (!/^\d{4}$/.test(dataPin)) {
      setMessage("Data PIN must be exactly 4 digits.");
      return;
    }

    const response = await apiFetch("/api/admin/data-pin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: dataPin }),
    });

    if (!response.ok) {
      setMessage("Failed to update Data PIN.");
      return;
    }

    setMessage("Data PIN updated.");
  };

  const uploadTeamIcon = async () => {
    if (!teamFile) {
      setMessage("Please choose a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", teamFile);

    const response = await apiFetch("/api/admin/teams/upload-icon", {
      method: "POST",
      body: formData,
    });

    const payload = await parseJson<{ url?: string; message?: string }>(response);
    if (!response.ok || !payload?.url) {
      setMessage(payload?.message ?? "Icon upload failed.");
      return;
    }

    setTeamIconUrl(payload.url);
    setTeamFile(null);
    setTeamFileInputKey((current) => current + 1);
    setMessage("Icon uploaded. URL auto-filled.");
  };

  const startEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
    setEditingTeamCountry(team.country ?? "");
    setEditingTeamIconUrl(team.iconUrl ?? "");
    setEditingTeamActive(team.isActive);
    setEditingTeamFile(null);
    setEditingTeamFileInputKey((current) => current + 1);
  };

  const cancelEditTeam = () => {
    setEditingTeamId(null);
    setEditingTeamName("");
    setEditingTeamCountry("");
    setEditingTeamIconUrl("");
    setEditingTeamActive(true);
    setEditingTeamFile(null);
    setEditingTeamFileInputKey((current) => current + 1);
  };

  const uploadEditingTeamIcon = async () => {
    if (!editingTeamFile) {
      setMessage("Please choose a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", editingTeamFile);

    const response = await apiFetch("/api/admin/teams/upload-icon", {
      method: "POST",
      body: formData,
    });

    const payload = await parseJson<{ url?: string; message?: string }>(response);
    if (!response.ok || !payload?.url) {
      setMessage(payload?.message ?? "Icon upload failed.");
      return;
    }

    setEditingTeamIconUrl(payload.url);
    setEditingTeamFile(null);
    setEditingTeamFileInputKey((current) => current + 1);
    setMessage("Edit icon uploaded. URL auto-filled.");
  };

  const resetSplitTabForm = () => {
    setEditingSplitTabId(null);
    setSplitTabName("");
    setSplitTabBaseJackpotAmount("5000000");
    setSplitTabInviteAmount("50");
    setSplitTabFixedModeEnabled(false);
    setSplitTabFixedPredictionCount("1");
  };

  const startEditSplitTab = (splitTab: SplitTab) => {
    setEditingSplitTabId(splitTab.id);
    setSplitTabName(splitTab.name);
    setSplitTabBaseJackpotAmount(String(splitTab.baseJackpotAmountKES));
    setSplitTabInviteAmount(String(splitTab.inviteAmountKES));
    setSplitTabFixedModeEnabled(splitTab.fixedPredictionModeEnabled);
    setSplitTabFixedPredictionCount(String(splitTab.fixedPredictionCount ?? 1));
  };

  const saveSplitTab = async () => {
    if (!splitTabName.trim()) {
      setMessage("Split tab name is required.");
      return;
    }
    if (splitTabFixedModeEnabled && Number(splitTabFixedPredictionCount) < 1) {
      setMessage("Fixed prediction count must be at least 1.");
      return;
    }

    const endpoint = editingSplitTabId ? `/api/admin/split-tabs/${editingSplitTabId}` : "/api/admin/split-tabs";
    const method = editingSplitTabId ? "PATCH" : "POST";
    const response = await apiFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: splitTabName,
        baseJackpotAmountKES: Number(splitTabBaseJackpotAmount),
        inviteAmountKES: Number(splitTabInviteAmount),
        fixedPredictionModeEnabled: splitTabFixedModeEnabled,
        fixedPredictionCount: splitTabFixedModeEnabled ? Number(splitTabFixedPredictionCount) : undefined,
      }),
    });

    const payload = await parseJson<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? "Failed to save split tab.");
      return;
    }

    setMessage(editingSplitTabId ? "Split tab updated." : "Split tab created.");
    resetSplitTabForm();
    await loadAll();
  };

  const toggleSplitTabEnabled = async (splitTab: SplitTab) => {
    const nextEnabled = !splitTab.isEnabled;
    const confirmed = window.confirm(`${nextEnabled ? "Enable" : "Disable"} split tab ${splitTab.name}?`);
    if (!confirmed) {
      return;
    }

    const response = await apiFetch(`/api/admin/split-tabs/${splitTab.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: nextEnabled }),
    });
    const payload = await parseJson<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? `Failed to ${nextEnabled ? "enable" : "disable"} split tab.`);
      return;
    }

    setMessage(`Split tab ${nextEnabled ? "enabled" : "disabled"}.`);
    await loadAll();
  };

  const saveEditingTeam = async () => {
    if (!editingTeamId) {
      return;
    }

    const response = await apiFetch(`/api/admin/teams/${editingTeamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingTeamName,
        country: editingTeamCountry,
        iconUrl: editingTeamIconUrl,
        isActive: editingTeamActive,
      }),
    });

    const payload = await parseJson<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? "Failed to update team.");
      return;
    }

    setMessage("Team updated.");
    await loadAll();
    cancelEditTeam();
  };

  const createTeam = async () => {
    const response = await apiFetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: teamName,
        country: teamCountry,
        iconUrl: teamIconUrl,
        isActive: teamActive,
      }),
    });

    const payload = await parseJson<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? "Failed to create team.");
      return;
    }

    setTeamName("");
    setTeamCountry("");
    setTeamIconUrl("");
    setTeamFile(null);
    setTeamFileInputKey((current) => current + 1);
    setTeamActive(true);
    setMessage("Team created.");
    await loadAll();
  };

  const createMatch = async () => {
    if (selectedTeams.length < 2) {
      setMessage("Please select at least 2 teams.");
      return;
    }

    if (!matchSplitTabId) {
      setMessage("Please select a split tab.");
      return;
    }

    if (!matchDeadlineAt) {
      setMessage("Please select match deadline date and time.");
      return;
    }

    const deadlineIso = matchDeadlineAt.toISOString();
    const response = await apiFetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: matchName,
        description: matchDescription,
        splitTabId: matchSplitTabId,
        teamIds: selectedTeams,
        predictionDeadline: deadlineIso,
        isPublished: matchPublished,
      }),
    });

    const payload = await parseJson<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? "Failed to create match.");
      return;
    }

    setMatchName("");
    setMatchDescription("");
    setMatchSplitTabId(splitTabs[0]?.id ?? "");
    setMatchDeadlineAt(null);
    setSelectedTeams([]);
    setMatchPublished(true);
    setMessage("Match created.");
    await loadAll();
  };

  const settleMatch = async (matchId: string) => {
    const winningTeamId = settleSelection[matchId];
    if (!winningTeamId) {
      setMessage("Please choose a winning team first.");
      return;
    }

    const response = await apiFetch(`/api/admin/matches/${matchId}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winningTeamId }),
    });

    const payload = await parseJson<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? "Failed to settle match.");
      return;
    }

    setMessage("Match settled.");
    await loadAll();
  };

  const addMatchPredictions = async (match: Match) => {
    const selectedTeamId = injectTeamSelection[match.id] ?? "";
    const quantityRaw = injectQuantitySelection[match.id] ?? "1";
    const quantity = Number.parseInt(quantityRaw, 10);

    if (!selectedTeamId) {
      setMessage("Please choose a team to inject predictions.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      setMessage("Prediction quantity must be at least 1.");
      return;
    }

    const selectedTeam = teamLookup.get(selectedTeamId);
    const confirmed = window.confirm(
      `Add ${quantity} predictions to ${selectedTeam?.name ?? "selected team"} for match ${match.name}?`,
    );
    if (!confirmed) {
      return;
    }

    const response = await apiFetch(`/api/admin/matches/${match.id}/inject-predictions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: selectedTeamId, quantity }),
    });

    const payload = await parseJson<{ message?: string; added?: number }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? "Failed to add predictions.");
      return;
    }

    setMessage(`Added ${payload?.added ?? quantity} predictions.`);
    await loadAll();
  };

  const deleteSettledMatch = async () => {
    if (!matchDeleteTarget) {
      return;
    }

    const response = await apiFetch(`/api/admin/matches/${matchDeleteTarget.id}`, {
      method: "DELETE",
    });

    const payload = await parseJson<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(payload?.message ?? "Failed to delete settled match.");
      return;
    }

    setMatchDeleteTarget(null);
    setMessage("Settled match deleted.");
    await loadAll();
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams((current) => {
      if (current.includes(teamId)) {
        return current.filter((item) => item !== teamId);
      }
      return [...current, teamId];
    });
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
          <p>{message || "Please login with super admin account."}</p>
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
          <span className="brand-mark">ADM</span>
          <div>
            <h1>Admin Console</h1>
            <small>Manage teams, matches, settlement and winners</small>
          </div>
        </div>
        <div className="top-actions">
          <a className="btn ghost" href="/admin/data">Data</a>
          <a className="btn ghost" href="/">Back Home</a>
        </div>
      </header>

      <section className="block admin-block">
        <div className="block-head">
          <h3>Jackpot Increment</h3>
        </div>
        <div className="row-inline">
          <input
            type="number"
            min="0"
            step="1"
            value={jackpotIncrementAmount}
            onChange={(event) => setJackpotIncrementAmount(event.target.value)}
            placeholder="KES per second"
          />
          <button type="button" className="btn primary" onClick={() => void saveJackpotIncrement()}>Save</button>
        </div>
      </section>

      <section className="block admin-block">
        <div className="block-head">
          <h3>Data PIN Setting</h3>
        </div>
        <div className="row-inline">
          <input
            type="password"
            inputMode="numeric"
            pattern="\\d{4}"
            maxLength={4}
            value={dataPin}
            onChange={(event) => setDataPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="4-digit PIN"
          />
          <button type="button" className="btn primary" onClick={() => void saveDataPin()}>Save</button>
        </div>
        <small>Data page entry requires this 4-digit PIN.</small>
      </section>

      <section className="block admin-block">
        <div className="block-head">
          <h3>{editingSplitTabId ? "Edit Split Tab" : "Create Split Tab"}</h3>
        </div>
        <div className="form-grid">
          <input value={splitTabName} onChange={(event) => setSplitTabName(event.target.value)} placeholder="Split tab name" />
          <input
            type="number"
            min="0"
            step="1"
            value={splitTabBaseJackpotAmount}
            onChange={(event) => setSplitTabBaseJackpotAmount(event.target.value)}
            placeholder="Base jackpot amount"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={splitTabInviteAmount}
            onChange={(event) => setSplitTabInviteAmount(event.target.value)}
            placeholder="Invite amount"
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={splitTabFixedModeEnabled}
              onChange={(event) => setSplitTabFixedModeEnabled(event.target.checked)}
            />
            Fixed prediction mode
          </label>
          {splitTabFixedModeEnabled ? (
            <input
              type="number"
              min="1"
              step="1"
              value={splitTabFixedPredictionCount}
              onChange={(event) => setSplitTabFixedPredictionCount(event.target.value)}
              placeholder="Fixed prediction count"
            />
          ) : null}
          <div className="row-inline">
            <button type="button" className="btn primary" onClick={() => void saveSplitTab()}>
              {editingSplitTabId ? "Save Split Tab" : "Create Split Tab"}
            </button>
            {editingSplitTabId ? <button type="button" className="btn ghost" onClick={resetSplitTabForm}>Cancel</button> : null}
          </div>
        </div>

        <div className="block-head" style={{ marginTop: 12, marginBottom: 0 }}>
          <h3>Split Tabs ({splitTabs.length})</h3>
        </div>
        <div className="table-list">
          {splitTabs.map((splitTab) => (
            <div className="table-row stretch" key={splitTab.id}>
              <div>
                <strong>{splitTab.name}</strong>
                <p>Base Jackpot: KES {splitTab.baseJackpotAmountKES}</p>
                <p>Invite Amount: KES {splitTab.inviteAmountKES}</p>
                <p>Status: {splitTab.isEnabled ? "Enabled" : "Disabled"}</p>
                <p>
                  Mode: {splitTab.fixedPredictionModeEnabled
                    ? `Fixed (${splitTab.fixedPredictionCount ?? 0})`
                    : "Shared Chances"}
                </p>
              </div>
              <div className="row-inline">
                <button type="button" className="btn ghost" onClick={() => startEditSplitTab(splitTab)}>Edit</button>
                <button type="button" className="btn ghost" onClick={() => void toggleSplitTabEnabled(splitTab)}>
                  {splitTab.isEnabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="block admin-block">
        <div className="block-head">
          <h3>Create Team</h3>
        </div>
        <div className="form-grid">
          <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" />
          <select value={teamCountry} onChange={(event) => setTeamCountry(event.target.value)}>
            <option value="">Select country</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.name} value={country.name}>{country.flag} {country.name}</option>
            ))}
          </select>
          <input value={teamIconUrl} onChange={(event) => setTeamIconUrl(event.target.value)} placeholder="Icon URL" />
          <div className="row-inline">
            <input
              key={teamFileInputKey}
              type="file"
              accept="image/*"
              onChange={(event) => setTeamFile(event.target.files?.[0] ?? null)}
            />
            <button type="button" className="btn ghost" onClick={() => void uploadTeamIcon()}>Upload Icon</button>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={teamActive} onChange={(event) => setTeamActive(event.target.checked)} />
            Active
          </label>
          <button type="button" className="btn primary" onClick={() => void createTeam()}>Create Team</button>
        </div>

        <div className="block-head" style={{ marginTop: 12, marginBottom: 0 }}>
          <h3>Created Teams ({teams.length})</h3>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setTeamsListCollapsed((current) => !current)}
          >
            {teamsListCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        {!teamsListCollapsed ? (
          <div className="table-list">
            {teams.map((team) => (
              <div className="table-row stretch" key={team.id}>
                <strong>{team.name}</strong>
                <span>{getCountryDisplay(team.country)}</span>
                <span>{team.isActive ? "Active" : "Inactive"}</span>
                <img src={team.iconUrl || "/icon.png"} alt={team.name} className="mini-icon" />
                <button type="button" className="btn ghost" onClick={() => startEditTeam(team)}>Edit</button>
              </div>
            ))}
          </div>
        ) : null}

        {editingTeamId ? (
          <div className="form-grid">
            <h3>Edit Team</h3>
            <input
              value={editingTeamName}
              onChange={(event) => setEditingTeamName(event.target.value)}
              placeholder="Team name"
            />
            <select value={editingTeamCountry} onChange={(event) => setEditingTeamCountry(event.target.value)}>
              <option value="">Select country</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.name} value={country.name}>{country.flag} {country.name}</option>
              ))}
            </select>
            <input
              value={editingTeamIconUrl}
              onChange={(event) => setEditingTeamIconUrl(event.target.value)}
              placeholder="Icon URL"
            />
            <div className="row-inline">
              <input
                key={editingTeamFileInputKey}
                type="file"
                accept="image/*"
                onChange={(event) => setEditingTeamFile(event.target.files?.[0] ?? null)}
              />
              <button type="button" className="btn ghost" onClick={() => void uploadEditingTeamIcon()}>
                Upload Icon
              </button>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={editingTeamActive}
                onChange={(event) => setEditingTeamActive(event.target.checked)}
              />
              Active
            </label>
            <div className="row-inline">
              <button type="button" className="btn primary" onClick={() => void saveEditingTeam()}>Save Team</button>
              <button type="button" className="btn ghost" onClick={cancelEditTeam}>Cancel</button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="block admin-block">
        <div className="block-head">
          <h3>Create Match</h3>
        </div>
        <div className="form-grid">
          <input value={matchName} onChange={(event) => setMatchName(event.target.value)} placeholder="Match name" />
          <textarea value={matchDescription} onChange={(event) => setMatchDescription(event.target.value)} placeholder="Match description" />
          <select value={matchSplitTabId} onChange={(event) => setMatchSplitTabId(event.target.value)}>
            <option value="">Select split tab</option>
            {splitTabs.map((splitTab) => (
              <option key={splitTab.id} value={splitTab.id}>{splitTab.name}</option>
            ))}
          </select>
          <DatePicker
            selected={matchDeadlineAt}
            onChange={(value: Date | null) => setMatchDeadlineAt(value)}
            showTimeSelect
            timeIntervals={5}
            timeCaption="Time"
            dateFormat="yyyy/MM/dd HH:mm"
            placeholderText="Select deadline"
            className="date-time-picker-input"
            popperClassName="date-time-picker-popper"
          />
          <label className="checkbox-row">
            <input type="checkbox" checked={matchPublished} onChange={(event) => setMatchPublished(event.target.checked)} />
            Published
          </label>
          <div className="team-selector">
            {selectableTeams.map((team) => (
              <label key={team.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedTeams.includes(team.id)}
                  onChange={() => toggleTeamSelection(team.id)}
                />
                {team.name}
              </label>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={() => void createMatch()}>Create Match</button>
        </div>

        <div className="block-head" style={{ marginTop: 12, marginBottom: 0 }}>
          <h3>Created Matches ({matches.length})</h3>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setMatchesListCollapsed((current) => !current)}
          >
            {matchesListCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        {!matchesListCollapsed ? (
          <div className="table-list">
            {matches.map((match) => (
              <div className="table-row stretch" key={match.id}>
                <div>
                  <strong>{match.name}</strong>
                  <p>{match.description || "No description"}</p>
                  <p>Split Tab: {splitTabLookup.get(match.splitTabId ?? "")?.name ?? "-"}</p>
                  <small>Status: {match.status} | Published: {match.isPublished ? "Yes" : "No"}</small>
                </div>
                {match.status === "Open" ? (
                  <div className="settle-box">
                    <select
                      value={settleSelection[match.id] ?? ""}
                      onChange={(event) => setSettleSelection((prev) => ({ ...prev, [match.id]: event.target.value }))}
                    >
                      <option value="">Select winning team</option>
                      {(match.teamIds ?? [])
                        .map((teamId) => teamLookup.get(String(teamId)))
                        .filter((team): team is Team => Boolean(team))
                        .map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                    </select>
                    <button type="button" className="btn primary" onClick={() => void settleMatch(match.id)}>Settle</button>
                    <div className="row-inline" style={{ marginTop: 6 }}>
                      <select
                        value={injectTeamSelection[match.id] ?? ""}
                        onChange={(event) => setInjectTeamSelection((prev) => ({ ...prev, [match.id]: event.target.value }))}
                      >
                        <option value="">Select team to add predictions</option>
                        {(match.teamIds ?? [])
                          .map((teamId) => teamLookup.get(String(teamId)))
                          .filter((team): team is Team => Boolean(team))
                          .map((team) => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={injectQuantitySelection[match.id] ?? "1"}
                        onChange={(event) => setInjectQuantitySelection((prev) => ({ ...prev, [match.id]: event.target.value }))}
                        placeholder="Quantity"
                        style={{ maxWidth: 120 }}
                      />
                      <button type="button" className="btn ghost" onClick={() => void addMatchPredictions(match)}>
                        Add Predictions
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="settle-box">
                    <small>Settled at {match.settledAt ? new Date(match.settledAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : "-"}</small>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setMatchDeleteTarget({ id: match.id, name: match.name })}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="block admin-block">
        <div className="block-head">
          <h3>Data</h3>
        </div>
        <p>Invite Status and Prediction Records have been moved to the Data page.</p>
        <div className="row-inline">
          <a className="btn ghost" href="/admin/data">Go To Data</a>
        </div>
      </section>

      {message ? <div className="page-message">{message}</div> : null}

      {matchDeleteTarget ? (
        <div className="modal-backdrop" onClick={() => setMatchDeleteTarget(null)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Delete Settled Match</h3>
            <div className="confirm-summary">
              <p>Match: {matchDeleteTarget.name}</p>
              <p>This will permanently delete the settled match and related prediction records.</p>
            </div>
            <div className="confirm-actions">
              <button type="button" className="btn ghost" onClick={() => setMatchDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn primary" onClick={() => void deleteSettledMatch()}>Delete</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
