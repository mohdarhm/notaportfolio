"use client"

import { codestuff, nunito } from "@/config/fonts";
import { arts } from "@/config/portal/ascii";
import { LyricLine, timelineEvents } from "@/config/portal/lyrics";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import AudioMotionAnalyzer from "audiomotion-analyzer";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, CloudLightning, List, VolumeX } from "react-feather";
import { Button, Image } from "@heroui/react"
import { mobileVisOptions, visOptions } from "@/config/portal/visualizer";
import { time } from "console";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)); // helper

export default function Portal() {
  const [isMobile, setIsMobile] = useState(false);

  const [hasAudio, setHasAudio] = useState(true); // this is just for rendering an alternate ui

  const [showContent, setShowContent] = useState(false);

  const [displayedLyrics, setDisplayedLyrics] = useState("");
  const [currentAsciiArt, setCurrentAsciiArt] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  // this is the best i could come up with
  const [taskQueue, setTaskQueue] = useState<LyricLine[]>([]);
  const [artTaskQueue, setArtTaskQueue] = useState<LyricLine[]>([]);

  const animationFrameId = useRef<number>();
  const startTime = useRef<number>(0);
  const eventIndex = useRef<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioMotionRef = useRef<AudioMotionAnalyzer | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingArt, setIsProcessingArt] = useState(false);

  const [animationEnded, setAnimationEnded] = useState(false)

  const [logs, SetLogs] = useState<String[]>([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetch("/portal/song.mp3", { method: "HEAD" })
      .then((res) => {
        setHasAudio(res.ok)
        SetLogs(prev => [...prev, `Audio has been fetched I hope`])
      })
      .catch(() => setHasAudio(false));
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 767);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);



  /*
    THE FOLLOWING USEEFFECT IS OUR ROUTER. IT HAS TO ITERATE THROUGH ALL TIMELINE OBJECTS AND SCHEDULE THEM FOR EXECUTION
    IT DOESNT LOOP THROUGH IN THE TRADITIONAL SENSE. WE MAINTAIN A GLOBAL COUNTER OF WHERE WE ARE IN THE ARRAY
  
      00:10 -> requestAnimationFrame loop runs. It calculates elapsedTime is 100cs.
      Router -> Checks timelineEvents. Finds an event at time 100: { text: "Hello", mode: "LYRIC_NEWLINE" }.
      Router -> Adds this object to taskQueue state.
      React -> Detects state change (taskQueue). Re-renders.
      Consumer Effect -> Sees taskQueue has an item and isProcessing is false.
      Consumer Effect -> Sets isProcessing = true. Calculates it needs to type 1 letter every 50ms.
      Async Work -> Calls typeLyrics. The function types "H"... waits... "e"... waits... "l"...
          Note: While this is happening, the Router loop is STILL running in the background tracking time, but it won't 
          trigger the Consumer again because isProcessing is true.
      Consumer Effect -> Typing finishes. Removes item from queue. Sets isProcessing = false.
      React -> Re-renders. If the Router added another line while we were typing, the Consumer immediately picks it up now.
   */
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      return;
    }

    SetLogs(prev => [...prev, `Animation started. Identified ${timelineEvents.length} timeline events.`]);

    // the step function has to take timestamp arg here to calculate progression. otherwise the animation runs faster on high refresh rates.
    const step = (timestamp: number) => {
      // for the first frame, current browser time is "zero"
      if (startTime.current === 0) startTime.current = timestamp;

      // the difference of current browser time and
      const elapsedTime = (timestamp - startTime.current) / 10; // convert to centi-seconds

      /* 
        We use a WHILE loop here, not an IF.
        Why? If the browser lags and misses a frame, elapsedTime might jump forward significantly.
        We need to process ALL events that happened between the last frame and now.
      */
      while (
        eventIndex.current < timelineEvents.length &&
        elapsedTime >= timelineEvents[eventIndex.current].time
      ) {
        const event = timelineEvents[eventIndex.current];


        switch (event.mode) {
          case 'LYRIC_NEWLINE':
          case 'LYRIC_NONEWLINE':
            setTaskQueue(prev => [...prev, event]);
            break;

          case 'DRAW_ART':
            setArtTaskQueue(prev => [...prev, event]);
            break;

          case 'CLEAR_LYRICS':
            SetLogs(prev => [...prev, `Clearing lyrics display`])
            setDisplayedLyrics("");
            break;

          case 'START_MUSIC':
            startVisualizer();
            break;

          case 'END':
            SetLogs(prev => [...prev, `Stopping..`])
            setAnimationEnded(true);
            setIsPlaying(false);
            return;

        }

        eventIndex.current++;
      }

      // queue the next frame
      animationFrameId.current = requestAnimationFrame(step);
    };

    // requests the browser to call step before the next repaint. this way we are kickstarting our animation
    animationFrameId.current = requestAnimationFrame(step);

    // If the component unmounts, kill the loop.
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    }

  }, [isPlaying]);

  // the lyrics consumer
  useEffect(() => {

    if (!isProcessing && taskQueue.length > 0) {

      // Peek at the first item (FIFO - First In First Out)
      const task = taskQueue[0];

      (async () => {
        setIsProcessing(true);

        const text = task.words as string;
        const charCount = text.length > 0 ? text.length : 1;

        let perCharacterIntervalMs = 50;

        if (task.interval < 0) {
          const nextEvent = timelineEvents[timelineEvents.indexOf(task) + 1];

          if (nextEvent) {
            const duration = nextEvent.time - task.time;
            perCharacterIntervalMs = (duration * 10) / charCount; // same cs factor
            SetLogs(prev => [...prev, `dynamic interval for "${task.words}" based on next event is ${perCharacterIntervalMs.toFixed(2)}ms`])
          }

        } else {
          perCharacterIntervalMs = (task.interval * 1000) / charCount;
        }

        await typeLyrics(text, perCharacterIntervalMs, task.mode === 'LYRIC_NEWLINE');

        setTaskQueue(currentQueue => currentQueue.slice(1)); // removed from q
        setIsProcessing(false); // unlock for next
      })();
    }
  }, [taskQueue, isProcessing]);


  useEffect(() => {
    if (!isProcessingArt && artTaskQueue.length > 0) {
      const task = artTaskQueue[0];

      (async () => {
        setIsProcessingArt(true);

        SetLogs(prev => [...prev, `Drawing ASCII art index ${task.words}`])
        await drawAsciiArt(task.words as number);

        setArtTaskQueue(currentQueue => currentQueue.slice(1));
        setIsProcessingArt(false);
      })();
    }
  }, [artTaskQueue, isProcessingArt]); // this dependency array ensures it runs when the artTaskQueue changes

  const typeLyrics = async (text: string, intervalMs: number, addNewline: boolean) => {

    SetLogs(prev => [...prev, `Typing lyrics: "${text}" with interval ${intervalMs.toFixed(2)}ms`])
    for (const char of text) {
      setDisplayedLyrics(prev => prev + char);
      await sleep(intervalMs);
    }

    if (addNewline) {
      setDisplayedLyrics(prev => prev + '\n');
    }
  }

  const drawAsciiArt = async (artIndex: number) => {
    setCurrentAsciiArt("");
    const artToDraw = arts[artIndex];
    if (!artToDraw) return;

    let drawnArt = "";
    for (const line of artToDraw) {
      drawnArt += line + '\n';
      setCurrentAsciiArt(drawnArt);
    }
  }

  const startVisualizer = async () => {
    if (!containerRef.current || audioMotionRef.current) return;

    const audioMotion = new AudioMotionAnalyzer(containerRef.current, isMobile ? mobileVisOptions : visOptions);

    const audioEl = document.getElementById("audio") as HTMLAudioElement;
    if (audioEl) {
      SetLogs(prev => [...prev, `Starting audio playback..`])
      audioMotion.connectInput(audioEl);
      await audioEl.play();
    }

    audioMotionRef.current = audioMotion;

  };

  const handleStart = () => {
    // Reset state for a fresh start
    setShowContent(true);

    setDisplayedLyrics("");
    setCurrentAsciiArt("");

    startTime.current = 0;
    eventIndex.current = 0;

    setIsProcessing(false);
    setTaskQueue([]);

    setIsProcessingArt(false)
    setArtTaskQueue([]);

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }

    // this triggers our useEffect of the router. that means it starts what its doing that is populating the queues and stuff. 
    setIsPlaying(true);
  };

  if (!hasAudio) {
    return (
      <div className="flex flex-col items-center min-w-full gap-6">

        <AnimatePresence>
          {!showContent && (
            <motion.div
              key="intro"
              className="flex flex-col items-center justify-center gap-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >

              <p className={clsx("text-4xl md:text-4xl font-black lg:text-5xl tracking-tighter break-words text-left px-6 sm:mb-10", nunito.className)}>
                {"I planned something cool but it seems its is broken right now :("}
              </p>

              <CloudLightning size={120} className="text-gray-300" />

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    )
  }

  if (animationEnded) {
    return (
      <div className="flex flex-col items-center min-w-full gap-6">
        <AnimatePresence>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
          >
            <p className={clsx("text-3xl md:text-3xl font-black lg:text-4xl tracking-tighter break-words text-left px-3", nunito.className)}>
              {"That was GLaDOS singing 'Still Alive' from Portal, highly recommend playing the game if you haven't already!"}
            </p>
          </motion.p>

          <Button
            as={"a"}
            className={clsx(
              "mt-12 sm:p-12 p-9 rounded-full text-2xl font-black text-blue-400 border-1 border-blue-200 shadow-none bg-transparent tracking-tighter",
              nunito.className
            )}
            endContent={<ArrowUpRight size={40} className="text-blue-400" />}
            href="./"
            variant="shadow"
          >
            {"Home"}
          </Button>

        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center min-w-full gap-6">

      <AnimatePresence mode="wait">
        {!showContent && (
          <motion.div
            key="intro"
            className="flex flex-col items-center justify-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
          >
            <p className={clsx("text-3xl md:text-3xl font-black lg:text-4xl tracking-tighter break-words text-left px-3", nunito.className)}>
              {"a lil surprise!"}
            </p>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Image
                  height={400}
                  width={250}
                  onClick={handleStart}
                  src="/portal/glados.png"
                  className="rounded-3xl hover:cursor-pointer"
                />

              </motion.div>

            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContent && (
          <motion.div
            key="content"
            className="flex flex-col items-center gap-6 w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >

            <Button
              onPress={() => { setShowModal(true) }}
              className={clsx(
                "p-4 rounded-full text-sm text-red-500 border-1 border-red-500 hover:bg-red-600 hover:text-white shadow-none bg-transparent tracking-tighter",
                codestuff.className
              )}
              endContent={<ArrowUpRight size={15} className="text-red-500" />}
              variant="shadow"
            >
              {`Show ${logs.length} Logs`}
            </Button>

            <motion.div
              className="flex w-full flex-col gap-4 px-4 sm:px-0 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >

              <div
                className={clsx(
                  "min-w-full md:min-w-[600px] h-[400px] border-stone-200 hover:border-stone-400 flex rounded-xl border p-4 overflow-y-auto",
                  codestuff.className
                )}
              >
                <pre className="text-stone-500 text-start text-xs sm:text-sm tracking-wider">
                  {displayedLyrics}
                </pre>
              </div>

              <div
                className={clsx(
                  "min-w-full md:min-w-[600px] h-[400px] rounded-xl border border-sky-200 hover:border-sky-400 p-4 overflow-y-auto flex items-center justify-center",
                  codestuff.className
                )}
              >
                <pre className="text-sky-500 text-xs  leading-tight">
                  {currentAsciiArt}
                </pre>
              </div>



              {/* TODO: investigate better ways to load audio and not load if not found and also avoid redundant requests */}
              {/* we are kind of relying on default cache control measures. */}
              {/* disabling the lint because the UI literally displays the lyrics */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                id="audio"
                ref={audioRef}
                src="/portal/song.mp3"
                preload="auto"
              />

            </motion.div>
            <motion.div
              ref={containerRef}
              className="w-full max-w-full h-[200px] rounded-3xl sm:px-0 px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            />
          </motion.div>
        )
        }
      </AnimatePresence>

      {showModal && (
        <motion.div
          className={clsx(
            "fixed inset-0 z-50 bg-black/70",
            isMobile
              ? "flex items-end"
              : "flex items-center justify-center"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowModal(false)}
        >
          <motion.div
            className={clsx(
              "relative bg-zinc-100 text-zinc-900 border border-white/10 flex flex-col",
              codestuff.className,

              isMobile
                ? [
                  "w-full h-[85vh]",
                  "rounded-t-2xl",
                  "p-5"
                ]
                : [
                  "rounded-3xl",
                  "max-w-[50vw] max-h-[70vh]",
                  "min-w-[40vw] min-h-[60vh]",
                  "p-14"
                ]
            )}
            initial={
              isMobile
                ? { y: "100%" }
                : { scale: 0.9, opacity: 0 }
            }
            animate={
              isMobile
                ? { y: 0 }
                : { scale: 1, opacity: 1 }
            }
            exit={
              isMobile
                ? { y: "100%" }
                : { scale: 0.95, opacity: 0 }
            }
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {isMobile && (
              <div className="w-12 h-1.5 bg-zinc-300 rounded-full mx-auto mb-3" />
            )}

            <div className="flex items-center justify-between mb-4">
              <h2
                className={clsx(
                  "font-black",
                  isMobile ? "text-xl" : "text-3xl"
                )}
              >
                ARHM Portal Doohickey v0.6967
              </h2>

              {isMobile && (
                <button
                  className="text-sm text-zinc-500"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
              )}
            </div>

            <div className="relative flex-1 overflow-y-auto text-left">

              <div className="space-y-2 pr-1">
                {logs.map((log, idx) => (
                  <motion.p
                    key={idx}
                    initial={{
                      opacity: 0,
                      x: isMobile ? 0 : -6
                    }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: isMobile ? 0 : idx * 0.02
                    }}
                    className="text-xs leading-relaxed text-zinc-800"
                  >
                    {`${idx}| ${log}`}
                  </motion.p>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}


      <Button
        as={"a"}
        className={clsx(
          "mt-12 sm:p-12 p-9 rounded-full text-2xl font-black text-blue-400 border-1 border-blue-200 shadow-none bg-transparent tracking-tighter",
          nunito.className
        )}
        endContent={<ArrowUpRight size={40} className="text-blue-400" />}
        href="./"
        variant="shadow"
      >
        {"Home"}
      </Button>
    </div>

  );
} 
