"use client";

import { useState, useCallback } from "react";
import {
  Search,
  Play,
  Copy,
  Check,
  Loader2,
  Film,
  Tv,
  Server,
  Code2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Link2,
  BookOpen,
  Terminal,
  Globe,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StreamSource {
  url: string;
  quality: string;
  type: "master" | "variant";
}

interface ScrapeResult {
  success: boolean;
  meta?: {
    tmdbId: string;
    title: string;
    year: string;
    backdrop: string;
    enToken: string;
    host: string;
  } | null;
  sources?: StreamSource[];
  proxiedSources?: StreamSource[];
  rawM3u8?: string | null;
  proxyM3u8Url?: string | null;
  error?: string;
  title?: string;
  imdbId?: string;
  fileName?: string;
}

interface MultiSourceResult {
  source: string;
  success: boolean;
  sources: StreamSource[];
  proxiedSources: StreamSource[];
  rawM3u8?: string | null;
  error?: string;
}

type ActionType = "scrape" | "streams" | "raw" | "multi";
type KindType = "movie" | "tv";
type SourceType = "auto" | "justhd" | "vidsrc" | "vidfast";
type TabType = "scraper" | "vidlink" | "test" | "docs";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function VidfastPage() {
  const [tab, setTab] = useState<TabType>("scraper");
  const [tmdbId, setTmdbId] = useState("1265609");
  const [kind, setKind] = useState<KindType>("movie");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [action, setAction] = useState<ActionType>("scrape");
  const [source, setSource] = useState<SourceType>("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [multiResults, setMultiResults] = useState<MultiSourceResult[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [activeProvider, setActiveProvider] = useState<"vidfast" | "vidlink">("vidfast");

  const scrape = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setMultiResults(null);
    setShowRaw(false);

    try {
      const params = new URLSearchParams({
        tmdb: tmdbId,
        kind,
        action,
        ...(source !== "auto" ? { source } : {}),
      });
      if (kind === "tv") {
        params.set("season", season);
        params.set("episode", episode);
      }

      const apiRoute = activeProvider === "vidlink" ? "/api/vidlink" : "/api/vidfast";
      const res = await fetch(`${apiRoute}?${params}`);
      const data = await res.json();

      if (action === "multi" && data.results) {
        setMultiResults(data.results);
      } else {
        setResult(data);
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Fetch failed",
      });
    } finally {
      setLoading(false);
    }
  }, [tmdbId, kind, season, episode, action, source, activeProvider]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copyToClipboard(text, id)}
      className="p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors"
      title="Copy"
    >
      {copied === id ? (
        <Check className="w-3 h-3 text-green-400" />
      ) : (
        <Copy className="w-3 h-3 text-zinc-400" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                Vidfast Scraper
              </h1>
              <p className="text-[10px] text-zinc-500 -mt-0.5">Raw m3u8 + CORS Proxy + Vidlink</p>
            </div>
          </div>
          <div className="flex gap-1">
            {([
              { id: "scraper" as TabType, icon: Zap, label: "Scraper" },
              { id: "vidlink" as TabType, icon: Link2, label: "Vidlink" },
              { id: "test" as TabType, icon: Terminal, label: "Test Lab" },
              { id: "docs" as TabType, icon: BookOpen, label: "API Docs" },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  tab === t.id
                    ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ==================== SCRAPER TAB ==================== */}
        {tab === "scraper" && (
          <div className="space-y-6">
            {/* Search Controls */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Film className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-bold">Vidfast M3U8 Scraper</h2>
                <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">
                  vidfast.pro
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">TMDB ID</label>
                  <div className="flex gap-2">
                    <Input
                      value={tmdbId}
                      onChange={(e) => setTmdbId(e.target.value)}
                      placeholder="e.g. 1265609"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                    <Button
                      onClick={scrape}
                      disabled={loading || !tmdbId}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shrink-0"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      {loading ? "Scraping..." : "Scrape"}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Type</label>
                  <div className="flex gap-1">
                    {(["movie", "tv"] as KindType[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          kind === k
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
                        )}
                      >
                        {k === "movie" ? (
                          <span className="flex items-center gap-1">
                            <Film className="w-3 h-3" /> Movie
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Tv className="w-3 h-3" /> TV
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as SourceType)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="auto">Auto</option>
                    <option value="justhd">JustHD</option>
                    <option value="vidsrc">VidSrc</option>
                    <option value="vidfast">Vidfast</option>
                  </select>
                </div>
              </div>

              {kind === "tv" && (
                <div className="flex gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Season</label>
                    <Input value={season} onChange={(e) => setSeason(e.target.value)} type="number" min="1" className="bg-zinc-800 border-zinc-700 text-white w-24" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Episode</label>
                    <Input value={episode} onChange={(e) => setEpisode(e.target.value)} type="number" min="1" className="bg-zinc-800 border-zinc-700 text-white w-24" />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {([
                  { a: "scrape" as ActionType, label: "Full Scrape", desc: "Meta + m3u8 + raw" },
                  { a: "streams" as ActionType, label: "Streams Only", desc: "Fast m3u8 URLs" },
                  { a: "raw" as ActionType, label: "Raw M3U8", desc: "Raw playlist content" },
                  { a: "multi" as ActionType, label: "All Sources", desc: "Try all providers" },
                ]).map((item) => (
                  <button
                    key={item.a}
                    onClick={() => setAction(item.a)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
                      action === item.a
                        ? "bg-yellow-500 text-black"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {result && !result.success && result.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-1">{result.error}</p>
              </div>
            )}

            {/* Metadata Card */}
            {result?.success && (result.meta || result.title) && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Film className="w-5 h-5 text-yellow-400" />
                  {result.meta?.title || result.title || "Unknown"}
                  {result.meta?.year && (
                    <span className="text-zinc-500 text-sm">({result.meta.year})</span>
                  )}
                </h2>
                {result.meta?.backdrop && (
                  <div className="mb-3 rounded-lg overflow-hidden h-32 bg-zinc-800">
                    <img
                      src={result.meta.backdrop}
                      alt="backdrop"
                      className="w-full h-full object-cover opacity-70"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {result.meta?.enToken && (
                    <div>
                      <span className="text-zinc-500">EN Token</span>
                      <p className="text-yellow-400 font-mono text-xs truncate">
                        {result.meta.enToken.substring(0, 30)}...
                      </p>
                    </div>
                  )}
                  {result.meta?.host && (
                    <div>
                      <span className="text-zinc-500">Host</span>
                      <p className="text-white">{result.meta.host}</p>
                    </div>
                  )}
                  {result.imdbId && (
                    <div>
                      <span className="text-zinc-500">IMDB</span>
                      <p className="text-white">{result.imdbId}</p>
                    </div>
                  )}
                  {result.fileName && (
                    <div className="col-span-2 md:col-span-4">
                      <span className="text-zinc-500">File</span>
                      <p className="text-zinc-300 font-mono text-xs truncate">
                        {result.fileName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stream Sources */}
            {result?.success && (result.sources?.length ?? 0) > 0 && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-400" />
                  m3u8 Stream URLs
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {result.sources?.length} streams
                  </Badge>
                </h2>
                <div className="space-y-3">
                  {result.sources?.map((s, i) => (
                    <div key={i} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={s.type === "master" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}>
                            {s.type}
                          </Badge>
                          <span className="text-sm text-zinc-300">{s.quality}</span>
                        </div>
                        <div className="flex gap-1">
                          <CopyBtn text={s.url} id={`src-${i}`} />
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors"
                            title="Open"
                          >
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                          </a>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-zinc-500 break-all">{s.url}</p>
                    </div>
                  ))}
                </div>

                {/* Proxied URLs */}
                {result.proxiedSources && result.proxiedSources.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                      <Play className="w-4 h-4 text-blue-400" />
                      Proxied URLs (CORS-ready)
                    </h3>
                    <div className="space-y-2">
                      {result.proxiedSources.map((s, i) => (
                        <div key={`proxy-${i}`} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2">
                          <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-xs shrink-0">
                            {s.quality}
                          </Badge>
                          <p className="text-xs font-mono text-zinc-400 truncate flex-1">{s.url}</p>
                          <CopyBtn text={s.url} id={`proxy-${i}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proxy M3U8 URL */}
                {result.proxyM3u8Url && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <span className="text-xs text-yellow-400 font-semibold block mb-1">
                      HLS.js-ready Proxy URL
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-yellow-300 font-mono flex-1 break-all">
                        {result.proxyM3u8Url}
                      </code>
                      <CopyBtn text={result.proxyM3u8Url} id="proxy-master" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Raw M3U8 Content */}
            {result?.rawM3u8 && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-purple-400" />
                    Raw M3U8 Playlist
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRaw(!showRaw)}
                      className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      {showRaw ? <><ChevronUp className="w-4 h-4" /> Hide</> : <><ChevronDown className="w-4 h-4" /> Show</>}
                    </button>
                    <CopyBtn text={result.rawM3u8!} id="raw-m3u8" />
                  </div>
                </div>
                {showRaw && (
                  <pre className="bg-zinc-950 rounded-lg p-4 overflow-x-auto text-xs font-mono text-green-400 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {result.rawM3u8}
                  </pre>
                )}
              </div>
            )}

            {/* Multi Source Results */}
            {multiResults && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-400" />
                  All Sources Comparison
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {multiResults.map((mr, i) => (
                    <div
                      key={i}
                      className={cn(
                        "bg-zinc-800 rounded-lg p-4 border",
                        mr.success ? "border-green-500/30" : "border-red-500/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">{mr.source}</span>
                        <Badge className={mr.success ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                          {mr.success ? `${mr.sources.length} streams` : "Failed"}
                        </Badge>
                      </div>
                      {mr.success && mr.proxiedSources[0] && (
                        <div className="mt-2">
                          <p className="text-xs text-zinc-500 mb-1">Master URL (proxied):</p>
                          <code className="text-xs font-mono text-blue-400 break-all">
                            {mr.proxiedSources[0].url}
                          </code>
                        </div>
                      )}
                      {mr.rawM3u8 && (
                        <div className="mt-2">
                          <details>
                            <summary className="text-xs text-purple-400 cursor-pointer">Raw M3U8</summary>
                            <pre className="text-[10px] font-mono text-green-400 mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {mr.rawM3u8}
                            </pre>
                          </details>
                        </div>
                      )}
                      {mr.error && <p className="text-xs text-red-400 mt-1">{mr.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== VIDLINK TAB ==================== */}
        {tab === "vidlink" && (
          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-bold">Vidlink M3U8 Scraper</h2>
                <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                  vidsrc / vidlink
                </Badge>
              </div>
              <p className="text-sm text-zinc-400">
                Uses the vaplayer.ru backend with the &quot;vidsrc&quot; source, which maps to the vidlink/vidsrc provider chain.
                Returns raw m3u8 stream URLs and playlist content.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">TMDB ID</label>
                  <div className="flex gap-2">
                    <Input
                      value={tmdbId}
                      onChange={(e) => setTmdbId(e.target.value)}
                      placeholder="e.g. 1265609"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                    <Button
                      onClick={() => { setActiveProvider("vidlink"); scrape(); }}
                      disabled={loading || !tmdbId}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-semibold shrink-0"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      {loading ? "Scraping..." : "Scrape"}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Type</label>
                  <div className="flex gap-1">
                    {(["movie", "tv"] as KindType[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          kind === k
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
                        )}
                      >
                        {k === "movie" ? <span className="flex items-center gap-1"><Film className="w-3 h-3" /> Movie</span> : <span className="flex items-center gap-1"><Tv className="w-3 h-3" /> TV</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {kind === "tv" && (
                <div className="flex gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Season</label>
                    <Input value={season} onChange={(e) => setSeason(e.target.value)} type="number" min="1" className="bg-zinc-800 border-zinc-700 text-white w-24" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Episode</label>
                    <Input value={episode} onChange={(e) => setEpisode(e.target.value)} type="number" min="1" className="bg-zinc-800 border-zinc-700 text-white w-24" />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setAction("streams"); }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
                    action === "streams" ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  Streams Only
                </button>
                <button
                  onClick={() => { setAction("raw"); }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
                    action === "raw" ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  Raw M3U8
                </button>
              </div>
            </div>

            {/* Show results for vidlink tab */}
            {result?.success && (result.sources?.length ?? 0) > 0 && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-400" />
                  Vidlink Streams
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {result.sources?.length} streams
                  </Badge>
                </h2>
                <div className="space-y-3">
                  {result.sources?.map((s, i) => (
                    <div key={i} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={s.type === "master" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-zinc-600/50 text-zinc-300"}>
                            {s.type}
                          </Badge>
                          <span className="text-sm text-zinc-300">{s.quality}</span>
                        </div>
                        <div className="flex gap-1">
                          <CopyBtn text={s.url} id={`vl-${i}`} />
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors">
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                          </a>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-zinc-500 break-all">{s.url}</p>
                    </div>
                  ))}
                </div>
                {result.rawM3u8 && (
                  <div className="mt-4">
                    <details>
                      <summary className="text-sm text-purple-400 cursor-pointer font-semibold">Raw M3U8 Playlist</summary>
                      <pre className="bg-zinc-950 rounded-lg p-4 overflow-x-auto text-xs font-mono text-green-400 whitespace-pre-wrap max-h-96 overflow-y-auto mt-2">
                        {result.rawM3u8}
                      </pre>
                    </details>
                  </div>
                )}
                {result.proxyM3u8Url && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <span className="text-xs text-blue-400 font-semibold block mb-1">HLS.js Proxy URL</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-blue-300 font-mono flex-1 break-all">{result.proxyM3u8Url}</code>
                      <CopyBtn text={result.proxyM3u8Url} id="vl-proxy" />
                    </div>
                  </div>
                )}
              </div>
            )}
            {result && !result.success && result.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-1">{result.error}</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== TEST LAB TAB ==================== */}
        {tab === "test" && (
          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-bold">Test Lab</h2>
                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
                  Quick test endpoints
                </Badge>
              </div>

              <div className="mb-4">
                <label className="text-xs text-zinc-400 mb-1 block">TMDB ID for tests</label>
                <Input
                  value={tmdbId}
                  onChange={(e) => setTmdbId(e.target.value)}
                  placeholder="e.g. 1265609"
                  className="bg-zinc-800 border-zinc-700 text-white max-w-xs"
                />
              </div>

              <div className="space-y-3">
                {[
                  { label: "Vidfast Full Scrape", url: `/api/vidfast?tmdb=${tmdbId}&action=scrape`, color: "yellow" },
                  { label: "Vidfast Streams", url: `/api/vidfast?tmdb=${tmdbId}&action=streams`, color: "yellow" },
                  { label: "Vidfast Raw M3U8", url: `/api/vidfast?tmdb=${tmdbId}&action=raw`, color: "yellow" },
                  { label: "Vidfast Multi Source", url: `/api/vidfast?tmdb=${tmdbId}&action=multi`, color: "yellow" },
                  { label: "Vidfast Meta Only", url: `/api/vidfast?tmdb=${tmdbId}&action=meta`, color: "yellow" },
                  { label: "Vidlink Streams", url: `/api/vidlink?tmdb=${tmdbId}&action=streams`, color: "blue" },
                  { label: "Vidlink Raw M3U8", url: `/api/vidlink?tmdb=${tmdbId}&action=raw`, color: "blue" },
                  { label: "Available Sources", url: `/api/vidfast?action=sources`, color: "green" },
                ].map((test, i) => (
                  <TestEndpoint key={i} label={test.label} url={test.url} color={test.color} copied={copied} setCopied={setCopied} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== DOCS TAB ==================== */}
        {tab === "docs" && (
          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <div className="flex items-center gap-2 mb-6">
                <BookOpen className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-bold">API Reference</h2>
              </div>

              <div className="space-y-6">
                <ApiSection
                  title="Vidfast Scraper"
                  color="yellow"
                  endpoints={[
                    { method: "GET", path: "/api/vidfast?tmdb=ID&action=scrape", desc: "Full pipeline: meta + m3u8 URLs + raw playlist + proxied URLs" },
                    { method: "GET", path: "/api/vidfast?tmdb=ID&action=streams", desc: "Just m3u8 stream URLs (fastest)" },
                    { method: "GET", path: "/api/vidfast?tmdb=ID&action=raw", desc: "m3u8 URLs + raw playlist content" },
                    { method: "GET", path: "/api/vidfast?tmdb=ID&action=multi", desc: "Try all sources (justhd, vidsrc, auto, vidfast)" },
                    { method: "GET", path: "/api/vidfast?tmdb=ID&action=meta", desc: "Only scrape vidfast.pro for en token + metadata" },
                    { method: "GET", path: "/api/vidfast?action=sources", desc: "List available sources" },
                  ]}
                  params={[
                    { name: "tmdb", type: "string", required: true, desc: "TMDB movie/TV ID (e.g. 1265609)" },
                    { name: "action", type: "scrape|streams|raw|multi|meta|sources", required: false, desc: "Action to perform (default: scrape)" },
                    { name: "kind", type: "movie|tv", required: false, desc: "Media type (default: movie)" },
                    { name: "source", type: "auto|justhd|vidsrc|vidfast", required: false, desc: "Vaplayer source (default: auto)" },
                    { name: "season", type: "number", required: false, desc: "Season number (TV only)" },
                    { name: "episode", type: "number", required: false, desc: "Episode number (TV only)" },
                  ]}
                />

                <ApiSection
                  title="Vidlink Scraper"
                  color="blue"
                  endpoints={[
                    { method: "GET", path: "/api/vidlink?tmdb=ID&action=streams", desc: "Vidlink/vidsrc m3u8 stream URLs" },
                    { method: "GET", path: "/api/vidlink?tmdb=ID&action=raw", desc: "Vidlink m3u8 + raw playlist content" },
                  ]}
                  params={[
                    { name: "tmdb", type: "string", required: true, desc: "TMDB movie/TV ID" },
                    { name: "action", type: "streams|raw", required: false, desc: "Action (default: streams)" },
                    { name: "kind", type: "movie|tv", required: false, desc: "Media type (default: movie)" },
                    { name: "source", type: "vidsrc|auto|justhd|vidfast", required: false, desc: "Vaplayer source (default: vidsrc)" },
                    { name: "season", type: "number", required: false, desc: "Season (TV only)" },
                    { name: "episode", type: "number", required: false, desc: "Episode (TV only)" },
                  ]}
                />

                <ApiSection
                  title="CORS Proxy"
                  color="green"
                  endpoints={[
                    { method: "GET", path: "/api/proxy/m3u8?url={encoded}", desc: "Proxy any m3u8/segment URL with CORS headers and playlist URL rewriting" },
                  ]}
                  params={[
                    { name: "url", type: "string", required: true, desc: "Encoded upstream URL to proxy" },
                    { name: "referer", type: "string", required: false, desc: "Override Referer header sent upstream" },
                    { name: "format", type: "m3u8|vtt", required: false, desc: "Force content format detection" },
                  ]}
                />

                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-yellow-400" />
                    HLS.js Usage
                  </h3>
                  <pre className="bg-zinc-950 rounded-lg p-4 text-xs font-mono text-green-400 overflow-x-auto">
{`// Quick start with HLS.js
import Hls from 'hls.js';

const hls = new Hls();
hls.loadSource('/api/proxy/m3u8?url=' + encodeURIComponent(masterUrl));
hls.attachMedia(videoElement);

// Or use the proxied URL directly from the API response:
// result.proxiedSources[0].url → drop into HLS.js`}
                  </pre>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <h3 className="font-semibold text-white mb-2">How It Works</h3>
                  <div className="space-y-2 text-sm text-zinc-300">
                    <p><span className="text-yellow-400 font-mono">1.</span> Fetch vidfast.pro/movie/{"{tmdb_id}"} → parse RSC payload → extract encrypted <code className="text-yellow-300">en</code> token</p>
                    <p><span className="text-yellow-400 font-mono">2.</span> Call streamdata.vaplayer.ru/api.php with TMDB ID → get m3u8 stream URLs</p>
                    <p><span className="text-yellow-400 font-mono">3.</span> Return raw m3u8 URLs + playlist content through our CORS proxy</p>
                    <p><span className="text-zinc-500 text-xs mt-2 block">The vaplayer.ru API is the shared backend for vidfast.pro, vidsrc.pm, nextgencloudfabric.com, and other VA Player sites.</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TestEndpoint({ label, url, color, copied, setCopied }: {
  label: string;
  url: string;
  color: string;
  copied: string | null;
  setCopied: (v: string | null) => void;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(url);
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      setShowResult(true);
    } catch (err) {
      setResult(JSON.stringify({ error: err instanceof Error ? err.message : "Failed" }, null, 2));
      setShowResult(true);
    } finally {
      setLoading(false);
    }
  };

  const colorClass = color === "yellow" ? "text-yellow-400" : color === "blue" ? "text-blue-400" : "text-green-400";
  const bgClass = color === "yellow" ? "bg-yellow-500/15 border-yellow-500/30" : color === "blue" ? "bg-blue-500/15 border-blue-500/30" : "bg-green-500/15 border-green-500/30";

  return (
    <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={bgClass + " " + colorClass}>{label}</Badge>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => { navigator.clipboard.writeText(url); setCopied(`test-${label}`); setTimeout(() => setCopied(null), 2000); }}
            className="p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors"
            title="Copy URL"
          >
            {copied === `test-${label}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
          </button>
          <button
            onClick={run}
            disabled={loading}
            className="px-3 py-1 rounded-md bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Run"}
          </button>
        </div>
      </div>
      <code className="text-xs font-mono text-zinc-400 break-all block">{url}</code>
      {result && showResult && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Response</span>
            <button onClick={() => setShowResult(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Hide</button>
          </div>
          <pre className="bg-zinc-950 rounded-lg p-3 overflow-x-auto text-[10px] font-mono text-green-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}

function ApiSection({ title, color, endpoints, params }: {
  title: string;
  color: string;
  endpoints: { method: string; path: string; desc: string }[];
  params: { name: string; type: string; required: boolean; desc: string }[];
}) {
  const colorClass = color === "yellow" ? "text-yellow-400 border-yellow-500/30" : color === "blue" ? "text-blue-400 border-blue-500/30" : "text-green-400 border-green-500/30";

  return (
    <div>
      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
        <Badge className={colorClass}>{title}</Badge>
      </h3>
      <div className="space-y-2 mb-4">
        {endpoints.map((ep, i) => (
          <div key={i} className="flex items-start gap-3 bg-zinc-800/50 rounded-lg px-4 py-2">
            <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px] shrink-0 mt-0.5">
              {ep.method}
            </Badge>
            <div>
              <code className="text-xs font-mono text-green-400">{ep.path}</code>
              <p className="text-xs text-zinc-500 mt-0.5">{ep.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-zinc-800/30 rounded-lg p-3">
        <p className="text-xs text-zinc-500 mb-2 font-semibold">Parameters</p>
        <div className="space-y-1">
          {params.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <code className="text-yellow-300 font-mono shrink-0">{p.name}</code>
              <span className="text-zinc-500 shrink-0">{p.type}</span>
              {p.required && <span className="text-red-400 shrink-0">required</span>}
              <span className="text-zinc-400">{p.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
