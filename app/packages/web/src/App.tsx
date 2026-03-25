export function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6">
        {/* Cherry blossom icon */}
        <div className="text-6xl text-sakura">🌸</div>

        <h1 className="text-h1 font-semibold tracking-tight">chirri</h1>
        <p className="text-body-sm text-stone max-w-md">
          API change detection that watches so you don't have to.
          <br />
          Plant your first seed — add an API URL to monitor.
        </p>

        <div className="flex gap-3 justify-center">
          <button className="px-5 py-2.5 bg-sakura text-ink rounded-md font-medium text-body hover:bg-petal transition-colors">
            Get Started
          </button>
          <button className="px-5 py-2.5 border border-mist dark:border-ash rounded-md text-body hover:bg-mist dark:hover:bg-ash transition-colors">
            Learn More
          </button>
        </div>

        <p className="text-caption text-stone">
          Free tier — 3 URLs, 24h checks, forever free
        </p>
      </div>
    </div>
  );
}
