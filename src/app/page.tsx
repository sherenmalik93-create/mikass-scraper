'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, Play, ExternalLink, Tv, Film, Globe,
  Volume2, VolumeX, Maximize, Pause, RefreshCw,
  Download, Zap, Server, Info, Shield, Lock, Unlock, Copy, Check
} from 'lucide-react';

// Types
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

// ========== HLS Player Component ==========
function HlsPlayer({ src, title }: { src: string; title?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ height: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

  useEffect(() => {
    if (!src || !videoRef.current) return;

    const initPlayer = async () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const video = videoRef.current;
      setLoading(true);
      setError(null);

      if (src.includes('.m3u8')) {
        const Hls = (await import('hls.js')).default;

        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          });

          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (_e: any, data: any) => {
            setLoading(false);
            setLevels(data.levels?.map((l: any) => ({ height: l.height })) || []);
            video.play().catch(() => {});
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_e: any, data: any) => {
            setCurrentLevel(data.level);
          });

          hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
            if (data.fatal) {
              setError(`${data.type}: ${data.details}`);
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
              else hls.destroy();
            }
          });

          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src;
          video.addEventListener('loadedmetadata', () => { setLoading(false); video.play().catch(() => {}); });
        }
      } else {
        video.src = src;
        video.addEventListener('loadeddata', () => { setLoading(false); video.play().catch(() => {}); });
        video.addEventListener('error', () => { setError('Failed to load video'); setLoading(false); });
      }
    };

    initPlayer();
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) { document.exitFullscreen(); } else { v.requestFullscreen(); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {title && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-3">
          <p className="text-white text-sm font-medium truncate">{title}</p>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full aspect-video"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
        onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration)}
        onClick={togglePlay}
        playsInline
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-4">
            <p className="text-red-400 text-sm mb-2">{error}</p>
            <Button size="sm" variant="outline" onClick={() => { setError(null); setLoading(true); hlsRef.current?.startLoad(); }}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
        <div className="w-full h-1.5 bg-white/20 rounded cursor-pointer mb-2" onClick={seek}>
          <div className="h-full bg-red-500 rounded transition-all" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white hover:text-red-400 transition">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={toggleMute} className="text-white hover:text-red-400 transition">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <span className="text-white/70 text-xs">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-2">
            {levels.length > 0 && (
              <span className="text-white/50 text-xs">
                {currentLevel >= 0 ? `${levels[currentLevel]?.height}p` : 'Auto'}
              </span>
            )}
            <button onClick={toggleFullscreen} className="text-white hover:text-red-400 transition">
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Copy Button ==========
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className="text-gray-500 hover:text-gray-300 transition">
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

// ========== Main Page ==========
export default function MkissaScraperPage() {
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AnimeShow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedShow, setSelectedShow] = useState<AnimeShow | null>(null);
  const [showDetail, setShowDetail] = useState<any>(null);

  const [episodeNum, setEpisodeNum] = useState('1');
  const [translationType, setTranslationType] = useState<'sub' | 'dub'>('sub');
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [episodeData, setEpisodeData] = useState<any>(null);

  const [playerSrc, setPlayerSrc] = useState<string | null>(null);
  const [playerTitle, setPlayerTitle] = useState<string>('');

  const [testUrl, setTestUrl] = useState('');

  const handleSearch = async (query?: string) => {
    const q = query || searchQuery;
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearchQuery(q);
    try {
      const res = await fetch(`/api/mkissa/search?q=${encodeURIComponent(q)}&limit=25`);
      const data = await res.json();
      if (data.success) setSearchResults(data.shows || []);
      else setError(data.error || 'Search failed');
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const loadBrowse = async (sort: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mkissa/search?sort=${sort}&limit=25`);
      const data = await res.json();
      if (data.success) setSearchResults(data.shows || []);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const selectShow = async (show: AnimeShow) => {
    setSelectedShow(show);
    setLoading(true);
    try {
      const res = await fetch(`/api/mkissa/show?id=${show._id}`);
      const data = await res.json();
      if (data.success) { setShowDetail(data.show); setActiveTab('detail'); }
      else setError(data.error || 'Failed to load show');
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const loadEpisode = async () => {
    if (!selectedShow?._id || !episodeNum) return;
    setLoading(true);
    setError(null);
    setStreams([]);
    setEpisodeData(null);
    try {
      const res = await fetch(`/api/mkissa/streams?showId=${selectedShow._id}&episode=${episodeNum}&type=${translationType}`);
      const data = await res.json();
      if (data.success) { setEpisodeData(data); setStreams(data.streams || []); }
      else setError(data.error || 'Failed to load episode');
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const playStream = (stream: StreamInfo) => {
    if (stream.type === 'm3u8' || stream.type === 'mp4') {
      const proxyUrl = stream.proxyUrl || `/api/proxy/m3u8?url=${encodeURIComponent(stream.url)}`;
      setPlayerSrc(proxyUrl);
      setPlayerTitle(`${selectedShow?.name || 'Unknown'} - Ep ${episodeNum} [${stream.provider}]`);
      setActiveTab('player');
    }
  };

  const playDirectUrl = () => {
    if (!testUrl.trim()) return;
    const proxyUrl = testUrl.includes('/api/proxy/') ? testUrl : `/api/proxy/m3u8?url=${encodeURIComponent(testUrl.trim())}`;
    setPlayerSrc(proxyUrl);
    setPlayerTitle('Direct URL Test');
    setActiveTab('player');
  };

  // Load popular on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mkissa/search?sort=Popular&limit=25`);
        const data = await res.json();
        if (!cancelled && data.success) setSearchResults(data.shows || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'clock': return <Lock className="w-4 h-4 text-yellow-500" />;
      case 'iframe': return <ExternalLink className="w-4 h-4 text-blue-400" />;
      case 'm3u8': return <Play className="w-4 h-4 text-green-500" />;
      case 'mp4': return <Film className="w-4 h-4 text-purple-400" />;
      default: return <Server className="w-4 h-4 text-gray-400" />;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'clock': return 'border-yellow-700 bg-yellow-950/30';
      case 'iframe': return 'border-blue-700 bg-blue-950/30';
      case 'm3u8': return 'border-green-700 bg-green-950/30';
      case 'mp4': return 'border-purple-700 bg-purple-950/30';
      default: return 'border-gray-700 bg-gray-900/50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 rounded-lg p-2">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Mkissa Scraper</h1>
              <p className="text-xs text-gray-400">mkissa.to anime stream extractor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-400 border-green-800">
              <Zap className="w-3 h-3 mr-1" /> API Online
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-800/50 border border-gray-700 mb-6">
            <TabsTrigger value="search" className="data-[state=active]:bg-red-600">
              <Search className="w-4 h-4 mr-1" /> Search
            </TabsTrigger>
            <TabsTrigger value="detail" className="data-[state=active]:bg-red-600">
              <Film className="w-4 h-4 mr-1" /> Detail
            </TabsTrigger>
            <TabsTrigger value="player" className="data-[state=active]:bg-red-600">
              <Play className="w-4 h-4 mr-1" /> Player
            </TabsTrigger>
            <TabsTrigger value="test" className="data-[state=active]:bg-red-600">
              <Globe className="w-4 h-4 mr-1" /> Test Lab
            </TabsTrigger>
            <TabsTrigger value="docs" className="data-[state=active]:bg-red-600">
              <Info className="w-4 h-4 mr-1" /> API Docs
            </TabsTrigger>
          </TabsList>

          {/* ===== SEARCH TAB ===== */}
          <TabsContent value="search">
            <div className="space-y-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Search anime... (e.g. Naruto, One Piece, Jujutsu Kaisen)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 flex-1"
                />
                <Button onClick={() => handleSearch()} disabled={loading} className="bg-red-600 hover:bg-red-700">
                  <Search className="w-4 h-4 mr-1" /> Search
                </Button>
                <Button onClick={() => loadBrowse('Popular')} variant="outline" className="border-gray-700 text-gray-300">
                  Popular
                </Button>
                <Button onClick={() => loadBrowse('Recent')} variant="outline" className="border-gray-700 text-gray-300">
                  Latest
                </Button>
              </div>

              {error && (
                <Card className="bg-red-950/50 border-red-800">
                  <CardContent className="p-4"><p className="text-red-300 text-sm">{error}</p></CardContent>
                </Card>
              )}

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="aspect-[3/4] rounded-lg bg-gray-800" />
                      <Skeleton className="h-4 w-3/4 bg-gray-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {searchResults.map((show) => (
                    <Card
                      key={show._id}
                      className="bg-gray-800/50 border-gray-700 hover:border-red-600 transition cursor-pointer group"
                      onClick={() => selectShow(show)}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg">
                        {show.thumbnail ? (
                          <img
                            src={show.thumbnail}
                            alt={show.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                            <Film className="w-8 h-8 text-gray-500" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        {show.score && <Badge className="absolute top-2 right-2 bg-red-600 text-xs">{show.score.toFixed(1)}</Badge>}
                        {show.type && <Badge variant="outline" className="absolute top-2 left-2 bg-black/50 text-xs border-gray-600">{show.type}</Badge>}
                      </div>
                      <CardContent className="p-2">
                        <p className="text-sm font-medium truncate">{show.name}</p>
                        {show.englishName && show.englishName !== show.name && (
                          <p className="text-xs text-gray-400 truncate">{show.englishName}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {show.episodeCount && <span className="text-xs text-gray-500">{show.episodeCount} eps</span>}
                          {show.season && <span className="text-xs text-gray-500">· {show.season.quarter} {show.season.year}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!loading && searchResults.length === 0 && !error && (
                <div className="text-center py-12 text-gray-500">
                  <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Search for anime or click Popular/Latest to browse</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== DETAIL TAB ===== */}
          <TabsContent value="detail">
            {!selectedShow ? (
              <div className="text-center py-12 text-gray-500">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select an anime from Search tab first</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Show Info */}
                <div className="lg:col-span-1">
                  <Card className="bg-gray-800/50 border-gray-700">
                    <div className="aspect-[3/4] overflow-hidden rounded-t-lg">
                      {selectedShow.thumbnail ? (
                        <img src={selectedShow.thumbnail} alt={selectedShow.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-700 flex items-center justify-center"><Film className="w-12 h-12 text-gray-500" /></div>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <h2 className="text-lg font-bold">{selectedShow.name}</h2>
                      {selectedShow.englishName && selectedShow.englishName !== selectedShow.name && (
                        <p className="text-sm text-gray-400">{selectedShow.englishName}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {showDetail?.genres?.map((g: string) => (
                          <Badge key={g} variant="outline" className="text-xs border-gray-600">{g}</Badge>
                        ))}
                      </div>
                      {showDetail?.score && <Badge className="bg-red-600">Score: {showDetail.score.toFixed(1)}</Badge>}
                      {showDetail?.status && <p className="text-sm text-gray-400">Status: {showDetail.status}</p>}
                      {showDetail?.description && (
                        <p className="text-xs text-gray-400 line-clamp-8">
                          {showDetail.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Episode Selection & Streams */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader><CardTitle className="text-lg">Watch Episode</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-3 items-center flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-400">Episode:</label>
                          <Input type="number" min="1" value={episodeNum} onChange={(e) => setEpisodeNum(e.target.value)} className="w-20 bg-gray-900 border-gray-700 text-white" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-400">Type:</label>
                          <div className="flex gap-1">
                            <Button size="sm" variant={translationType === 'sub' ? 'default' : 'outline'} className={translationType === 'sub' ? 'bg-red-600' : 'border-gray-700'} onClick={() => setTranslationType('sub')}>Sub</Button>
                            <Button size="sm" variant={translationType === 'dub' ? 'default' : 'outline'} className={translationType === 'dub' ? 'bg-red-600' : 'border-gray-700'} onClick={() => setTranslationType('dub')}>Dub</Button>
                          </div>
                        </div>
                        <Button onClick={loadEpisode} disabled={loading} className="bg-red-600 hover:bg-red-700">
                          <Play className="w-4 h-4 mr-1" /> Load Streams
                        </Button>
                      </div>

                      {loading && (
                        <div className="space-y-2">
                          <Skeleton className="h-12 bg-gray-700" />
                          <Skeleton className="h-12 bg-gray-700" />
                          <Skeleton className="h-12 bg-gray-700" />
                        </div>
                      )}

                      {error && (
                        <Card className="bg-red-950/50 border-red-800">
                          <CardContent className="p-3"><p className="text-red-300 text-sm">{error}</p></CardContent>
                        </Card>
                      )}
                    </CardContent>
                  </Card>

                  {/* Stream Results */}
                  {streams.length > 0 && (
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Zap className="w-5 h-5 text-red-500" /> Available Streams ({streams.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {streams.map((stream, i) => (
                            <div
                              key={i}
                              className={`flex items-center justify-between p-3 rounded-lg border ${typeColor(stream.type)} hover:brightness-110 transition`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {typeIcon(stream.type)}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{stream.provider}</p>
                                    <Badge variant="outline" className="text-xs border-gray-600">
                                      {stream.type === 'clock' ? 'CF Protected' : stream.type.toUpperCase()}
                                    </Badge>
                                    {stream.quality && <span className="text-xs text-gray-500">{stream.quality}</span>}
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <code className="text-xs text-gray-400 truncate max-w-md">{stream.url}</code>
                                    <CopyBtn text={stream.url} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                {(stream.type === 'm3u8' || stream.type === 'mp4') && (
                                  <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => playStream(stream)}>
                                    <Play className="w-3 h-3 mr-1" /> Play
                                  </Button>
                                )}
                                {stream.type === 'iframe' && (
                                  <a href={stream.url} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="border-blue-600 text-blue-400">
                                      <ExternalLink className="w-3 h-3 mr-1" /> Open
                                    </Button>
                                  </a>
                                )}
                                {stream.type === 'clock' && (
                                  <a href={stream.url} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="border-yellow-600 text-yellow-400">
                                      <Shield className="w-3 h-3 mr-1" /> Try
                                    </Button>
                                  </a>
                                )}
                                <a href={stream.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Info notice */}
                        <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                          <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                            <div className="text-xs text-gray-400 space-y-1">
                              <p><strong className="text-yellow-400">CF Protected</strong> sources require Cloudflare bypass. Open in browser to solve the challenge.</p>
                              <p><strong className="text-blue-400">Iframe</strong> sources are embed pages — open them in your browser to watch the stream.</p>
                              <p><strong className="text-green-400">M3U8/MP4</strong> sources can be played directly through the built-in HLS player.</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Raw Episode Data */}
                  {episodeData?.rawSources?.length > 0 && (
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader><CardTitle className="text-sm">Raw Decrypted Source URLs</CardTitle></CardHeader>
                      <CardContent>
                        <ScrollArea className="max-h-64">
                          <div className="space-y-2">
                            {episodeData.rawSources.map((src: any, i: number) => (
                              <div key={i} className="text-xs bg-gray-900/50 p-2 rounded border border-gray-700">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-gray-300">{src.sourceName}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs border-gray-600">{src.type || src.stype}</Badge>
                                    <Badge variant="outline" className="text-xs border-gray-600">Pri: {src.priority}</Badge>
                                  </div>
                                </div>
                                <code className="text-green-400 break-all">{src.sourceUrl}</code>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Episode Info */}
                  {episodeData?.episodeInfo && (
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader><CardTitle className="text-sm">Episode Info</CardTitle></CardHeader>
                      <CardContent>
                        {episodeData.episodeInfo.vidInforssub && (
                          <div className="text-xs space-y-1 mb-2">
                            <p className="font-medium text-gray-300">Sub:</p>
                            <p>Resolution: {episodeData.episodeInfo.vidInforssub.vidResolution}p</p>
                            <p>Duration: {Math.round(episodeData.episodeInfo.vidInforssub.vidDuration)}s</p>
                            <p>Size: {(episodeData.episodeInfo.vidInforssub.vidSize / 1024 / 1024).toFixed(1)} MB</p>
                            <code className="text-green-400">{episodeData.episodeInfo.vidInforssub.vidPath}</code>
                          </div>
                        )}
                        {episodeData.episodeInfo.vidInforsdub && (
                          <div className="text-xs space-y-1">
                            <p className="font-medium text-gray-300">Dub:</p>
                            <p>Resolution: {episodeData.episodeInfo.vidInforsdub.vidResolution}p</p>
                            <code className="text-green-400">{episodeData.episodeInfo.vidInforsdub.vidPath}</code>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== PLAYER TAB ===== */}
          <TabsContent value="player">
            <div className="space-y-4">
              {playerSrc ? (
                <>
                  <HlsPlayer src={playerSrc} title={playerTitle} />
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-3">
                      <p className="text-xs text-gray-400 mb-1">Stream URL (proxied):</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-green-400 break-all flex-1">{playerSrc}</code>
                        <CopyBtn text={playerSrc} />
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  <Play className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">No stream loaded</p>
                  <p className="text-sm">Search for anime and load an episode to play</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== TEST LAB TAB ===== */}
          <TabsContent value="test">
            <div className="space-y-6">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-red-500" /> Direct URL Test
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">Paste any m3u8 or mp4 URL to test playback through the CORS proxy</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/stream.m3u8"
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      className="bg-gray-900 border-gray-700 text-white font-mono text-sm"
                    />
                    <Button onClick={playDirectUrl} className="bg-red-600 hover:bg-red-700">
                      <Play className="w-4 h-4 mr-1" /> Play
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader><CardTitle className="flex items-center gap-2"><Server className="w-5 h-5 text-red-500" /> Proxy Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                      <p className="text-sm font-medium mb-1">M3U8/Media Proxy</p>
                      <code className="text-xs text-green-400">/api/proxy/m3u8?url=</code>
                      <p className="text-xs text-gray-500 mt-1">Rewrites playlists, streams segments</p>
                    </div>
                    <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                      <p className="text-sm font-medium mb-1">API Proxy</p>
                      <code className="text-xs text-green-400">/api/proxy/api?...</code>
                      <p className="text-xs text-gray-500 mt-1">Forwards to api.allanime.day</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader><CardTitle className="text-sm">Quick Test: API Connectivity</CardTitle></CardHeader>
                <CardContent className="flex gap-2">
                  <Button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/mkissa/search?q=naruto&limit=3');
                        const data = await res.json();
                        alert(data.success ? `API works! Found ${data.shows?.length || 0} results` : `API error: ${data.error}`);
                      } catch (err: any) { alert(`API test failed: ${err.message}`); }
                    }}
                    variant="outline"
                    className="border-gray-700 text-gray-300"
                  >
                    <Zap className="w-4 h-4 mr-1" /> Test Search API
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/mkissa/streams?showId=ReooPAxPMsHM4KPMY&episode=1&type=sub');
                        const data = await res.json();
                        alert(data.success ? `Stream API works! ${data.streams?.length || 0} sources found` : `Error: ${data.error}`);
                      } catch (err: any) { alert(`Stream test failed: ${err.message}`); }
                    }}
                    variant="outline"
                    className="border-gray-700 text-gray-300"
                  >
                    <Play className="w-4 h-4 mr-1" /> Test Stream API
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== API DOCS TAB ===== */}
          <TabsContent value="docs">
            <div className="space-y-4">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader><CardTitle>API Endpoints</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[70vh]">
                    <div className="space-y-4">
                      {[
                        { method: 'GET', path: '/api/mkissa/search', desc: 'Search anime by query or browse by sort', params: 'q (query), sort (Recent/Popular/Random), page, limit, type (sub/dub)' },
                        { method: 'GET', path: '/api/mkissa/show', desc: 'Get anime show details by ID', params: 'id (show ID from search)' },
                        { method: 'GET', path: '/api/mkissa/episodes', desc: 'Get episode sources (encrypted, auto-decrypted)', params: 'showId, episode (number), type (sub/dub)' },
                        { method: 'GET', path: '/api/mkissa/streams', desc: 'Get categorized stream URLs from episode sources', params: 'showId, episode (number), type (sub/dub)' },
                        { method: 'GET', path: '/api/proxy/m3u8', desc: 'CORS proxy for m3u8/mp4 streams', params: 'url (target stream URL)' },
                        { method: 'GET', path: '/api/proxy/api', desc: 'CORS proxy for AllAnime GraphQL API', params: 'Forward query params to api.allanime.day' },
                      ].map((ep, i) => (
                        <div key={i} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-green-700 text-xs">{ep.method}</Badge>
                            <code className="text-sm text-green-400">{ep.path}</code>
                          </div>
                          <p className="text-sm text-gray-300 mb-1">{ep.desc}</p>
                          <p className="text-xs text-gray-500">Params: {ep.params}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader><CardTitle>How It Works</CardTitle></CardHeader>
                <CardContent className="text-sm text-gray-300 space-y-3">
                  <p><strong className="text-white">1. Search/Browse:</strong> Uses AllAnime GraphQL API at api.allanime.day with persisted query hashes. Origin header set to mkissa.to.</p>
                  <p><strong className="text-white">2. Episode Sources:</strong> API returns AES-256-CTR encrypted data. Key: SHA-256(&quot;Xot36i3lK3:v1&quot;). Auto-decrypted to get source URLs with XOR decoding.</p>
                  <p><strong className="text-white">3. Source Types:</strong></p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><span className="text-green-400 font-bold">M3U8/MP4</span> — Direct stream URLs, playable through HLS player</li>
                    <li><span className="text-blue-400 font-bold">Iframe</span> — Embed pages (Filemoon, MP4Upload, etc.), open in browser</li>
                    <li><span className="text-yellow-400 font-bold">CF Protected</span> — AllAnime clock endpoint, Cloudflare-protected</li>
                  </ul>
                  <p><strong className="text-white">4. CORS Proxy:</strong> Rewrites m3u8 playlist URLs so HLS.js can follow master → variant → segment chain. Binary segments streamed with proper Referer headers.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-gray-800 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-600">Mkissa Scraper · mkissa.to API · AES-256-CTR Decryption · Vercel Ready</p>
        </div>
      </footer>
    </div>
  );
}
