/**
 * Plugin registry — compile-time registration of every plugin in the monorepo.
 *
 * Add a new plugin by importing its manifest and registering it here.
 * There is no filesystem walk, no `require()`, no dynamic loader.
 */
import { createPluginRegistry, type PluginRegistry } from "@learning-platform/core/plugins";
import { manifest as pluginAuth } from "@learning-platform/plugin-auth";
import { manifest as pluginCatalog } from "@learning-platform/plugin-catalog";
import { manifest as pluginLearning } from "@learning-platform/plugin-learning";
import { manifest as pluginCredentials } from "@learning-platform/plugin-credentials";
import { manifest as pluginLocalization } from "@learning-platform/plugin-localization";

let _registry: PluginRegistry | null = null;

export function getPluginRegistry(): PluginRegistry {
  if (_registry) return _registry;
  _registry = createPluginRegistry()
    .register(pluginAuth)
    .register(pluginCatalog)
    .register(pluginLearning)
    .register(pluginCredentials)
    .register(pluginLocalization);
  return _registry;
}
