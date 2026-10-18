# CodeComparsion

Compare files and folders without leaving VS Code.

For individual files, the extension opens VS Code's built-in diff editor. For folders, it opens a separate tab showing both directory trees, with matching entries lined up so you can see what changed and what's missing on either side. No Git repository required.

This is an early version. File and folder comparison works; copying files between sides and merging changes are not implemented yet.

## Usage

1. Right-click the first file or folder in the VS Code Explorer and choose **Select for Compare**.
2. Right-click the second one and choose **Compare with Selected**.

The first selection goes on the left, the second on the right. Select two files or two folders.

Folder comparisons open in a **Compare Results** tab. Expanding a folder expands both sides, and scrolling keeps matching entries aligned. Click a file present on both sides to open its diff. A `—` means that entry is missing on that side.

Use **Expand all**, **Collapse all**, and **Refresh comparison** to navigate and rescan. Keyboard controls are also available: Tab moves between controls, Enter expands a folder or opens a file diff, and the arrow keys move through entries or expand and collapse folders.

### Status markers

| Marker | Meaning |
| --- | --- |
| `·` | Unchanged |
| `M` | Changed content; on a folder, differences somewhere inside it |
| `L` / `R` | Present only on the left / right |
| `!` | A read error or a type conflict, such as a file versus a folder |
| `↗` | Skipped symbolic link |
| `≥` | File exceeds the size limit |

Hover over an entry or its marker for the full status. The view uses colors from the active VS Code theme.

## Installation

Requires **VS Code 1.95 or newer**.

Build a VSIX package using the instructions below. In the Extensions panel, open the `…` menu, choose **Install from VSIX…**, and select `codecomparsion-0.2.1.vsix`. Reload the VS Code window after updating.

## Building from source

Use Node.js 22.23.1 or newer and npm. From the project directory:

```sh
npm ci
npm run check
npm test
npm run build
npm run package
```

The VSIX is written to the project directory. The first build needs an internet connection to download dependencies. Dependency versions are locked in `package-lock.json`; no global npm packages are needed.

To try the extension before packaging, run `code --extensionDevelopmentPath=.` from the project directory after building. This opens an Extension Development Host window. Rebuild and reload that window after editing the code.

## Under the hood

The extension is written in TypeScript and bundled with esbuild. File access goes through `vscode.workspace.fs`. Folder comparison uses a webview; individual file diffs use VS Code's native editor.

Files are compared byte for byte, rather than by size or modification time alone. Symbolic links are skipped, including links to directories. Binary files are compared as bytes; how their diff is displayed depends on VS Code.

| Setting | Default | Purpose |
| --- | --- | --- |
| `codecomparsion.maxFileBytes` | 16 MiB | Maximum file size read during folder comparison |
| `codecomparsion.maxEntries` | 50,000 | Maximum number of entries scanned under each root |

Files over the size limit are marked as skipped. Reaching the entry limit produces an incomplete-scan error. Scans can be cancelled, although an active file read must finish before cancellation takes effect. Large trees initially render up to 1,000 visible rows; **Show more rows** reveals the next batch without limiting the scan itself.

### Project layout

```text
src/core.ts          Directory scanning and comparison, independent of VS Code
src/extension.ts     Commands, workspace.fs adapter, and view integration
src/folderView.ts    Folder tree model and comparison interface
test/                Comparison engine, tree model, and command tests
Containerfile        Build environment
dev                  Wrapper for running tools through Podman
```

## Current limitations

- Results are a snapshot. Use **Refresh comparison** after changing files; there is no automatic refresh yet.
- There are no exclusion filters yet. Folders such as `node_modules` and `.git` are included in the scan.
- File copying, synchronization, and three-way merge are not implemented.
- The extension itself does not write to or delete the compared files. You can still edit files manually in VS Code's native diff editor.
- `workspace.fs` does not provide an atomic read that refuses to follow symbolic links. A file replaced between the metadata check and the read may still be read. A file growing during that interval can also exceed the configured size limit.

Tests cover the comparison engine, tree model, and commands using a VS Code API test double. They do not replace testing the interface in a running VS Code instance.

## Next steps

Exclusion filters, easier navigation between differences, and refreshing only changed parts of the tree. Copying between sides and three-way merge will need a separate implementation.

## Upgrading from MeldCode

The extension ID is now `codecomparsion-local.codecomparsion`. Uninstall the old `meldcode-local.meldcode` extension to avoid duplicate menu entries, then install the new VSIX. If you customized `meldcode.*` settings or command keybindings, rename their prefix to `codecomparsion.*`.
