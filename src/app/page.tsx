'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search, Play, ExternalLink, Tv, Film, Globe,
  Volume2, VolumeX, Maximize, Pause, RefreshCw,
  Download, Zap, Server, Info, Shield, Lock, Unlock, Copy, Check,
  BookOpen, Library, ChevronLeft, ChevronRight, BookMarked,
  TrendingUp, Clock, Star, Filter, X, Loader2, Flame
} from 'lucide-react';

// ==================== TYPES ====================

// Anime types (existing)
interface AnimeShow {
  _id: string;
  name: string;
  thumbnail: string;
  englishName?: string;
  nativeName?: string;
  score?: number;
  status?: string;
  season?: { quarter: string; year: number };
  genres?: string[];
  type?: string;
  episodeCount?: number;
}

interface StreamInfo {
  provider: string;
  url: string;
  type: 'm3u8' | 'mp4' | 'iframe' | 'clock';
  quality?: string;
  originalUrl: string;
  proxyUrl?: string;
}

// Manga types (new)
interface MangaSearchResult {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  url: string;
  type?: string;
}

interface MangaInfo {
  id: string;
  slug: string;
  title: string;
  altTitle?: string;
  thumbnail: string;
  description: string;
  status: string;
  type: string;
  genres: string[];
  author?: string;
  chapters: MangaChapter[];
}

interface MangaChapter {
  id: string;
  number: number;
  title: string;
  url: string;
  date: string;
  lang: string;
}

interface MangaPage {
  index: number;
  url: string;
  offset: number;
  needsDescramble: boolean;
  proxyUrl: string;
  originalUrl: string;
}

// ==================== HLS PLAYER ====================

function HlsPlayer({ src, title }: { src: string; title?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src || !videoRef.current) return;
    const initPlayer = async () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      const video = videoRef.current;
      setLoading(true); setError(null);
      if (src.includes('.m3u8')) {
        const Hls = (await import('hls.js')).default;
        if (Hls.isSupported()) {
          const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
          hls.loadSource(src); hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => { setLoading(false); video.play().catch(() => {}); });
          hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
            if (data.fatal) { setError(`${data.type}: ${data.details}`); if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad(); else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError(); else hls.destroy(); }
          });
          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src; video.addEventListener('loadedmetadata', () => { setLoading(false); video.play().catch(() => {}); });
        }
      } else { video.src = src; video.addEventListener('loadeddata', () => { setLoading(false); video.play().catch(() => {}); }); video.addEventListener('error', () => { setError('Failed to load video'); setLoading(false); }); }
    };
    initPlayer();
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [src]);

  const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) { v.play().catch(() => {}); setPlaying(true); } else { v.pause(); setPlaying(false); } };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); };
  const toggleFullscreen = () => { const v = videoRef.current; if (!v) return; if (document.fullscreenElement) document.exitFullscreen(); else v.requestFullscreen(); };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => { const v = videoRef.current; if (!v || !duration) return; const rect = e.currentTarget.getBoundingClientRect(); v.currentTime = ((e.clientX - rect.left) / rect.width) * duration; };
  const formatTime = (s: number) => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; };

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {title && <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-3"><p className="text-white text-sm font-medium truncate">{title}</p></div>}
      <video ref={videoRef} className="w-full aspect-video" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)} onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration)} onClick={togglePlay} playsInline />
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" /></div>}
      {error && <div className="absolute inset-0 flex items-center justify-center bg-black/80"><div className="text-center p-4"><p className="text-red-400 text-sm mb-2">{error}</p><Button size="sm" variant="outline" onClick={() => { setError(null); setLoading(true); hlsRef.current?.startLoad(); }}><RefreshCw className="w-3 h-3 mr-1" /> Retry</Button></div></div>}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
        <div className="w-full h-1.5 bg-white/20 rounded cursor-pointer mb-2" onClick={seek}><div className="h-full bg-red-500 rounded transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} /></div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white hover:text-red-400 transition">{playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
            <button onClick={toggleMute} className="text-white hover:text-red-400 transition">{muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
            <span className="text-white/70 text-xs">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <button onClick={toggleFullscreen} className="text-white hover:text-red-400 transition"><Maximize className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}

// ==================== COPY BUTTON ====================

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return <button onClick={copy} className="text-gray-500 hover:text-gray-300 transition">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</button>;
}

// ==================== MANGA READER ====================

function MangaReader({ pages, chapterTitle }: { pages: MangaPage[]; chapterTitle: string }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'long'>('long');
  const readerRef = useRef<HTMLDivElement>(null);

  const goNext = () => setCurrentPage(p => Math.min(p + 1, pages.length - 1));
  const goPrev = () => setCurrentPage(p => Math.max(p - 1, 0));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (pages.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg">No pages loaded</p>
        <p className="text-sm">Select a chapter to start reading</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between bg-gray-800/80 rounded-lg p-3 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-medium truncate max-w-xs">{chapterTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={viewMode === 'single' ? 'default' : 'outline'} className={viewMode === 'single' ? 'bg-orange-600' : 'border-gray-600 text-gray-300'} onClick={() => setViewMode('single')}>
            1 Page
          </Button>
          <Button size="sm" variant={viewMode === 'long' ? 'default' : 'outline'} className={viewMode === 'long' ? 'bg-orange-600' : 'border-gray-600 text-gray-300'} onClick={() => setViewMode('long')}>
            Long Strip
          </Button>
          <span className="text-xs text-gray-400 ml-2">
            {viewMode === 'single' ? `${currentPage + 1} / ${pages.length}` : `${pages.length} pages`}
          </span>
        </div>
      </div>

      {/* Pages */}
      {viewMode === 'long' ? (
        <div ref={readerRef} className="max-w-3xl mx-auto space-y-1">
          {pages.map((page, i) => (
            <img
              key={i}
              src={page.proxyUrl}
              alt={`Page ${i + 1}`}
              className="w-full h-auto"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).src = page.originalUrl; }}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto relative">
          <img
            src={pages[currentPage]?.proxyUrl}
            alt={`Page ${currentPage + 1}`}
            className="w-full h-auto"
            onError={(e) => { (e.target as HTMLImageElement).src = pages[currentPage]?.originalUrl || ''; }}
          />
          <div className="flex items-center justify-center gap-4 mt-4">
            <Button onClick={goPrev} disabled={currentPage === 0} variant="outline" className="border-gray-600 text-gray-300"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
            <span className="text-sm text-gray-400">{currentPage + 1} / {pages.length}</span>
            <Button onClick={goNext} disabled={currentPage === pages.length - 1} variant="outline" className="border-gray-600 text-gray-300">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== MANGA CARD & ROW (outside render) ====================

function MangaCard({ manga, onClick }: { manga: MangaSearchResult; onClick: () => void }) {
  return (
    <Card className="bg-gray-800/50 border-gray-700 hover:border-orange-600 transition cursor-pointer group" onClick={onClick}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg">
        {manga.thumbnail ? (
          <img src={manga.thumbnail} alt={manga.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center"><BookOpen className="w-8 h-8 text-gray-500" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        {manga.type && <Badge variant="outline" className="absolute top-2 left-2 bg-black/50 text-xs border-gray-600">{manga.type}</Badge>}
      </div>
      <CardContent className="p-2">
        <p className="text-sm font-medium truncate">{manga.title}</p>
      </CardContent>
    </Card>
  );
}

function MangaRow({ title, icon, manga, onSelect }: { title: string; icon: React.ReactNode; manga: MangaSearchResult[]; onSelect: (manga: MangaSearchResult) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      {manga.length === 0 ? (
        <div className="flex items-center gap-3 py-8 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {manga.map(m => (
              <div key={m.id} className="w-36 shrink-0">
                <MangaCard manga={m} onClick={() => onSelect(m)} />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ==================== MAIN PAGE ====================

export default function ScraperPage() {
  // Top-level section
  const [section, setSection] = useState<'anime' | 'manga'>('manga');

  // ===== ANIME STATE =====
  const [animeSearchQuery, setAnimeSearchQuery] = useState('');
  const [animeSearchResults, setAnimeSearchResults] = useState<AnimeShow[]>([]);
  const [animeLoading, setAnimeLoading] = useState(false);
  const [animeError, setAnimeError] = useState<string | null>(null);
  const [selectedShow, setSelectedShow] = useState<AnimeShow | null>(null);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [episodeNum, setEpisodeNum] = useState('1');
  const [translationType, setTranslationType] = useState<'sub' | 'dub'>('sub');
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [episodeData, setEpisodeData] = useState<any>(null);
  const [extractedStreams, setExtractedStreams] = useState<StreamInfo[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [playerSrc, setPlayerSrc] = useState<string | null>(null);
  const [playerTitle, setPlayerTitle] = useState('');
  const [animeTab, setAnimeTab] = useState('search');
  const [testUrl, setTestUrl] = useState('');

  // ===== MANGA STATE =====
  const [mangaTab, setMangaTab] = useState('home');
  const [mangaSearchQuery, setMangaSearchQuery] = useState('');
  const [mangaLoading, setMangaLoading] = useState(false);
  const [mangaError, setMangaError] = useState<string | null>(null);
  const [mangaResults, setMangaResults] = useState<MangaSearchResult[]>([]);
  const [mangaHasNextPage, setMangaHasNextPage] = useState(false);
  const [mangaPage, setMangaPage] = useState(1);

  // Manga detail
  const [selectedManga, setSelectedManga] = useState<MangaSearchResult | null>(null);
  const [mangaInfo, setMangaInfo] = useState<MangaInfo | null>(null);

  // Manga reader
  const [mangaPages, setMangaPages] = useState<MangaPage[]>([]);
  const [readingChapter, setReadingChapter] = useState<MangaChapter | null>(null);
  const [pagesLoading, setPagesLoading] = useState(false);

  // Filter
  const [filterGenre, setFilterGenre] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSort, setFilterSort] = useState('');

  // Home data
  const [homePopular, setHomePopular] = useState<MangaSearchResult[]>([]);
  const [homeLatest, setHomeLatest] = useState<MangaSearchResult[]>([]);
  const [homeNewest, setHomeNewest] = useState<MangaSearchResult[]>([]);

  // CF Cookies
  const [cfCookieInput, setCfCookieInput] = useState('');
  const [cfCookieStatus, setCfCookieStatus] = useState(false);

  // ===== ANIME HANDLERS =====
  const handleAnimeSearch = async (query?: string) => {
    const q = query || animeSearchQuery;
    if (!q.trim()) return;
    setAnimeLoading(true); setAnimeError(null); setAnimeSearchQuery(q);
    try {
      const res = await fetch(`/api/mkissa/search?q=${encodeURIComponent(q)}&limit=25`);
      const data = await res.json();
      if (data.success) setAnimeSearchResults(data.shows || []);
      else setAnimeError(data.error || 'Search failed');
    } catch (err: any) { setAnimeError(err.message); }
    setAnimeLoading(false);
  };

  const loadBrowse = async (sort: string) => {
    setAnimeLoading(true); setAnimeError(null);
    try {
      const res = await fetch(`/api/mkissa/search?sort=${sort}&limit=25`);
      const data = await res.json();
      if (data.success) setAnimeSearchResults(data.shows || []);
    } catch (err: any) { setAnimeError(err.message); }
    setAnimeLoading(false);
  };

  const selectShow = async (show: AnimeShow) => {
    setSelectedShow(show); setAnimeLoading(true);
    try {
      const res = await fetch(`/api/mkissa/show?id=${show._id}`);
      const data = await res.json();
      if (data.success) { setShowDetail(data.show); setAnimeTab('detail'); }
      else setAnimeError(data.error || 'Failed');
    } catch (err: any) { setAnimeError(err.message); }
    setAnimeLoading(false);
  };

  const loadEpisode = async () => {
    if (!selectedShow?._id || !episodeNum) return;
    setAnimeLoading(true); setAnimeError(null); setStreams([]); setExtractedStreams([]); setEpisodeData(null);
    try {
      const res = await fetch(`/api/mkissa/streams?showId=${selectedShow._id}&episode=${episodeNum}&type=${translationType}`);
      const data = await res.json();
      if (data.success) { setEpisodeData(data); setStreams(data.streams || []); }
      else setAnimeError(data.error || 'Failed');
    } catch (err: any) { setAnimeError(err.message); }
    setAnimeLoading(false);
  };

  const extractPlayableStreams = async () => {
    if (!selectedShow?._id || !episodeNum) return;
    setExtracting(true); setAnimeError(null); setExtractedStreams([]);
    try {
      const res = await fetch(`/api/mkissa/streams?showId=${selectedShow._id}&episode=${episodeNum}&type=${translationType}&extract=true`);
      const data = await res.json();
      if (data.success && data.extractedStreams?.length > 0) setExtractedStreams(data.extractedStreams);
      else if (data.success) setAnimeError('No playable streams extracted');
      else setAnimeError(data.error || 'Failed');
    } catch (err: any) { setAnimeError(err.message); }
    setExtracting(false);
  };

  const playStream = (stream: StreamInfo) => {
    const proxyUrl = stream.proxyUrl || `/api/proxy/m3u8?url=${encodeURIComponent(stream.url)}`;
    setPlayerSrc(proxyUrl); setPlayerTitle(`${selectedShow?.name || 'Unknown'} - Ep ${episodeNum} [${stream.provider}]`); setAnimeTab('player');
  };

  // ===== MANGA HANDLERS =====
  const handleMangaSearch = async (query?: string, page: number = 1) => {
    const q = query || mangaSearchQuery;
    if (!q.trim()) return;
    setMangaLoading(true); setMangaError(null); setMangaSearchQuery(q); setMangaPage(page);
    try {
      const params = new URLSearchParams({ keyword: q, page: page.toString() });
      if (filterGenre) params.set('genre', filterGenre);
      if (filterType) params.set('type', filterType);
      if (filterSort) params.set('sort', filterSort);
      const res = await fetch(`/api/mangafire/search?${params}`);
      const data = await res.json();
      if (data.success) {
        setMangaResults(data.data.results || []);
        setMangaHasNextPage(data.data.hasNextPage || false);
        setMangaTab('results');
      } else setMangaError(data.error || 'Search failed');
    } catch (err: any) { setMangaError(err.message); }
    setMangaLoading(false);
  };

  const loadMangaHome = async () => {
    setMangaLoading(true); setMangaError(null);
    try {
      const [popRes, latRes, newRes] = await Promise.all([
        fetch('/api/mangafire/home?section=popular'),
        fetch('/api/mangafire/home?section=latest'),
        fetch('/api/mangafire/home?section=newest'),
      ]);
      const popData = await popRes.json();
      const latData = await latRes.json();
      const newData = await newRes.json();
      if (popData.success) setHomePopular(popData.data.results || []);
      if (latData.success) setHomeLatest(latData.data.results || []);
      if (newData.success) setHomeNewest(newData.data.results || []);
    } catch (err: any) { setMangaError(err.message); }
    setMangaLoading(false);
  };

  const selectManga = async (manga: MangaSearchResult) => {
    setSelectedManga(manga); setMangaLoading(true); setMangaError(null);
    try {
      const res = await fetch(`/api/mangafire/info?slug=${encodeURIComponent(manga.slug)}`);
      const data = await res.json();
      if (data.success) { setMangaInfo(data.data); setMangaTab('detail'); }
      else setMangaError(data.error || 'Failed to load manga');
    } catch (err: any) { setMangaError(err.message); }
    setMangaLoading(false);
  };

  const readChapter = async (chapter: MangaChapter) => {
    setReadingChapter(chapter); setPagesLoading(true); setMangaError(null);
    try {
      const res = await fetch(`/api/mangafire/pages?url=${encodeURIComponent(chapter.url)}`);
      const data = await res.json();
      if (data.success) { setMangaPages(data.data || []); setMangaTab('reader'); }
      else setMangaError(data.error || 'Failed to load pages');
    } catch (err: any) { setMangaError(err.message); }
    setPagesLoading(false);
  };

  // CF Cookie handlers
  const setCFCookies = async () => {
    if (!cfCookieInput.trim()) return;
    try {
      const res = await fetch('/api/mangafire/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cfCookieInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setCfCookieStatus(true);
        // Reload home data
        loadMangaHome();
      }
    } catch {}
  };

  const checkCFCookies = async () => {
    try {
      const res = await fetch('/api/mangafire/cookies');
      const data = await res.json();
      setCfCookieStatus(data.hasCookies);
    } catch {}
  };

  // Load manga home on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [popRes, latRes, newRes] = await Promise.all([
          fetch('/api/mangafire/home?section=popular'),
          fetch('/api/mangafire/home?section=latest'),
          fetch('/api/mangafire/home?section=newest'),
        ]);
        const popData = await popRes.json();
        const latData = await latRes.json();
        const newData = await newRes.json();
        if (!cancelled) {
          if (popData.success) setHomePopular(popData.data.results || []);
          if (latData.success) setHomeLatest(latData.data.results || []);
          if (newData.success) setHomeNewest(newData.data.results || []);
        }
      } catch (err: any) { if (!cancelled) setMangaError(err.message); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load anime popular on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mkissa/search?sort=Popular&limit=25`);
        const data = await res.json();
        if (!cancelled && data.success) setAnimeSearchResults(data.shows || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Helper
  const typeIcon = (type: string) => {
    switch (type) { case 'clock': return <Lock className="w-4 h-4 text-yellow-500" />; case 'iframe': return <ExternalLink className="w-4 h-4 text-blue-400" />; case 'm3u8': return <Play className="w-4 h-4 text-green-500" />; case 'mp4': return <Film className="w-4 h-4 text-purple-400" />; default: return <Server className="w-4 h-4 text-gray-400" />; }
  };
  const typeColor = (type: string) => {
    switch (type) { case 'clock': return 'border-yellow-700 bg-yellow-950/30'; case 'iframe': return 'border-blue-700 bg-blue-950/30'; case 'm3u8': return 'border-green-700 bg-green-950/30'; case 'mp4': return 'border-purple-700 bg-purple-950/30'; default: return 'border-gray-700 bg-gray-900/50'; }
  };



  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 rounded-lg p-2">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Mkissa Scraper</h1>
              <p className="text-xs text-gray-400">Anime & Manga scraper hub</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-400 border-green-800">
              <Zap className="w-3 h-3 mr-1" /> API Online
            </Badge>
          </div>
        </div>
      </header>

      {/* Section Switcher */}
      <div className="border-b border-gray-800 bg-gray-950/60">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setSection('anime')}
              className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${section === 'anime' ? 'border-red-500 text-red-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              <Tv className="w-4 h-4 inline mr-2" />Anime Scraper
            </button>
            <button
              onClick={() => setSection('manga')}
              className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${section === 'manga' ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              <BookOpen className="w-4 h-4 inline mr-2" />MangaFire Scraper
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* ==================== ANIME SECTION ==================== */}
        {section === 'anime' && (
          <Tabs value={animeTab} onValueChange={setAnimeTab}>
            <TabsList className="bg-gray-800/50 border border-gray-700 mb-6">
              <TabsTrigger value="search" className="data-[state=active]:bg-red-600"><Search className="w-4 h-4 mr-1" /> Search</TabsTrigger>
              <TabsTrigger value="detail" className="data-[state=active]:bg-red-600"><Film className="w-4 h-4 mr-1" /> Detail</TabsTrigger>
              <TabsTrigger value="player" className="data-[state=active]:bg-red-600"><Play className="w-4 h-4 mr-1" /> Player</TabsTrigger>
              <TabsTrigger value="test" className="data-[state=active]:bg-red-600"><Globe className="w-4 h-4 mr-1" /> Test Lab</TabsTrigger>
              <TabsTrigger value="docs" className="data-[state=active]:bg-red-600"><Info className="w-4 h-4 mr-1" /> API Docs</TabsTrigger>
            </TabsList>

            {/* SEARCH TAB */}
            <TabsContent value="search">
              <div className="space-y-6">
                <div className="flex gap-2">
                  <Input placeholder="Search anime..." value={animeSearchQuery} onChange={(e) => setAnimeSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAnimeSearch()} className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 flex-1" />
                  <Button onClick={() => handleAnimeSearch()} disabled={animeLoading} className="bg-red-600 hover:bg-red-700"><Search className="w-4 h-4 mr-1" /> Search</Button>
                  <Button onClick={() => loadBrowse('Popular')} variant="outline" className="border-gray-700 text-gray-300">Popular</Button>
                  <Button onClick={() => loadBrowse('Recent')} variant="outline" className="border-gray-700 text-gray-300">Latest</Button>
                </div>
                {animeError && <Card className="bg-red-950/50 border-red-800"><CardContent className="p-4"><p className="text-red-300 text-sm">{animeError}</p></CardContent></Card>}
                {animeLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (<div key={i} className="space-y-2"><Skeleton className="aspect-[3/4] rounded-lg bg-gray-800" /><Skeleton className="h-4 w-3/4 bg-gray-800" /></div>))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {animeSearchResults.map((show) => (
                      <Card key={show._id} className="bg-gray-800/50 border-gray-700 hover:border-red-600 transition cursor-pointer group" onClick={() => selectShow(show)}>
                        <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg">
                          {show.thumbnail ? <img src={show.thumbnail} alt={show.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full bg-gray-700 flex items-center justify-center"><Film className="w-8 h-8 text-gray-500" /></div>}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                          {show.score && <Badge className="absolute top-2 right-2 bg-red-600 text-xs">{show.score.toFixed(1)}</Badge>}
                          {show.type && <Badge variant="outline" className="absolute top-2 left-2 bg-black/50 text-xs border-gray-600">{show.type}</Badge>}
                        </div>
                        <CardContent className="p-2">
                          <p className="text-sm font-medium truncate">{show.name}</p>
                          {show.episodeCount && <span className="text-xs text-gray-500">{show.episodeCount} eps</span>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* DETAIL TAB */}
            <TabsContent value="detail">
              {!selectedShow ? <div className="text-center py-12 text-gray-500"><Film className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Select an anime first</p></div> : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <div className="aspect-[3/4] overflow-hidden rounded-t-lg">
                        {selectedShow.thumbnail ? <img src={selectedShow.thumbnail} alt={selectedShow.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-700 flex items-center justify-center"><Film className="w-12 h-12 text-gray-500" /></div>}
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <h2 className="text-lg font-bold">{selectedShow.name}</h2>
                        {showDetail?.genres?.map((g: string) => (<Badge key={g} variant="outline" className="text-xs border-gray-600">{g}</Badge>))}
                        {showDetail?.score && <Badge className="bg-red-600">Score: {showDetail.score.toFixed(1)}</Badge>}
                        {showDetail?.status && <p className="text-sm text-gray-400">Status: {showDetail.status}</p>}
                      </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-2 space-y-4">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader><CardTitle className="text-lg">Watch Episode</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex gap-3 items-center flex-wrap">
                          <div className="flex items-center gap-2"><label className="text-sm text-gray-400">Ep:</label><Input type="number" min="1" value={episodeNum} onChange={(e) => setEpisodeNum(e.target.value)} className="w-20 bg-gray-900 border-gray-700 text-white" /></div>
                          <div className="flex gap-1"><Button size="sm" variant={translationType === 'sub' ? 'default' : 'outline'} className={translationType === 'sub' ? 'bg-red-600' : 'border-gray-700'} onClick={() => setTranslationType('sub')}>Sub</Button><Button size="sm" variant={translationType === 'dub' ? 'default' : 'outline'} className={translationType === 'dub' ? 'bg-red-600' : 'border-gray-700'} onClick={() => setTranslationType('dub')}>Dub</Button></div>
                          <Button onClick={loadEpisode} disabled={animeLoading} className="bg-red-600 hover:bg-red-700"><Play className="w-4 h-4 mr-1" /> Load</Button>
                          {streams.length > 0 && <Button onClick={extractPlayableStreams} disabled={extracting} variant="outline" className="border-green-600 text-green-400">{extracting ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" />...</> : <><Zap className="w-4 h-4 mr-1" /> Extract</>}</Button>}
                        </div>
                        {animeError && <Card className="bg-red-950/50 border-red-800"><CardContent className="p-3"><p className="text-red-300 text-sm">{animeError}</p></CardContent></Card>}
                      </CardContent>
                    </Card>
                    {streams.length > 0 && (
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-red-500" /> Streams ({streams.length})</CardTitle></CardHeader>
                        <CardContent><div className="space-y-3">{streams.map((stream, i) => (
                          <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${typeColor(stream.type)}`}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">{typeIcon(stream.type)}<div className="min-w-0"><p className="text-sm font-medium">{stream.provider}</p><code className="text-xs text-gray-400 truncate max-w-md block">{stream.url}</code></div></div>
                            {(stream.type === 'm3u8' || stream.type === 'mp4') && <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => playStream(stream)}><Play className="w-3 h-3 mr-1" /> Play</Button>}
                          </div>
                        ))}</div></CardContent>
                      </Card>
                    )}
                    {extractedStreams.length > 0 && (
                      <Card className="bg-green-950/30 border-green-700">
                        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-green-400" /> Playable</CardTitle></CardHeader>
                        <CardContent><div className="space-y-3">{extractedStreams.map((stream, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-green-700 bg-green-950/30">
                            <div className="flex items-center gap-3"><Play className="w-5 h-5 text-green-500" /><div><p className="text-sm font-medium text-green-300">{stream.provider}</p><code className="text-xs text-green-400 break-all">{stream.url?.slice(0, 100)}</code></div></div>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setPlayerSrc(stream.proxyUrl || `/api/proxy/m3u8?url=${encodeURIComponent(stream.url)}`); setPlayerTitle(`${selectedShow?.name} - Ep ${episodeNum} [${stream.provider}]`); setAnimeTab('player'); }}><Play className="w-3 h-3 mr-1" /> Play</Button>
                          </div>
                        ))}</div></CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* PLAYER TAB */}
            <TabsContent value="player">
              {playerSrc ? (<><HlsPlayer src={playerSrc} title={playerTitle} /><Card className="bg-gray-800/50 border-gray-700 mt-4"><CardContent className="p-3"><p className="text-xs text-gray-400 mb-1">Stream URL:</p><div className="flex items-center gap-2"><code className="text-xs text-green-400 break-all flex-1">{playerSrc}</code><CopyBtn text={playerSrc} /></div></CardContent></Card></>) : <div className="text-center py-20 text-gray-500"><Play className="w-16 h-16 mx-auto mb-4 opacity-30" /><p className="text-lg">No stream loaded</p></div>}
            </TabsContent>

            {/* TEST LAB TAB */}
            <TabsContent value="test">
              <div className="space-y-6">
                <Card className="bg-gray-800/50 border-gray-700"><CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-red-500" /> Direct URL Test</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-gray-400">Paste any m3u8 or mp4 URL</p><div className="flex gap-2"><Input placeholder="https://example.com/stream.m3u8" value={testUrl} onChange={(e) => setTestUrl(e.target.value)} className="bg-gray-900 border-gray-700 text-white font-mono text-sm" /><Button onClick={() => { if (testUrl.trim()) { setPlayerSrc(testUrl.includes('/api/proxy/') ? testUrl : `/api/proxy/m3u8?url=${encodeURIComponent(testUrl.trim())}`); setPlayerTitle('Direct URL Test'); setAnimeTab('player'); } }} className="bg-red-600 hover:bg-red-700"><Play className="w-4 h-4 mr-1" /> Play</Button></div></CardContent></Card>
                <Card className="bg-gray-800/50 border-gray-700"><CardHeader><CardTitle>API Docs</CardTitle></CardHeader><CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-3">{[{ path: '/api/mkissa/search', desc: 'Search anime', params: 'q, sort, limit' },{ path: '/api/mkissa/show', desc: 'Show details', params: 'id' },{ path: '/api/mkissa/streams', desc: 'Episode streams', params: 'showId, episode, type' },{ path: '/api/proxy/m3u8', desc: 'CORS proxy', params: 'url' },].map((ep, i) => (<div key={i} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700"><Badge className="bg-green-700 text-xs mr-2">GET</Badge><code className="text-sm text-green-400">{ep.path}</code><p className="text-sm text-gray-300 mt-1">{ep.desc}</p><p className="text-xs text-gray-500">Params: {ep.params}</p></div>))}</div></ScrollArea></CardContent></Card>
              </div>
            </TabsContent>

            <TabsContent value="docs"><div className="text-center py-12 text-gray-500"><Info className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>See Test Lab tab for API docs</p></div></TabsContent>
          </Tabs>
        )}

        {/* ==================== MANGAFIRE SECTION ==================== */}
        {section === 'manga' && (
          <Tabs value={mangaTab} onValueChange={setMangaTab}>
            <TabsList className="bg-gray-800/50 border border-gray-700 mb-6">
              <TabsTrigger value="home" className="data-[state=active]:bg-orange-600"><Flame className="w-4 h-4 mr-1" /> Home</TabsTrigger>
              <TabsTrigger value="results" className="data-[state=active]:bg-orange-600"><Search className="w-4 h-4 mr-1" /> Search</TabsTrigger>
              <TabsTrigger value="detail" className="data-[state=active]:bg-orange-600"><BookMarked className="w-4 h-4 mr-1" /> Detail</TabsTrigger>
              <TabsTrigger value="reader" className="data-[state=active]:bg-orange-600"><BookOpen className="w-4 h-4 mr-1" /> Reader</TabsTrigger>
            </TabsList>

            {/* HOME TAB */}
            <TabsContent value="home">
              <div className="space-y-8">
                {/* Search Bar */}
                <div className="flex gap-2">
                  <Input placeholder="Search manga... (e.g. One Piece, Jujutsu Kaisen, Solo Leveling)" value={mangaSearchQuery} onChange={(e) => setMangaSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMangaSearch()} className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 flex-1" />
                  <Button onClick={() => handleMangaSearch()} disabled={mangaLoading} className="bg-orange-600 hover:bg-orange-700"><Search className="w-4 h-4 mr-1" /> Search</Button>
                </div>

                {/* Filters */}
                <div className="flex gap-3 flex-wrap">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-32 bg-gray-800/50 border-gray-700 text-gray-300"><Filter className="w-3 h-3 mr-1" /><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700"><SelectItem value="all">All Types</SelectItem><SelectItem value="manga">Manga</SelectItem><SelectItem value="manhwa">Manhwa</SelectItem><SelectItem value="manhua">Manhua</SelectItem><SelectItem value="novel">Novel</SelectItem><SelectItem value="one-shot">One-shot</SelectItem></SelectContent>
                  </Select>
                  <Select value={filterSort} onValueChange={setFilterSort}>
                    <SelectTrigger className="w-44 bg-gray-800/50 border-gray-700 text-gray-300"><SelectValue placeholder="Sort by" /></SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700"><SelectItem value="recently_updated">Recently Updated</SelectItem><SelectItem value="newest">Newest</SelectItem><SelectItem value="most_viewed">Most Viewed</SelectItem><SelectItem value="top_rated">Top Rated</SelectItem></SelectContent>
                  </Select>
                  <Select value={filterGenre} onValueChange={setFilterGenre}>
                    <SelectTrigger className="w-36 bg-gray-800/50 border-gray-700 text-gray-300"><SelectValue placeholder="Genre" /></SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 max-h-60">{['action','adventure','comedy','drama','fantasy','horror','mystery','romance','sci-fi','slice-of-life','sports','supernatural','suspense','ecchi','girls-love','boys-love'].map(g => <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {mangaError && <Card className="bg-red-950/50 border-red-800"><CardContent className="p-4"><p className="text-red-300 text-sm">{mangaError}</p></CardContent></Card>}

                {/* Cloudflare Cookie Config */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4 text-orange-500" />
                      Cloudflare Bypass
                      <Badge variant={cfCookieStatus ? "default" : "outline"} className={cfCookieStatus ? "bg-green-600 text-xs" : "border-gray-600 text-xs"}>
                        {cfCookieStatus ? 'Cookies Active' : 'No Cookies'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-gray-400">
                      mangafire.to uses Cloudflare protection. To access manga data, paste your browser cookies below.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder='Paste cookies: cf_clearance=xxx; ...'
                        value={cfCookieInput}
                        onChange={(e) => setCfCookieInput(e.target.value)}
                        className="bg-gray-900 border-gray-700 text-white text-xs font-mono"
                      />
                      <Button size="sm" onClick={setCFCookies} className="bg-orange-600 hover:bg-orange-700 shrink-0">
                        Set Cookies
                      </Button>
                    </div>
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-300">How to get cookies</summary>
                      <ol className="mt-2 space-y-1 pl-4 list-decimal">
                        <li>Open mangafire.to in your browser</li>
                        <li>Complete any Cloudflare verification</li>
                        <li>Open DevTools (F12) → Network tab</li>
                        <li>Refresh the page, click any request to mangafire.to</li>
                        <li>Copy the Cookie header value from Request Headers</li>
                        <li>Paste it above and click Set Cookies</li>
                      </ol>
                    </details>
                  </CardContent>
                </Card>

                {/* Popular Row */}
                <MangaRow title="Popular" icon={<TrendingUp className="w-5 h-5 text-orange-500" />} manga={homePopular} onSelect={selectManga} />

                {/* Latest Row */}
                <MangaRow title="Recently Updated" icon={<Clock className="w-5 h-5 text-blue-400" />} manga={homeLatest} onSelect={selectManga} />

                {/* Newest Row */}
                <MangaRow title="Newest Added" icon={<Star className="w-5 h-5 text-green-400" />} manga={homeNewest} onSelect={selectManga} />
              </div>
            </TabsContent>

            {/* RESULTS TAB */}
            <TabsContent value="results">
              <div className="space-y-6">
                <div className="flex gap-2 items-center">
                  <Input placeholder="Search manga..." value={mangaSearchQuery} onChange={(e) => setMangaSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMangaSearch(mangaSearchQuery, 1)} className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 flex-1" />
                  <Button onClick={() => handleMangaSearch(mangaSearchQuery, 1)} disabled={mangaLoading} className="bg-orange-600 hover:bg-orange-700"><Search className="w-4 h-4 mr-1" /> Search</Button>
                  <Button variant="outline" onClick={() => setMangaTab('home')} className="border-gray-700 text-gray-300"><X className="w-4 h-4 mr-1" /> Back</Button>
                </div>

                {mangaLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (<div key={i} className="space-y-2"><Skeleton className="aspect-[3/4] rounded-lg bg-gray-800" /><Skeleton className="h-4 w-3/4 bg-gray-800" /></div>))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {mangaResults.map(manga => <MangaCard key={manga.id} manga={manga} onClick={() => selectManga(manga)} />)}
                    </div>
                    {mangaResults.length === 0 && !mangaError && (
                      <div className="text-center py-12 text-gray-500"><BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Search for manga or browse from Home</p></div>
                    )}
                    {/* Pagination */}
                    <div className="flex items-center justify-center gap-3 pt-4">
                      <Button variant="outline" disabled={mangaPage <= 1} onClick={() => handleMangaSearch(mangaSearchQuery, mangaPage - 1)} className="border-gray-700 text-gray-300"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
                      <span className="text-sm text-gray-400">Page {mangaPage}</span>
                      <Button variant="outline" disabled={!mangaHasNextPage} onClick={() => handleMangaSearch(mangaSearchQuery, mangaPage + 1)} className="border-gray-700 text-gray-300">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* DETAIL TAB */}
            <TabsContent value="detail">
              {!selectedManga ? <div className="text-center py-12 text-gray-500"><BookMarked className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Select a manga from Search or Home</p></div> : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Manga Info */}
                  <div className="lg:col-span-1">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <div className="aspect-[3/4] overflow-hidden rounded-t-lg">
                        {selectedManga.thumbnail ? <img src={selectedManga.thumbnail} alt={mangaInfo?.title || selectedManga.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-700 flex items-center justify-center"><BookOpen className="w-12 h-12 text-gray-500" /></div>}
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <h2 className="text-lg font-bold">{mangaInfo?.title || selectedManga.title}</h2>
                        {mangaInfo?.altTitle && <p className="text-sm text-gray-400">{mangaInfo.altTitle}</p>}
                        <div className="flex flex-wrap gap-1">
                          <Badge className="bg-orange-600 text-xs">{mangaInfo?.status || 'Unknown'}</Badge>
                          {mangaInfo?.type && <Badge variant="outline" className="text-xs border-gray-600">{mangaInfo.type}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {mangaInfo?.genres?.map(g => <Badge key={g} variant="outline" className="text-xs border-gray-600">{g}</Badge>)}
                        </div>
                        {mangaInfo?.author && <p className="text-sm text-gray-400">Author: {mangaInfo.author}</p>}
                        {mangaInfo?.description && (
                          <p className="text-xs text-gray-400 line-clamp-8 whitespace-pre-line">
                            {mangaInfo.description.replace(/<[^>]*>/g, '').replace(/Alternative title:.*$/s, '').trim()}
                          </p>
                        )}
                        <Button variant="outline" onClick={() => setMangaTab(mangaTab === 'detail' ? 'results' : 'home')} className="border-gray-700 text-gray-300 w-full">
                          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Browse
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Chapter List */}
                  <div className="lg:col-span-2">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Library className="w-5 h-5 text-orange-500" />
                          Chapters ({mangaInfo?.chapters?.length || 0})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {mangaLoading ? (
                          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 bg-gray-700" />)}</div>
                        ) : mangaInfo?.chapters?.length ? (
                          <ScrollArea className="max-h-[70vh]">
                            <div className="space-y-1">
                              {mangaInfo.chapters
                                .sort((a, b) => b.number - a.number)
                                .map(ch => (
                                <button
                                  key={ch.id}
                                  onClick={() => readChapter(ch)}
                                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/50 transition text-left group"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <BookOpen className="w-4 h-4 text-orange-500 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium group-hover:text-orange-400 transition truncate">{ch.title}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2 shrink-0">
                                    <span className="text-xs text-gray-500">{ch.date}</span>
                                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Library className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No chapters available</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* READER TAB */}
            <TabsContent value="reader">
              <div className="space-y-4">
                {/* Back button */}
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={() => setMangaTab('detail')} className="border-gray-700 text-gray-300">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to Chapters
                  </Button>
                  {readingChapter && <span className="text-sm text-gray-400">{readingChapter.title}</span>}
                </div>

                {pagesLoading ? (
                  <div className="text-center py-20">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-orange-500" />
                    <p className="text-gray-400">Loading chapter pages...</p>
                    <p className="text-xs text-gray-500 mt-2">Bypassing Cloudflare and fetching images</p>
                  </div>
                ) : mangaError ? (
                  <Card className="bg-red-950/50 border-red-800">
                    <CardContent className="p-6 text-center">
                      <Shield className="w-12 h-12 mx-auto mb-3 text-red-400" />
                      <p className="text-red-300 mb-2">{mangaError}</p>
                      <p className="text-xs text-gray-400">Cloudflare protection may be blocking the request. Try again or use a different chapter.</p>
                      <Button onClick={() => readingChapter && readChapter(readingChapter)} className="mt-4 bg-orange-600 hover:bg-orange-700">
                        <RefreshCw className="w-4 h-4 mr-1" /> Retry
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <MangaReader pages={mangaPages} chapterTitle={readingChapter?.title || ''} />
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-600">
            Mkissa Scraper · Anime (mkissa.to) · Manga (mangafire.to) · Cloudflare Bypass · Image Descrambling
          </p>
        </div>
      </footer>
    </div>
  );
}
