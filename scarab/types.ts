/// <reference path="../types/wicg-file-system-access.d.ts" />
// TODO: Many of these types are similar to Snowpack types. Maybe Khepri can be Snowpack compatible?

export interface KhepriConfig {
  logger?: Console;
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

export interface KhepriDevServer {
  shutdown(): Promise<void>;
}

export interface KhepriPlugin {
  /** name of the plugin */
  name: string;
  /** Tell Khepri how the load() function will resolve files. */
  resolve?: {
    /**
     * file extensions that this load function takes as input
     * (e.g. [".jsx", ".js", …])
     */
    input: string[];
  };
  /** load a file that matches resolve.input */
  load?(
    options: PluginLoadOptions,
    signal: AbortSignal,
  ): Promise<File>;
  /** transform a file that matches resolve.input */
  transform?(
    options: PluginTransformOptions,
    signal: AbortSignal,
  ): Promise<PluginTransformResult | string | null | undefined | void>;
  /** runs a command, unrelated to file building (e.g. TypeScript, ESLint) */
  run?(options: PluginRunOptions, signal: AbortSignal): Promise<unknown>;
  /** optimize the entire built application */
  // No optimize support yet
  // optimize?(options: PluginOptimizeOptions): Promise<void>;
  /** cleanup any long-running instances/services before exiting.  */
  cleanup?(): void;
  cleanup?(signal: AbortSignal): Promise<void>;
  /** Known dependencies that should be installed */
  knownEntrypoints?: string[];
  /** Called when a watched file changes during development. */
  onChange?({ filePath }: { filePath: string }): void;
  /** (internal interface, not set by the user) Mark a file as changed. */
  markChanged?(file: string): void;
}

export type KhepriBuildMap = Record<string, KhepriBuiltFile>;

export interface KhepriBuiltFile {
  code: Blob;
  map?: Blob;
}

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

/** map of extensions -> code (e.g. { ".js": "[code]", ".css": "[code]" }) */
export type PluginLoadResult = KhepriBuildMap;

export interface PluginRunOptions {
  isDev: boolean;
}

export interface PluginTransformOptions {
  /** The absolute file path of the source file, on disk. */
  id: string;
  /** The extension of the file */
  fileExt: string;
  /** Contents of the file to transform */
  contents: string | ArrayBuffer;
  /** True if builder is in dev mode */
  isDev: boolean;
  /** True if HMR is enabled (add any HMR code to the output here). */
  isHmrEnabled: boolean;
  /** True if builder is in SSR mode */
  isSSR: boolean;
}

export interface PluginTransformResult {
  contents: string;
  map: string | RawSourceMap;
}

export interface RawSourceMap {
  version: number;
  sources: string[];
  names: string[];
  sourceRoot?: string;
  sourcesContent?: string[];
  mappings: string;
  file: string;
}
