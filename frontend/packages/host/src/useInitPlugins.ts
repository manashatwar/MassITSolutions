import {
  loadRemotePlugin,
  Plugins,
  useAuthContext,
  usePluginProvider,
  usePlugins,
} from '@openmsupply-client/common';
import { useEffect } from 'react';

// Used for local plugins in dev mode
declare const LOCAL_PLUGINS: { pluginPath: string; pluginCode: string }[];

export const useInitPlugins = () => {
  const { setPluginBundles } = usePluginProvider();
  const { query } = usePlugins();
  const { isAuthenticated, storeId } = useAuthContext();

  const initRemotePlugins = async () => {
    const plugins = await query();

    const bundles: { code: string; bundle: Plugins }[] = [];
    for (const plugin of plugins) {
      const pluginBundle = await loadRemotePlugin(plugin);
      bundles.push({ code: plugin.code, bundle: pluginBundle });
    }

    // Replace the whole set rather than adding incrementally, so a plugin
    // deleted on the central server (and thus absent from `plugins`) is dropped
    // from the store once a sync re-runs this. See issue #12169 / #11988.
    setPluginBundles(bundles);
  };

  // For hot reloading in dev mode plugins will be loaded from ./plugin folder
  const initLocalPlugins = async () => {
    const bundles: { code: string; bundle: Plugins }[] = [];
    for (const plugin of LOCAL_PLUGINS) {
      // Using require with webpackIgnore so webpack does NOT try to statically
      // resolve the dynamic path (which would emit a "Critical dependency" warning).
      // LOCAL_PLUGINS is [] in demo mode and normally [] in dev without a plugins/
      // directory, so this branch never actually executes in practice.
      const pluginBundle =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require(/* webpackIgnore: true */ `../../plugins/${plugin.pluginPath}/src/plugin.tsx`);
      bundles.push({ code: plugin.pluginCode, bundle: pluginBundle.default });
    }
    setPluginBundles(bundles);
  };
  // Local (dev) plugins are loaded from disk and don't depend on auth, so load
  // them once on mount.
  // Skip entirely in DEMO_MODE — there's no plugins/ directory and LOCAL_PLUGINS
  // is always [] in that build, so there's nothing to load.
  useEffect(() => {
    if (process.env['NODE_ENV'] !== 'production') {
      // @ts-ignore — DEMO_MODE is injected by webpack DefinePlugin
      const isDemoMode = typeof DEMO_MODE !== 'undefined' && (DEMO_MODE as boolean);
      if (!isDemoMode) initLocalPlugins();
    }
  }, []);

  // Remote plugins are re-fetched whenever the auth context changes - on
  // login or store switch. (The v3.0.0-RC merge removed the auth context's
  // `lastSuccessfulSync` signal that previously also triggered a re-fetch after
  // each successful sync - see issue #12169; that after-sync reload can be
  // re-added on top of RC's auth model if needed.)
  useEffect(() => {
    if (process.env['NODE_ENV'] !== 'production') return;
    if (!isAuthenticated || !storeId) return;
    initRemotePlugins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, storeId]);
};
