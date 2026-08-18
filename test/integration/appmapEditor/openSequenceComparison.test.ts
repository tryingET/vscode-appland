// @project project-diagram-diff

import * as vscode from 'vscode';
import { readFile, rm, writeFile } from 'fs/promises';
import { initializeWorkspace, waitFor, waitForExtension, ProjectDiagramDiff } from '../util';
import AppMapService from '../../../src/appMapService';
import assert from 'assert';
import { join } from 'path';

const DIFF_PATH = join(
  ProjectDiagramDiff,
  'data/diff/minitest/Users_edit_unsuccessful_edit.diff.sequence.json'
);
const COMPARISON_PATH = join(
  ProjectDiagramDiff,
  'data/diff/minitest/Users_edit_unsuccessful_edit.compare.diff.sequence.json'
);
const EXPECTED_CHANGE_PATH = `${COMPARISON_PATH}.expect`;

type SequenceComparison = {
  kind: string;
  base?: { actors?: unknown[] };
  head?: { actors?: unknown[] };
  diff?: { actors?: unknown[] };
  changes: Array<{ name?: string }>;
};

async function ensureComparisonFixture(): Promise<void> {
  try {
    const existing = JSON.parse(await readFile(COMPARISON_PATH, 'utf8')) as SequenceComparison;
    if (existing.kind === 'appmap.sequence-comparison') return;
  } catch {
    // The normal repository test creates a compact fallback below. The dogfood
    // workflow copies a real CLI-produced bundle to COMPARISON_PATH first.
  }

  const diagram = JSON.parse(await readFile(DIFF_PATH, 'utf8'));
  await writeFile(
    COMPARISON_PATH,
    JSON.stringify({
      kind: 'appmap.sequence-comparison',
      schemaVersion: 1,
      scenario: 'Users edit unsuccessful edit',
      baseRevision: 'base-sha',
      headRevision: 'head-sha',
      baseAppMap: 'base.appmap.json',
      headAppMap: 'head.appmap.json',
      base: diagram,
      head: diagram,
      diff: diagram,
      changes: [],
    })
  );
}

describe('AppMap sequence comparison editor', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(ensureComparisonFixture);
  afterEach(initializeWorkspace);
  afterEach(() => rm(COMPARISON_PATH, { force: true }));
  afterEach(() => rm(EXPECTED_CHANGE_PATH, { force: true }));

  it('opens a self-contained before/after comparison', async () => {
    const extension = vscode.extensions.getExtension<AppMapService>('appland.appmap');
    assert(extension);
    const { editorProvider } = extension.exports;
    await waitFor('All editors should be closed', () => editorProvider.openDocuments.length === 0);

    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(COMPARISON_PATH));

    await waitFor(
      'AppMap comparison should be opened',
      () => editorProvider.openDocuments.length === 1
    );

    const comparison = editorProvider.openDocuments[0]
      .sequenceDiagramComparison as SequenceComparison | undefined;
    assert(comparison);
    assert.equal(comparison.kind, 'appmap.sequence-comparison');
    assert(comparison.base?.actors && comparison.head?.actors && comparison.diff?.actors);

    try {
      const expectedChange = (await readFile(EXPECTED_CHANGE_PATH, 'utf8')).trim().toLowerCase();
      assert(
        comparison.changes.some((change) =>
          String(change.name).toLowerCase().includes(expectedChange)
        ),
        `Expected the dogfood comparison to contain ${expectedChange}`
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  });
});
