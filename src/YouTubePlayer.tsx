import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiReady = false;
let apiLoading = false;
const waiters: (() => void)[] = [];

function loadYTApi(): Promise<void> {
  if (apiReady) return Promise.resolve();
  return new Promise((resolve) => {
    waiters.push(resolve);
    if (apiLoading) return;
    apiLoading = true;
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      prev?.();
      for (const w of waiters) w();
      waiters.length = 0;
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
}

export interface YouTubePlayerHandle {
  pause: () => void;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, {
  videoId: string;
  onEnded?: () => void;
}>(({ videoId, onEnded }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useImperativeHandle(ref, () => ({
    pause: () => {
      playerRef.current?.pauseVideo?.();
    },
  }));

  useEffect(() => {
    let destroyed = false;

    loadYTApi().then(() => {
      if (destroyed || !containerRef.current) return;

      // Clear any previous content
      containerRef.current.innerHTML = "";
      const el = document.createElement("div");
      containerRef.current.appendChild(el);

      playerRef.current = new window.YT.Player(el, {
        videoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              onEndedRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  return (
    <div
      ref={containerRef}
      id="tubo-player"
      className="w-full aspect-video [&>div]:w-full [&>div]:h-full [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:rounded-xl"
    />
  );
});

export default YouTubePlayer;
