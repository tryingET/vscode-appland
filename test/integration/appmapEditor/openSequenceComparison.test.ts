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

describe('AppMap sequence comparison editor', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(async () => {
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
  });
  afterEach(initializeWorkspace);
  afterEach(() => rm(COMPARISON_PATH, { force: true }));

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
    expect(editorProvider.openDocuments[0].sequenceDiagramComparison).to.be.an('object');
  });
});
