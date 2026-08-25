const WORDMARK_WIDTH = 85;

export function Logo({ compact = false, wordmarkOnly = false }: { compact?: boolean; wordmarkOnly?: boolean }) {
  if (compact) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        className="size-6"
        aria-label="Labelator"
      >
        <rect width="100" height="100" rx="6" fill="#202124" />
        <rect x="22" y="0" width="20" height="86" fill="#fff" />
        <rect x="22" y="74" width="78" height="12" fill="#fff" />
      </svg>
    );
  }
  const wordmark = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${WORDMARK_WIDTH} 10`}
        className="block aspect-[85/10] h-auto w-full"
        aria-hidden={wordmarkOnly ? undefined : true}
        aria-label={wordmarkOnly ? "Labelator" : undefined}
      >
        <rect x="0" y="0" width="2.05" height="10" fill="#202124" />
        <rect x="0" y="8.746" width="5.4" height="1.254" fill="#202124" />
        <rect x="9.225" y="0" width="6.4" height="1.254" fill="#202124" />
        <rect x="9.225" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="14.305" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="9.225" y="5.5" width="6.4" height="1.254" fill="#202124" />
        <rect x="19.45" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="19.45" y="0" width="6.2" height="1.254" fill="#202124" />
        <rect x="19.45" y="4.35" width="6.2" height="1.254" fill="#202124" />
        <rect x="19.45" y="8.746" width="6.2" height="1.254" fill="#202124" />
        <rect x="24.33" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="29.475" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="29.475" y="0" width="5.4" height="1.254" fill="#202124" />
        <rect x="29.475" y="4.5" width="4.2" height="1.254" fill="#202124" />
        <rect x="29.475" y="8.746" width="5.4" height="1.254" fill="#202124" />
        <rect x="38.7" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="38.7" y="8.746" width="5.4" height="1.254" fill="#202124" />
        <rect x="47.925" y="0" width="6.4" height="1.254" fill="#202124" />
        <rect x="47.925" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="53.005" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="47.925" y="5.5" width="6.4" height="1.254" fill="#202124" />
        <rect x="58.15" y="0" width="6.2" height="1.254" fill="#202124" />
        <rect x="60.59" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="68.175" y="0" width="6.8" height="1.254" fill="#202124" />
        <rect x="68.175" y="8.746" width="6.8" height="1.254" fill="#202124" />
        <rect x="68.175" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="73.655" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="78.8" y="0" width="1.32" height="10" fill="#202124" />
        <rect x="78.8" y="0" width="4.5" height="1.254" fill="#202124" />
        <rect x="78.8" y="4.35" width="4.5" height="1.254" fill="#202124" />
        <rect x="81.98" y="0" width="1.32" height="5.604" fill="#202124" />
        <rect x="81.98" y="4.35" width="1.9" height="1.254" fill="#202124" />
        <rect x="83.68" y="4.35" width="1.32" height="5.65" fill="#202124" />
      </svg>
  );
  if (wordmarkOnly) return wordmark;
  return (
    <div className="flex w-[8.55rem] max-w-full flex-col" aria-hidden>
      {wordmark}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${WORDMARK_WIDTH} 7`}
        className="mt-[6px] block h-auto w-full text-muted-foreground"
      >
        <text
          x="0"
          y="5.65"
          fill="currentColor"
          fontFamily="var(--font-sans), Helvetica, sans-serif"
          fontSize="5.85"
          fontWeight="500"
          textLength={WORDMARK_WIDTH}
          lengthAdjust="spacingAndGlyphs"
        >
          LABEL DESIGN & AUTOMATION
        </text>
      </svg>
    </div>
  );
}
