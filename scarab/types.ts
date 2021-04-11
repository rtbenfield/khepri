/// <reference path="../types/wicg-file-system-access.d.ts" />
// TODO: Many of these types are similar to Snowpack types. Maybe Khepri can be Snowpack compatible?

type ExtractTuple<T> = T extends ReadonlyArray<infer U> ? U : never;

export interface KhepriConfig {
  logger: Console;
  /**
   * Mount points define how URL paths map to file system locations. Only the
   * first matching mount point is considered, so mount points should be ordered
   * from most specific to most generic. The remaining URL path after the match
   * is searched for within the file system.
   */
  mount: readonly KhepriMountConfig[];
  plugins: readonly KhepriPluginFactory[];
  /**
   * The file system handle for the root directory of the project. May be used
   * by plugins and utilities that require scanning the project directory.
   */
  root: FileSystemDirectoryHandle;
}

export interface KhepriMountConfig {
  root: FileSystemDirectoryHandle;
  static: boolean;
  url: string;
}

export interface KhepriPluginBase {
  readonly name: string;
  cleanup?(signal: AbortSignal): Promise<void>;
}

export interface KhepriPluginResolve<TOutput extends readonly string[]> {
  /**
   * File extensions that this plugin takes as input (e.g. [".jsx", ".js", …]).
   */
  readonly input: readonly string[];
  /**
   * File extensions that this plugin outputs (e.g. [".js", ".css", …]).
   */
  readonly output: TOutput;
}

export interface KhepriLoadPlugin<TOutput extends readonly string[]>
  extends KhepriPluginBase {
  readonly resolve: KhepriPluginResolve<TOutput>;
  load(
    options: PluginLoadOptions,
    signal: AbortSignal,
  ): Promise<Record<ExtractTuple<TOutput>, Blob>>;
}

export interface KhepriRunPlugin extends KhepriPluginBase {
  run(options: PluginRunOptions, signal: AbortSignal): Promise<unknown>;
}

export interface KhepriTransformPlugin<TOutput extends readonly string[]>
  extends KhepriPluginBase {
  readonly resolve: KhepriPluginResolve<TOutput>;
  transform(
    options: PluginTransformOptions,
    signal: AbortSignal,
  ): Promise<File>;
}

export type KhepriPlugin =
  | KhepriLoadPlugin<string[]>
  | KhepriRunPlugin
  | KhepriTransformPlugin<string[]>;

// export interface KhepriPlugin {
//   /** name of the plugin */
//   name: string;
//   /** Tell Khepri how the load() function will resolve files. */
//   resolve?: {
//     /**
//      * File extensions that this load function takes as input
//      * (e.g. [".jsx", ".js", …])
//      */
//     input: string[];
//     /**
//      * File extensions that this load function outputs
//      * (e.g. [".js", ".css", …])
//      */
//     output: string[];
//   };
//   /** load a file that matches resolve.input */
//   load?(
//     options: PluginLoadOptions,
//     signal: AbortSignal,
//   ): Promise<File>;
//   /** transform a file that matches resolve.input */
//   transform?(
//     options: PluginTransformOptions,
//     signal: AbortSignal,
//   ): Promise<File>;
//   /** runs a command, unrelated to file building (e.g. TypeScript, ESLint) */
//   run?(options: PluginRunOptions, signal: AbortSignal): Promise<unknown>;
//   /** optimize the entire built application */
//   // No optimize support yet
//   // optimize?(options: PluginOptimizeOptions): Promise<void>;
//   /** cleanup any long-running instances/services before exiting.  */
//   cleanup?(): void;
//   cleanup?(signal: AbortSignal): Promise<void>;
//   /** Known dependencies that should be installed */
//   knownEntrypoints?: string[];
//   /** Called when a watched file changes during development. */
//   onChange?({ filePath }: { filePath: string }): void;
//   /** (internal interface, not set by the user) Mark a file as changed. */
//   markChanged?(file: string): void;
// }

export type KhepriPluginFactory = (khepriConfig: KhepriConfig) => KhepriPlugin;

export interface PluginLoadOptions {
  /** File object. */
  file: File;
  /** True if builder is in dev mode */
  isDev: boolean;
  /** True if builder is in SSR mode */
  isSSR: boolean;
  /** True if HMR is enabled (add any HMR code to the output here). */
  isHmrEnabled: boolean;
}

export interface PluginRunOptions {
  isDev: boolean;
}

export interface PluginTransformOptions {
  /** File being processed. */
  file: File;
  /** True if builder is in dev mode. */
  isDev: boolean;
}
