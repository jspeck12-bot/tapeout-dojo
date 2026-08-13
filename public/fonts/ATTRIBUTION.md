# Self-hosted UI fonts

Latin `woff2` subsets only. Loaded via `@font-face` in `src/ui/tokens.js`.
No Google Fonts runtime import.

| File | Family | Weight | License | Source |
|---|---|---|---|---|
| oxanium-600.woff2 | Oxanium | 600 | OFL-1.1 | [google/fonts Oxanium](https://github.com/googlefonts/oxanium) |
| oxanium-700.woff2 | Oxanium | 700 | OFL-1.1 | [google/fonts Oxanium](https://github.com/googlefonts/oxanium) |
| ibm-plex-sans-400.woff2 | IBM Plex Sans | 400 | OFL-1.1 | [IBM/plex](https://github.com/IBM/plex) |
| ibm-plex-sans-500.woff2 | IBM Plex Sans | 500 | OFL-1.1 | [IBM/plex](https://github.com/IBM/plex) |
| jetbrains-mono-400.woff2 | JetBrains Mono | 400 | OFL-1.1 | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) |
| jetbrains-mono-500.woff2 | JetBrains Mono | 500 | OFL-1.1 | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) |
| jetbrains-mono-600.woff2 | JetBrains Mono | 600 | OFL-1.1 | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) |

Subsets were taken from the Google Fonts latin `unicode-range` (`U+0000-00FF` …)
so the game does not fetch fonts at runtime.
