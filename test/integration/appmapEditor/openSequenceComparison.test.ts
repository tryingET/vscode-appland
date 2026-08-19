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
  views?: {
    sequence?: {
      base?: { actors?: unknown[] };
      head?: { actors?: unknown[] };
      diff?: { actors?: unknown[] };
    };
  };
  changes: Array<{
    summary?: string;
    details?: {
      name?: { before?: string; after?: string };
    };
  }>;
};

async function ensureComparisonFixture(): Promise<void> {
  try {
    const existing = JSON.parse(await readFile(COMPARISON_PATH, 'utf8')) as SequenceComparison;
    if (existing.kind === 'appmap.comparison') return;
  } catch {
    // The normal repository test creates a compact fallback below. The dogfood
    // workflow copies a real CLI-produced bundle to COMPARISON_PATH first.
  }

  const diagram = JSON.parse(await readFile(DIFF_PATH, 'utf8'));
  await writeFile(
    COMPARISON_PATH,
    JSON.stringify({
      kind: 'appmap.comparison',
      schemaVersion: 1,
      producer: { name: 'extension-test', version: '1' },
      scenario: { id: 'users-edit-unsuccessful-edit' },
      revisions: { base: 'base-sha', head: 'head-sha' },
      recordings: { base: 'base.appmap.json', head: 'head.appmap.json' },
      capabilities: {
        views: { sequence: 1 },
        navigation: { changes: 1, eventAlignment: 1 },
      },
      changes: [],
      views: {
        sequence: {
          schemaVersion: 1,
          base: diagram,
          head: diagram,
          diff: diagram,
          alignment: { actorOrder: diagram.actors.map((actor) => actor.id) },
        },
      },
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

    const comparison = editorProvider.openDocuments[0].sequenceDiagramComparison as
      | SequenceComparison
      | undefined;
    assert(comparison);
    assert.equal(comparison.kind, 'appmap.comparison');
    const sequence = comparison.views?.sequence;
    assert(sequence?.base?.actors && sequence.head?.actors && sequence.diff?.actors);

    try {
      const expectedChange = (await readFile(EXPECTED_CHANGE_PATH, 'utf8')).trim().toLowerCase();
      assert(
        comparison.changes.some((change) =>
          [change.summary, change.details?.name?.before, change.details?.name?.after]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(expectedChange))
        ),
        `Expected the dogfood comparison to contain ${expectedChange}`
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  });
});
