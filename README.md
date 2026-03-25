# chirri

web change intelligence for developers.

you give it an api endpoint. it finds the docs, changelog, and status page. when something changes, it tells you what happened and what to do.

## status

pre-development. specs + working prototypes.

## structure

```
specs/          -- product specs, bible, api reference
prototypes/     -- working code: diff engine, discovery, llm summarizer
landing/        -- design system + landing page
design/         -- petals, svgs, assets
```

## prototypes

- **diff engine** -- 6-layer false positive defense, section extraction, voting pipeline, 0% FP rate
- **discovery** -- 9 methods, endpoint-specific filtering, 80-100% hit rate
- **llm summarizer** -- 74% severity accuracy, 91% breaking detection, $0.0004/analysis
