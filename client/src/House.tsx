export function House({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 520 340"
      role="img"
      aria-label="Illustration of a home taking shape"
    >
      <defs>
        <linearGradient id="wall" x2="1" y2="1">
          <stop stopColor="#e9e1ce" />
          <stop offset="1" stopColor="#c9c4af" />
        </linearGradient>
        <linearGradient id="glass">
          <stop stopColor="#315f59" />
          <stop offset="1" stopColor="#193d39" />
        </linearGradient>
      </defs>
      <ellipse cx="270" cy="289" rx="210" ry="28" fill="#123f36" opacity=".08" />
      <path d="m98 248 166-95 172 100-163 94Z" fill="#d6d2bf" />
      <path d="M119 247V123l152-69 132 75v128l-131 76Z" fill="url(#wall)" />
      <path d="M271 54v279l132-76V129Z" fill="#c0c6b5" />
      <path d="m111 121 161-89 141 84-142 83Z" fill="#e6e1d3" />
      <path d="m111 121 161 78 142-83v15l-142 83-161-78Z" fill="#f7f3e8" />
      <path d="M137 156v75l108 59v-78Z" fill="url(#glass)" />
      <path d="M172 176v73m36-54v73" stroke="#c0bfae" strokeWidth="4" />
      <path d="m137 231 108 59v6l-108-59Z" fill="#ede8d9" />
      <path d="M302 215v99l48-28v-99Z" fill="#385a4d" />
      <path d="M362 179v64l29-17v-64Z" fill="url(#glass)" />
      <path d="m295 315 61-35v12l-61 36Z" fill="#e6dfcc" />
      <path d="m295 328 68-39v10l-68 39Z" fill="#bfc4b2" />
      <path d="M127 110V76l145-80 124 72v45l-124 73Z" transform="translate(0 28)" fill="#e8e0cf" />
      <path d="M272 28v186l124-73V96Z" fill="#c2c7b4" />
      <path d="m118 100 154-85 134 78-134 78Z" fill="#f4efe2" />
      <path d="M140 120v41l107 59v-42Z" fill="url(#glass)" transform="translate(0 -12)" />
      <path d="M174 126v42m36-21v42" stroke="#d2ccb9" strokeWidth="4" />
      <path d="M299 163v-44l80-46v44Z" fill="url(#glass)" transform="translate(0 38)" />
      <path d="m286 79 54-31 43 25-53 32Z" fill="#6f8e75" />
      <path d="m286 79 44 26v13l-44-25Z" fill="#97aa89" />
      <path d="m330 105 53-32v13l-53 32Z" fill="#507159" />
      <path
        d="M82 263v-57m-10 26 10-22 12 17m-19 17 7-14 14 13"
        stroke="#668969"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M442 271v-72m-15 25 15-29 16 24m-28 22 12-26 20 22"
        stroke="#6d8c64"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path d="m59 281 36-21 32 18-35 21Z" fill="#b4bea0" />
      <path d="m392 299 31-18 26 15-30 18Z" fill="#97aa86" />
      <path d="M105 92V57m-15 27h30M414 162v-28m-11 22h22" stroke="#d7b468" strokeWidth="2" />
      <path d="m39 183 17-10 17 10-17 10Z" fill="none" stroke="#b3bca6" />
      <circle cx="448" cy="92" r="5" fill="#d7b468" />
      <path d="M154 300h28m-14-14v28" stroke="#f2eddf" strokeWidth="2" />
    </svg>
  );
}
