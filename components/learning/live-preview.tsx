"use client";

/**
 * A sandboxed render of learner (or lesson) markup: scripts may run, but the
 * frame has no access to the app, its cookies or its storage.
 */
export function LivePreview({ srcDoc, title, className = "h-40" }: { srcDoc: string; title: string; className?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <iframe title={title} srcDoc={srcDoc} sandbox="allow-scripts" className={`${className} w-full`} />
    </div>
  );
}
