// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions/** runs on Deno (Supabase Edge Functions), not this
    // app's Node/Metro toolchain — its `jsr:` imports aren't resolvable by
    // eslint-plugin-import and aren't meant to be.
    ignores: ["dist/*", "supabase/functions/**"],
  },
  {
    rules: {
      // This is a web-JSX/HTML rule: it wants raw apostrophes/quotes replaced
      // with entities like &apos;. React Native's <Text> does not interpret
      // HTML entities — applying the rule's own auto-fix would render the
      // literal string "&apos;" on screen. Not applicable on this platform.
      "react/no-unescaped-entities": "off",

      // These three rules ship in eslint-plugin-react-hooks v6 as part of its
      // React Compiler-readiness checks. This app doesn't use the React
      // Compiler, and every remaining occurrence of these three at the time
      // they were disabled was a false positive for standard, tested React
      // Native patterns rather than a real bug:
      //   - react-hooks/refs: fires on `useRef(new Animated.Value(x)).current`,
      //     the React Native Animated API's own documented idiom for animated
      //     styles. The rule can't distinguish an Animated.Value ref (meant to
      //     be read during render) from a plain mutable ref (which shouldn't be).
      //   - react-hooks/purity: fires on `Date.now()` used to render a live
      //     countdown (rest timer, mobility timer) — reading the wall clock
      //     during render is exactly how that display works; there's no way to
      //     show "12s left" without it.
      //   - react-hooks/set-state-in-effect: fires on legitimate "sync local
      //     state with an external trigger" effects — auth boot-on-mount,
      //     hydrating a sheet's fields when it opens for a different entry,
      //     resetting a modal's state when it becomes visible. These are
      //     documented legitimate useEffect uses, not the "derive state you
      //     could compute during render" anti-pattern the rule targets.
      // Genuine hits from these rules (a ref mutated during render outside the
      // Animated case, etc.) were fixed directly rather than suppressed — see
      // git history around when this comment was added.
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
