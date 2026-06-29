"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Hls from "hls.js";
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
  MonitorPlay,
  X,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
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
/*  HLS Player Component                                               */
/* ------------------------------------------------------------------ */

function HlsPlayer({
  url,
  title,
  onClose,
}: {
  url: string;
  title?: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Destroy previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setLoading(true);
    setError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().then(() => setPlaying(true)).catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setLoading(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError(`Network error: ${data.details}. The stream might be geo-blocked or the URL expired.`);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError(`Media error: ${data.details}. Trying to recover...`);
              hls.recoverMediaError();
              break;
            default:
              setError(`Fatal error: ${data.details}`);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = url;
      video.addEventListener("loadedmetadata", () => {
        setLoading(false);
        video.play().then(() => setPlaying(true)).catch(() => {});
      });
    } else {
      setError("HLS is not supported in this browser.");
      setLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(formatTime(video.currentTime));
    const onDur = () => setDuration(formatTime(video.duration));
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDur);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDur);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="bg-black rounded-xl overflow-hidden border border-zinc-700 relative group"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
        title="Close player"
      >
        <X className="w-4 h-4 text-white" />
      </button>

      {/* Title bar */}
      {title && (
        <div className="absolute top-2 left-2 z-20 bg-black/60 rounded-lg px-2 py-1">
          <p className="text-xs text-white font-medium truncate max-w-[300px]">{title}</p>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full aspect-video bg-black cursor-pointer"
        onClick={togglePlay}
        playsInline
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto" />
            <p className="text-sm text-zinc-300 mt-2">Loading stream...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center max-w-md px-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-red-400 font-semibold mb-1">Playback Error</p>
            <p className="text-xs text-zinc-400">{error}</p>
            <p className="text-[10px] text-zinc-500 mt-2">Try using the proxied URL or a different source.</p>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="p-1 hover:scale-110 transition-transform">
              {playing ? (
                <svg className="w-5 h-5 text-white" fill="white" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="white" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>
              )}
            </button>
            <button onClick={toggleMute} className="p-1 hover:scale-110 transition-transform">
              {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
            <span className="text-xs text-zinc-300 font-mono">
              {currentTime} / {duration}
            </span>
          </div>
          <button onClick={toggleFullscreen} className="p-1 hover:scale-110 transition-transform">
            {fullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
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

  // Player state
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerTitle, setPlayerTitle] = useState<string>("");

  const playStream = (url: string, title?: string) => {
    // If the URL is relative (proxied), use as-is. If absolute, wrap through proxy.
    let playUrl = url;
    if (url.startsWith("http")) {
      // Direct URL — route through our CORS proxy
      playUrl = `/api/proxy/m3u8?url=${encodeURIComponent(url)}&referer=${encodeURIComponent("https://nextgenmarketinghub.site/")}`;
    }
    setPlayerUrl(playUrl);
    setPlayerTitle(title || "");
  };

  const closePlayer = () => {
    setPlayerUrl(null);
    setPlayerTitle("");
  };

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

  const PlayBtn = ({ url, title, color = "green" }: { url: string; title?: string; color?: string }) => (
    <button
      onClick={() => playStream(url, title)}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        color === "green" ? "bg-green-500/20 hover:bg-green-500/30" : color === "yellow" ? "bg-yellow-500/20 hover:bg-yellow-500/30" : "bg-blue-500/20 hover:bg-blue-500/30"
      )}
      title="Play stream"
    >
      <MonitorPlay className={cn("w-3 h-3", color === "green" ? "text-green-400" : color === "yellow" ? "text-yellow-400" : "text-blue-400")} />
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
        {/* ==================== PLAYER (floating) ==================== */}
        {playerUrl && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-green-400">Now Playing</span>
                {playerTitle && <span className="text-xs text-zinc-400">— {playerTitle}</span>}
              </div>
              <button onClick={closePlayer} className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1">
                <X className="w-3 h-3" /> Close
              </button>
            </div>
            <HlsPlayer url={playerUrl} title={playerTitle} onClose={closePlayer} />
          </div>
        )}

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
                  { a: "scrape" as ActionType, label: "Full Scrape" },
                  { a: "streams" as ActionType, label: "Streams Only" },
                  { a: "raw" as ActionType, label: "Raw M3U8" },
                  { a: "multi" as ActionType, label: "All Sources" },
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
                          <PlayBtn url={s.url} title={result.meta?.title || result.title} color="green" />
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
                          <PlayBtn url={s.url} title={result.meta?.title || result.title} color="blue" />
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
                      <PlayBtn url={result.proxyM3u8Url} title={result.meta?.title || result.title} color="yellow" />
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
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-blue-400 break-all flex-1">
                              {mr.proxiedSources[0].url}
                            </code>
                            <PlayBtn url={mr.proxiedSources[0].url} title={mr.source} color="blue" />
                          </div>
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
                  onClick={() => setAction("streams")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
                    action === "streams" ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  Streams Only
                </button>
                <button
                  onClick={() => setAction("raw")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
                    action === "raw" ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  Raw M3U8
                </button>
              </div>
            </div>

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
                          <PlayBtn url={s.url} title={result.meta?.title || result.title} color="blue" />
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
                      <PlayBtn url={result.proxyM3u8Url} title={result.meta?.title || result.title} color="blue" />
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

              {/* Custom URL player */}
              <div className="mb-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-green-400" />
                  Play Custom m3u8 URL
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste any m3u8 URL to test..."
                    className="bg-zinc-900 border-zinc-600 text-white font-mono text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const url = (e.target as HTMLInputElement).value;
                        if (url) playStream(url, "Custom URL");
                      }
                    }}
                    id="custom-m3u8-input"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById("custom-m3u8-input") as HTMLInputElement;
                      if (input?.value) playStream(input.value, "Custom URL");
                    }}
                    className="bg-green-500 hover:bg-green-600 text-black font-semibold shrink-0"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Auto-wraps through CORS proxy if it&apos;s an absolute URL</p>
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
                  <TestEndpoint key={i} label={test.label} url={test.url} color={test.color} copied={copied} setCopied={setCopied} onPlay={playStream} />
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
                    <MonitorPlay className="w-4 h-4 text-green-400" />
                    Built-in Player
                  </h3>
                  <div className="space-y-2 text-sm text-zinc-300">
                    <p>Every m3u8 URL has a <span className="text-green-400">play button</span> next to it. Click it to test the stream in the built-in HLS.js player.</p>
                    <p><span className="text-yellow-400">Direct URLs</span> are auto-wrapped through the CORS proxy.</p>
                    <p><span className="text-blue-400">Proxied URLs</span> (starting with <code className="text-xs">/api/proxy/m3u8</code>) are played directly.</p>
                    <p>The Test Lab also has a <span className="text-green-400">custom URL input</span> — paste any m3u8 URL and hit Play.</p>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-yellow-400" />
                    HLS.js Usage (external)
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

function TestEndpoint({ label, url, color, copied, setCopied, onPlay }: {
  label: string;
  url: string;
  color: string;
  copied: string | null;
  setCopied: (v: string | null) => void;
  onPlay: (url: string, title?: string) => void;
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
            <div className="flex items-center gap-1">
              {(() => {
                try {
                  const data = JSON.parse(result);
                  // Find any m3u8 URL in the response that we can play
                  const masterUrl = data.masterUrl || data.proxyUrl || data.proxyM3u8Url ||
                    (data.sources && data.sources[0]?.url) ||
                    (data.proxiedSources && data.proxiedSources[0]?.url);
                  if (masterUrl) {
                    return (
                      <button
                        onClick={() => onPlay(masterUrl, label)}
                        className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                      >
                        <MonitorPlay className="w-3 h-3" /> Play
                      </button>
                    );
                  }
                } catch { /* ignore */ }
                return null;
              })()}
              <button onClick={() => setShowResult(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Hide</button>
            </div>
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
