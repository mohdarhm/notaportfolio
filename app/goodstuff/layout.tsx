"use client";
import { Divider, Image } from "@nextui-org/react";
import clsx from "clsx";
import { codestuff } from "../../config/fonts";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="bg-gray-300 dark:bg-gray-800 max-w-[100vw] text-center sm:h-[60vh] h-[40vh] rounded-b-3xl sm:gap-40 gap-16 flex items-center justify-center">
        <p
          className={clsx(
            "text-3xl sm:text-6xl text-gray-600 dark:text-gray-300 font-extrabold tracking-tighter",
            codestuff.className
          )}
        >
          &lt;the{" "}
          <span className="dark:text-amber-500 text-blue-800 ">good</span>{" "}
          stuff. /&gt;
        </p>
      </div>
      <br />
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-7xl text-center justify-center">
          {children}
        </div>
      </section>
      <section className="text-center py-2">
        <Divider className="my-10 w-full" />
        <p className="text-small text-gray-500 pb-2">
          &copy; i would say all rights reseverd but i cant, right? &trade;
        </p>
      </section>
    </>
  );
}
